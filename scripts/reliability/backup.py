#!/usr/bin/env python3
"""Private, paired PNet backup. No Compose rendering, recreation or retention."""
import argparse
import fcntl
import hashlib
import json
import os
from pathlib import Path
import shutil
import signal
import stat
import subprocess
import tarfile
import time
from datetime import datetime, timezone

ROOT = Path('/opt/pnet-backups')
STATE = ROOT / '.automation'
RECOVERY = STATE / 'recovery.json'
FORMAT = 'pnet-db-media-v1'
MEDIA_OWNER = (1000, 1000)
STAGING_OWNER = (0, 0)

class BackupError(Exception):
    pass

def now():
    return datetime.now(timezone.utc).isoformat()

def private_dir(path):
    if path.is_symlink():
        raise BackupError('Private directory is a symlink')
    path.mkdir(mode=0o700, exist_ok=True)
    s = path.stat()
    if not stat.S_ISDIR(s.st_mode) or s.st_uid != 0 or stat.S_IMODE(s.st_mode) != 0o700:
        raise BackupError('Private directory must be root-owned and mode 0700')

def sync_dir(path):
    fd = os.open(path, os.O_RDONLY | os.O_DIRECTORY)
    try:
        os.fsync(fd)
    finally:
        os.close(fd)

def atomic_json(path, data):
    temp = path.with_name(path.name + '.tmp')
    fd = os.open(temp, os.O_WRONLY | os.O_CREAT | os.O_TRUNC | os.O_NOFOLLOW, 0o600)
    with os.fdopen(fd, 'w') as f:
        json.dump(data, f, indent=2)
        f.write('\n')
        f.flush()
        os.fsync(f.fileno())
    os.replace(temp, path)
    sync_dir(path.parent)

def run(args, *, output=None, timeout=120):
    # Never forward Docker stderr, DB output or command arguments to the journal.
    try:
        result = subprocess.run(args, stdout=output if output is not None else subprocess.PIPE,
                                stderr=subprocess.DEVNULL, timeout=timeout, check=False)
    except (OSError, subprocess.TimeoutExpired) as e:
        raise BackupError('Command unavailable or timed out') from e
    if result.returncode:
        raise BackupError('Command failed; raw output suppressed')
    return result.stdout.decode().strip() if output is None else ''

def inspect(container, service):
    template = '\n'.join('{{json .' + field + '}}' for field in
                        ('Id', 'Image', 'State', 'Config.Labels', 'Mounts', 'RestartCount'))
    parts = run(['docker', 'inspect', '--format', template, container]).splitlines()
    if len(parts) != 6:
        raise BackupError('Unexpected container metadata')
    cid, image, state, labels, mounts, restarts = map(json.loads, parts)
    if (labels or {}).get('com.docker.compose.project') != 'pnet' or \
       labels.get('com.docker.compose.service') != service:
        raise BackupError('Unexpected container identity')
    return {'id': cid, 'image': image, 'state': state, 'mounts': mounts, 'restartCount': restarts}

def mounted(item, volume, target):
    return any(m.get('Type') == 'volume' and m.get('Name') == volume
               and m.get('Destination') == target for m in item['mounts'])

def fingerprint(item):
    return {k: item[k] for k in ('id', 'image')} | {
        'startedAt': item['state']['StartedAt'],
        'restartCount': item.get('restartCount', 0)}

def health(cid):
    code = "fetch('http://127.0.0.1:3000/api/v1/health',{signal:AbortSignal.timeout(3000)}).then(r=>process.exit(r.status===200?0:1)).catch(()=>process.exit(1))"
    for attempt in range(20):
        try:
            run(['docker', 'exec', cid, 'node', '-e', code], timeout=8)
            return
        except BackupError:
            if attempt == 19:
                raise BackupError('API did not return after backup')
            time.sleep(1)

def recover():
    if not RECOVERY.exists():
        return
    record = json.loads(RECOVERY.read_text())
    api = inspect(record['id'], 'api')
    if api['id'] != record['id'] or api['image'] != record['image']:
        raise BackupError('Recovery container identity changed')
    # A durable marker is written before stopping; retry even after SIGKILL.
    for attempt in range(3):
        try:
            if not inspect(record['id'], 'api')['state']['Running']:
                run(['docker', 'start', record['id']], timeout=60)
            health(record['id'])
            RECOVERY.unlink()
            sync_dir(STATE)
            return
        except BackupError:
            if attempt == 2:
                raise BackupError('API recovery failed; marker retained')
            time.sleep(2)

def digest(path):
    with path.open('rb') as f:
        return hashlib.file_digest(f, 'sha256').hexdigest()

def pack_media(source, dest):
    entries = []
    for p in [source, *sorted(source.rglob('*'))]:
        s = p.lstat()
        if p.is_symlink() or not (stat.S_ISDIR(s.st_mode) or stat.S_ISREG(s.st_mode)):
            raise BackupError('Unexpected media entry type')
        if (s.st_uid, s.st_gid) not in (MEDIA_OWNER, STAGING_OWNER):
            raise BackupError('Unexpected staging ownership')
        if stat.S_IMODE(s.st_mode) != (0o700 if p.is_dir() else 0o600):
            raise BackupError('Unexpected media permissions')
        if p.is_file():
            entries.append({'path': p.relative_to(source).as_posix(),
                            'sha256': digest(p), 'mode': '0600'})
    def restore_owner(member):
        # Docker can map local copy ownership to root. Source is validated
        # inside API before stopping; the private staging tree is never chowned.
        member.uid, member.gid = MEDIA_OWNER
        member.uname = member.gname = ''
        return member

    with tarfile.open(dest, 'w:gz') as archive:
        archive.add(source, arcname='.', recursive=True, filter=restore_owner)
    # Verify this newly generated archive without restoring any database.
    with tarfile.open(dest, 'r:gz') as archive:
        files = {}
        for member in archive:
            if (member.uid, member.gid) != MEDIA_OWNER:
                raise BackupError('Media archive ownership mismatch')
            if member.isdir():
                if member.mode != 0o700:
                    raise BackupError('Media archive directory mode mismatch')
                continue
            if not member.isfile() or member.mode != 0o600:
                raise BackupError('Media archive entry mismatch')
            with archive.extractfile(member) as stream:
                files[member.name.removeprefix('./')] = hashlib.file_digest(stream, 'sha256').hexdigest()
    if files != {e['path']: e['sha256'] for e in entries}:
        raise BackupError('Media archive hashes mismatch')
    return entries

def backup():
    if (STATE / 'deploy-recovery.json').exists():
        raise BackupError('Unresolved deployment; run deploy recovery before backup')
    if RECOVERY.exists():
        recover()
        raise BackupError('Recovered previous interrupted run; retry backup separately')
    services = {s: inspect('pnet-' + s + '-1', s) for s in ('api', 'db', 'web')}
    if not all(x['state']['Running'] and not x['state'].get('Paused')
               and not x['state'].get('Restarting') for x in services.values()):
        raise BackupError('Required production container is not running normally')
    if not mounted(services['api'], 'pnet_contact_media', '/app/private-media') or \
       not mounted(services['db'], 'pnet_db_data', '/var/lib/postgresql/data'):
        raise BackupError('Unexpected persistent volume mount')
    for volume, owner in (('pnet_contact_media', services['api']['id']),
                          ('pnet_db_data', services['db']['id'])):
        mounted_ids = run(['docker', 'ps', '--no-trunc', '-q', '--filter', 'volume=' + volume]).split()
        if set(mounted_ids) != {owner}:
            raise BackupError('Unexpected running container shares a private volume')
    db_bytes = int(run(['docker', 'exec', services['db']['id'], 'sh', '-ec',
                        'exec psql -X -v ON_ERROR_STOP=1 -U "$POSTGRES_USER" -d "$POSTGRES_DB" -Atc "SELECT pg_database_size(current_database())"']))
    media_size_js = """
const fs = require('fs');
function size(p) {
  const s = fs.lstatSync(p);
  if ((!s.isDirectory() && !s.isFile()) || s.uid !== 1000 || s.gid !== 1000 ||
      (s.mode & 0o777) !== (s.isDirectory() ? 0o700 : 0o600)) throw new Error();
  return s.isDirectory()
    ? fs.readdirSync(p).reduce((n, x) => n + size(p + '/' + x), s.size) : s.size;
}
try { console.log(size('/app/private-media')); } catch { process.exit(1); }
"""
    media_bytes = int(run(['docker', 'exec', services['api']['id'], 'node', '-e', media_size_js]))
    if min(db_bytes, media_bytes) < 0 or shutil.disk_usage(ROOT).free < 2 * (db_bytes + media_bytes) + 1024 ** 3:
        raise BackupError('Insufficient free space including private staging and 1 GiB reserve')
    stamp = datetime.now(timezone.utc).strftime('%Y%m%dT%H%M%S%fZ')
    stage = ROOT / ('.incomplete-scheduled-' + stamp)
    stage.mkdir(mode=0o700)
    started = now()
    api = services['api']
    error = None
    hashes = None
    # Stop/start operate on the original ID: all four Compose layers are preserved.
    try:
        atomic_json(RECOVERY, {'id': api['id'], 'image': api['image'], 'startedAt': started})
        run(['docker', 'stop', '--time', '30', api['id']], timeout=60)
        if inspect(api['id'], 'api')['state']['Running']:
            raise BackupError('API failed to stop')
        dump = stage / 'database.dump'
        with dump.open('xb') as f:
            run(['docker', 'exec', services['db']['id'], 'sh', '-ec',
                 'exec pg_dump -U "$POSTGRES_USER" -d "$POSTGRES_DB" --format=custom'],
                output=f, timeout=600)
            f.flush()
            os.fsync(f.fileno())
        with dump.open('rb') as f:
            if f.read(5) != b'PGDMP':
                raise BackupError('Invalid PostgreSQL dump header')
        # pg_restore --list validates the custom dump catalogue, not a restore.
        # Stream the dump into pg_restore inside the same PostgreSQL 17 image.
        with dump.open('rb') as f, (stage / 'dump-catalogue.txt').open('wb') as out:
            result = subprocess.run(['docker', 'exec', '-i', services['db']['id'],
                                     'pg_restore', '--list'], stdin=f, stdout=out,
                                    stderr=subprocess.DEVNULL, timeout=60)
        if result.returncode:
            raise BackupError('Dump catalogue validation failed')
        media = stage / 'media'
        run(['docker', 'cp', '-a', api['id'] + ':/app/private-media', str(media)], timeout=300)
        # API stays stopped only for DB dump + copy; compression/hashes happen afterward.
    except BaseException as e:
        error = e
    finally:
        # Complete recovery before declaring or verifying a backup.
        try:
            recover()
        except BaseException as e:
            error = e
    if error is not None:
        atomic_json(stage / 'result.json', {'status': 'failed', 'finishedAt': now()})
        raise BackupError('Backup incomplete; API recovery attempted; private set retained') from error
    for service in ('db', 'web'):
        if fingerprint(inspect(services[service]['id'], service)) != fingerprint(services[service]):
            raise BackupError('DB or WEB changed during backup')
    if inspect(api['id'], 'api')['image'] != api['image']:
        raise BackupError('API image changed during backup')
    hashes = pack_media(media, stage / 'media.tar.gz')
    atomic_json(stage / 'photo-hashes.json', hashes)
    atomic_json(stage / 'images.json', {s: {'id': x['id'], 'image': x['image']}
                                      for s, x in services.items()})
    # Only remove this run's private staging copy after verified tar creation.
    shutil.rmtree(media)
    checksums = {p.name: digest(p) for p in stage.iterdir() if p.is_file()}
    atomic_json(stage / 'sha256.json', checksums)
    manifest = {'format': FORMAT, 'status': 'success', 'startedAt': started,
                'finishedAt': now(), 'consistentBy': 'API stopped for dump and media copy',
                'apiRecovered': True, 'restoreTested': False, 'checksums': checksums}
    atomic_json(stage / 'manifest.json', manifest)
    # Flush all output files before publishing the successful directory atomically.
    for p in stage.iterdir():
        with p.open('rb') as f:
            os.fsync(f.fileno())
    sync_dir(stage)
    final = ROOT / ('scheduled-db-media-' + stamp)
    stage.rename(final)
    sync_dir(ROOT)
    atomic_json(STATE / 'last-success.json', {'status': 'success', 'finishedAt': now(),
                                            'directory': final.name})
    return final.name

def interrupted(signum, frame):
    raise BackupError('Backup interrupted')

def main():
    parser = argparse.ArgumentParser()
    parser.add_argument('--recover', action='store_true')
    args = parser.parse_args()
    os.umask(0o077)
    if os.geteuid() != 0:
        print('BACKUP_FAILED: root required', flush=True)
        return 1
    try:
        private_dir(ROOT)
        private_dir(STATE)
        if args.recover and not RECOVERY.exists():
            print('API_RECOVERY_NOT_NEEDED', flush=True)
            return 0
        fd = os.open(STATE / 'backup.lock', os.O_CREAT | os.O_RDWR | os.O_NOFOLLOW, 0o600)
        with os.fdopen(fd, 'a') as lock:
            try:
                fcntl.flock(lock, fcntl.LOCK_EX | fcntl.LOCK_NB)
            except BlockingIOError:
                print('BACKUP_BUSY: another run holds the lock', flush=True)
                return 1
            signal.signal(signal.SIGTERM, interrupted)
            signal.signal(signal.SIGINT, interrupted)
            try:
                if args.recover:
                    recover()
                    print('API_RECOVERY_OK', flush=True)
                else:
                    name = backup()
                    atomic_json(STATE / 'last-run.json', {'status': 'success', 'finishedAt': now()})
                    print('BACKUP_OK: ' + name, flush=True)
                return 0
            except BaseException as error:
                atomic_json(STATE / 'last-run.json', {'status': 'failed', 'finishedAt': now(),
                                                     'recoveryPending': RECOVERY.exists()})
                reason = str(error) if isinstance(error, BackupError) else 'Internal failure; raw details suppressed'
                print('BACKUP_FAILED: ' + reason, flush=True)
                return 1
    except BaseException:
        print('BACKUP_FAILED: private storage or lock unavailable', flush=True)
        return 1

if __name__ == '__main__':
    raise SystemExit(main())
