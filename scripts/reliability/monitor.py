#!/usr/bin/env python3
"""Local PNet status. Never restart containers or read contacts, media or env."""
import fcntl
import json
import os
from pathlib import Path
import re
import stat
import subprocess
import tempfile
from datetime import datetime, timezone

ROOT = Path('/opt/pnet-backups')
STATE = ROOT / '.automation'
MAX_AGE = 26 * 3600
MAX_BUSY = 30 * 60


def shared_busy():
    # Observe the existing flock without acquiring it: never block a backup.
    path = STATE / 'backup.lock'
    private(path)
    s = path.stat()
    target = (os.major(s.st_dev), os.minor(s.st_dev), s.st_ino)
    for line in Path('/proc/locks').read_text().splitlines():
        fields = line.split()
        if len(fields) < 8 or fields[1] != 'FLOCK':
            continue
        major, minor, inode = fields[5].split(':')
        if (int(major, 16), int(minor, 16), int(inode)) == target:
            return True
    return False


def age(value, now):
    parsed = datetime.fromisoformat(value)
    if parsed.tzinfo is None:
        raise ValueError('Timezone required')
    seconds = (now - parsed).total_seconds()
    if seconds < -60:
        raise ValueError('Future timestamp')
    return max(0, seconds)


def private(path, directory=False):
    s = path.lstat()
    valid = stat.S_ISDIR(s.st_mode) if directory else stat.S_ISREG(s.st_mode)
    if not valid or s.st_uid != 0 or stat.S_IMODE(s.st_mode) != (0o700 if directory else 0o600):
        raise ValueError('Invalid private metadata')


def read_json(path):
    private(path)
    with path.open('rb') as stream:
        raw = stream.read(65537)
    if len(raw) > 65536:
        raise ValueError('Metadata too large')
    value = json.loads(raw)
    if not isinstance(value, dict):
        raise ValueError('Object required')
    return value


def command(args):
    result = subprocess.run(args, capture_output=True, text=True, timeout=8)
    if result.returncode:
        raise ValueError('Command failed')
    return result.stdout.strip()


def container(service):
    fields = ['.Config.Labels', '.State.Running', '.State.Paused', '.State.Restarting']
    template = '\n'.join('{{json ' + field + '}}' for field in fields)
    template += '\n{{if .State.Health}}{{json .State.Health.Status}}{{else}}null{{end}}'
    values = command(['docker', 'inspect', '--format', template, 'pnet-' + service + '-1']).splitlines()
    labels, running, paused, restarting, health = map(json.loads, values)
    if labels.get('com.docker.compose.project') != 'pnet' or labels.get('com.docker.compose.service') != service:
        raise ValueError('Unexpected container identity')
    return bool(running and not paused and not restarting and
                (service == 'db' or health == 'healthy'))


def unit(name):
    text = command(['systemctl', 'show', name, '--property=LoadState,ActiveState,UnitFileState,Result'])
    return dict(line.split('=', 1) for line in text.splitlines() if '=' in line)


def evaluate(now, busy, previous):
    alerts = []
    report = {'checkedAt': now.isoformat(), 'alerts': alerts}
    try:
        success = read_json(STATE / 'last-success.json')
        name = success['directory']
        if success['status'] != 'success' or not re.fullmatch(r'scheduled-db-media-[0-9]{8}T[0-9]{12}Z', name):
            raise ValueError('Invalid success record')
        private(ROOT / name, directory=True)
        manifest = read_json(ROOT / name / 'manifest.json')
        if manifest.get('format') != 'pnet-db-media-v1' or manifest.get('status') != 'success' or manifest.get('apiRecovered') is not True:
            raise ValueError('Invalid manifest')
        # Use the older timestamp: a modified pointer cannot refresh an old set.
        seconds = max(age(success['finishedAt'], now), age(manifest['finishedAt'], now))
        for filename in ('database.dump', 'media.tar.gz'):
            private(ROOT / name / filename)
            if (ROOT / name / filename).stat().st_size == 0:
                raise ValueError('Empty backup artifact')
        report['backupAgeSeconds'] = int(seconds)
        if seconds > MAX_AGE:
            alerts.append('BACKUP_STALE')
    except Exception:
        alerts.append('BACKUP_METADATA_INVALID_OR_MISSING')

    try:
        timer = unit('pnet-backup.timer')
        if timer.get('LoadState') != 'loaded' or timer.get('ActiveState') != 'active' or timer.get('UnitFileState') != 'enabled':
            alerts.append('BACKUP_TIMER_NOT_ENABLED_ACTIVE')
        service = unit('pnet-backup.service')
        if service.get('LoadState') != 'loaded':
            alerts.append('BACKUP_SERVICE_MISSING')
        elif not busy and (service.get('ActiveState') == 'failed' or service.get('Result') != 'success'):
            alerts.append('BACKUP_SERVICE_FAILED')
    except Exception:
        alerts.append('BACKUP_UNITS_UNAVAILABLE')

    if busy:
        since = previous.get('busySince', now.isoformat())
        try:
            elapsed = age(since, now)
        except Exception:
            alerts.append('BUSY_TIMESTAMP_INVALID')
            since, elapsed = now.isoformat(), 0
        report['busySince'] = since
        if elapsed > MAX_BUSY:
            alerts.append('BACKUP_OR_DEPLOY_BUSY_TOO_LONG')
        report['containerChecks'] = 'deferred_shared_lock_busy'
    else:
        for name, code in [('recovery.json', 'BACKUP_RECOVERY_PENDING'),
                           ('deploy-recovery.json', 'DEPLOY_RECOVERY_PENDING')]:
            # lexists includes broken symlinks, which must never look healthy.
            if os.path.lexists(STATE / name):
                alerts.append(code)
        try:
            last = read_json(STATE / 'last-run.json')
            age(last['finishedAt'], now)
            if last.get('status') != 'success':
                alerts.append('LAST_BACKUP_RUN_FAILED')
        except Exception:
            alerts.append('LAST_BACKUP_RUN_INVALID_OR_MISSING')
        for service in ('db', 'api', 'web'):
            try:
                if not container(service):
                    alerts.append(service.upper() + '_NOT_READY')
            except Exception:
                alerts.append(service.upper() + '_INSPECTION_FAILED')
        report['containerChecks'] = 'completed'
    report['status'] = 'alert' if alerts else 'busy' if busy else 'ok'
    return report


def publish(report):
    fd, name = tempfile.mkstemp(prefix='.monitor-', dir=STATE)
    try:
        with os.fdopen(fd, 'w') as stream:
            json.dump(report, stream, indent=2)
            stream.write('\n')
            stream.flush()
            os.fsync(stream.fileno())
        os.replace(name, STATE / 'monitor-status.json')
        fd = os.open(STATE, os.O_RDONLY | os.O_DIRECTORY)
        try:
            os.fsync(fd)
        finally:
            os.close(fd)
    finally:
        if os.path.exists(name):
            os.unlink(name)


def main():
    os.umask(0o077)
    try:
        if os.geteuid() != 0:
            raise ValueError('Root required')
        private(ROOT, directory=True)
        private(STATE, directory=True)
        fd = os.open(STATE / 'monitor.lock', os.O_CREAT | os.O_RDWR | os.O_NOFOLLOW, 0o600)
        with os.fdopen(fd, 'a') as monitor_lock:
            fcntl.flock(monitor_lock, fcntl.LOCK_EX | fcntl.LOCK_NB)
            try:
                previous = read_json(STATE / 'monitor-status.json')
            except Exception:
                previous = {}
            busy = shared_busy()
            report = evaluate(datetime.now(timezone.utc), busy, previous)
            if shared_busy() != busy:
                # An operation began/ended during observation; defer health.
                report = evaluate(datetime.now(timezone.utc), True, previous)
            publish(report)
        print('PNET_MONITOR_' + report['status'].upper() +
              (': ' + ','.join(report['alerts']) if report['alerts'] else ''), flush=True)
        return 1 if report['alerts'] else 0
    except Exception:
        print('PNET_MONITOR_ERROR: check unavailable; raw details suppressed', flush=True)
        return 1


if __name__ == '__main__':
    raise SystemExit(main())
