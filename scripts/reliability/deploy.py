#!/usr/bin/env python3
"""Explicit local-image rollout with paired API/WEB rollback and backup lock."""
import argparse
import fcntl
import json
import os
from pathlib import Path
import re
import signal
import stat
import time
from datetime import datetime, timezone
import backup as b

PROJECT = Path('/opt/personal-network-graph')
AUTH_ENV = Path('/root/pnet-auth.env')
MARKER = b.STATE / 'deploy-recovery.json'
LAYERS = ['compose.yaml', 'compose.override.yaml', 'compose.auth.yaml', 'compose.media.yaml']


def compose(overlay=None):
    args = ['docker', 'compose', '-p', 'pnet', '--project-directory', str(PROJECT),
            '--profile', '*', '--env-file', str(PROJECT / '.env'),
            '--env-file', str(AUTH_ENV)]
    for name in LAYERS:
        args += ['-f', str(PROJECT / name)]
    if overlay:
        args += ['-f', str(overlay)]
    return args


def inputs():
    return {str(p): b.digest(p) for p in
            [*(PROJECT / name for name in LAYERS), PROJECT / '.env', AUTH_ENV]}


def validate_config(config, current):
    if config.get('name') != 'pnet':
        raise b.BackupError('Unexpected Compose project')
    services = config['services']
    api, web = services['api'], services['web']
    if api.get('restart') != 'unless-stopped' or web.get('restart') != 'unless-stopped':
        raise b.BackupError('Restart policy must remain unless-stopped')
    media = config['volumes']['contact_media']['name']
    db = config['volumes']['db_data']['name']
    if media != 'pnet_contact_media' or db != 'pnet_db_data':
        raise b.BackupError('Persistent volume name changed')
    if not any(v.get('source') == 'contact_media' and v.get('target') == '/app/private-media'
               for v in api.get('volumes', [])):
        raise b.BackupError('Missing private media mount')
    if any(v.get('source') == 'contact_media' for v in web.get('volumes', [])):
        raise b.BackupError('WEB must not mount private media')
    if not any(v.get('source') == 'pnet_auth_key' for v in api.get('secrets', [])):
        raise b.BackupError('Missing auth secret overlay')
    if config['secrets']['pnet_auth_key'].get('file') != '/opt/pnet-secrets/auth-key':
        raise b.BackupError('Auth key host path changed')
    wanted = api.get('environment', {})
    for key in ('PNET_PUBLIC_ORIGIN', 'PNET_AUTH_KEY_FILE', 'PNET_MEDIA_DIR', 'DATABASE_URL'):
        if not wanted.get(key) or wanted[key] != current.get(key):
            raise b.BackupError('Protected API configuration changed')
    for service in (api, web):
        hc = service.get('healthcheck', {})
        if hc.get('disable') or not hc.get('test'):
            raise b.BackupError('New API and WEB healthchecks required')


def prior_health(raw):
    if not raw or raw.get('Test', ['NONE']) == ['NONE']:
        return {'disable': True}
    result = {'disable': False, 'test': raw['Test']}
    for source, target in [('Interval', 'interval'), ('Timeout', 'timeout'),
                           ('StartPeriod', 'start_period'), ('StartInterval', 'start_interval')]:
        if raw.get(source):
            result[target] = str(raw[source]) + 'ns'
    if raw.get('Retries'):
        result['retries'] = raw['Retries']
    return result


def image_id(value):
    if not re.fullmatch(r'sha256:[0-9a-f]{64}', value):
        raise b.BackupError('Use an explicit local sha256 image ID')
    if b.run(['docker', 'image', 'inspect', '--format', '{{.Id}}', value]) != value:
        raise b.BackupError('Local image identity mismatch')
    return value


def wait_healthy(service, image):
    deadline = time.monotonic() + 150
    while time.monotonic() < deadline:
        item = b.inspect('pnet-' + service + '-1', service)
        state = item['state']
        if item['image'] != image:
            raise b.BackupError('Deployed image differs from selected image')
        if state.get('Running') and state.get('Health', {}).get('Status') == 'healthy':
            return
        time.sleep(2)
    raise b.BackupError('New healthcheck did not become healthy')


def verify_original_state(before):
    db = b.inspect(before['db']['id'], 'db')
    if b.fingerprint(db) != before['db']['fingerprint']:
        raise b.BackupError('Database container changed during deploy')
    for service in ('api', 'web'):
        item = b.inspect('pnet-' + service + '-1', service)
        if sorted(item['mounts'], key=lambda m: m['Destination']) != sorted(before[service]['mounts'], key=lambda m: m['Destination']):
            raise b.BackupError('API or WEB mount configuration changed')


def rollout(overlay, images):
    # Recreate WEB after API, so nginx resolves the new API container address.
    for service in ('api', 'web'):
        b.run(compose(overlay) + ['up', '-d', '--no-deps', '--no-build',
                                  '--pull', 'never', '--force-recreate', service], timeout=180)
        wait_healthy(service, images[service])


def rollback():
    if not MARKER.exists():
        return
    checkpoint = json.loads(MARKER.read_text())
    if inputs() != checkpoint['inputs']:
        raise b.BackupError('Deploy inputs changed; restore recorded configuration before recovery')
    for service in ('api', 'web'):
        image_id(checkpoint['before'][service]['image'])
        b.run(compose(checkpoint['rollbackOverlay']) + ['up', '-d', '--no-deps', '--no-build',
             '--pull', 'never', '--force-recreate', service], timeout=180)
        item = b.inspect('pnet-' + service + '-1', service)
        if item['image'] != checkpoint['before'][service]['image']:
            raise b.BackupError('Rollback image mismatch')
        if checkpoint['before'][service]['healthcheck'].get('disable'):
            if service == 'api':
                b.health(item['id'])
            else:
                b.run(['docker', 'exec', item['id'], 'sh', '-ec',
                       'wget -q -T 3 -O /dev/null http://127.0.0.1/ && '
                       'wget -q -T 3 -O - http://127.0.0.1/api/v1/health | '
                       'grep -Eq \'"service"[[:space:]]*:[[:space:]]*"pnet-api"\''], timeout=10)
        else:
            wait_healthy(service, checkpoint['before'][service]['image'])
    verify_original_state(checkpoint['before'])
    b.atomic_json(Path(checkpoint['directory']) / 'result.json',
                  {'status': 'rolled-back', 'finishedAt': b.now()})
    MARKER.unlink()
    b.sync_dir(b.STATE)


def deploy(api_image=None, web_image=None):
    if MARKER.exists() or b.RECOVERY.exists():
        raise b.BackupError('Pending recovery; deployment refused')
    services = {s: b.inspect('pnet-' + s + '-1', s) for s in ('api', 'web', 'db')}
    if not all(x['state']['Running'] and not x['state'].get('Paused')
               and not x['state'].get('Restarting') for x in services.values()):
        raise b.BackupError('Required containers are not running normally')
    if not b.mounted(services['api'], 'pnet_contact_media', '/app/private-media') or \
       not b.mounted(services['db'], 'pnet_db_data', '/var/lib/postgresql/data'):
        raise b.BackupError('Unexpected persistent volume mounts')
    current = dict(entry.split('=', 1) for entry in json.loads(b.run(
        ['docker', 'inspect', '--format', '{{json .Config.Env}}', services['api']['id']])))
    config = json.loads(b.run(compose() + ['config', '--format', 'json']))
    validate_config(config, current)  # Sensitive rendered values never leave this process.
    selected = {'api': image_id(api_image or services['api']['image']),
                'web': image_id(web_image or services['web']['image'])}
    b.run(['docker', 'exec', services['db']['id'], 'sh', '-ec',
           'exec psql -X -v ON_ERROR_STOP=1 -U "$POSTGRES_USER" -d "$POSTGRES_DB" -Atc "SELECT 1"'])
    stamp = datetime.now(timezone.utc).strftime('%Y%m%dT%H%M%S%fZ')
    folder = b.STATE / ('deploy-' + stamp)
    folder.mkdir(mode=0o700)
    old = {}
    for service in ('api', 'web'):
        item = services[service]
        hc = json.loads(b.run(['docker', 'inspect', '--format', '{{json .Config.Healthcheck}}', item['id']]))
        old[service] = {'image': item['image'], 'healthcheck': prior_health(hc), 'mounts': item['mounts']}
    old['db'] = {'id': services['db']['id'], 'fingerprint': b.fingerprint(services['db'])}
    target = folder / 'target.json'
    previous = folder / 'rollback.json'
    b.atomic_json(target, {'services': {s: {'image': i} for s, i in selected.items()}})
    b.atomic_json(previous, {'services': {s: {'image': old[s]['image'],
                                             'healthcheck': old[s]['healthcheck']} for s in ('api', 'web')}})
    checkpoint = {'directory': str(folder), 'startedAt': b.now(), 'before': old,
                  'selected': selected, 'inputs': inputs(), 'rollbackOverlay': str(previous)}
    b.atomic_json(folder / 'checkpoint.json', checkpoint)
    b.atomic_json(MARKER, checkpoint)
    try:
        rollout(target, selected)
        verify_original_state(old)
        if inputs() != checkpoint['inputs']:
            raise b.BackupError('Deploy inputs changed during rollout')
        b.atomic_json(folder / 'result.json', {'status': 'success', 'finishedAt': b.now()})
        MARKER.unlink()
        b.sync_dir(b.STATE)
    except BaseException:
        try:
            rollback()
            print('DEPLOY_ROLLBACK_OK', flush=True)
        except BaseException:
            print('DEPLOY_RECOVERY_PENDING: private marker retained', flush=True)
        raise b.BackupError('Deploy failed; rollback attempted')


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument('--expected-head', required=True)
    actions = parser.add_mutually_exclusive_group(required=True)
    actions.add_argument('--apply-current', action='store_true')
    actions.add_argument('--recover', action='store_true')
    actions.add_argument('--api-image')
    parser.add_argument('--web-image')
    args = parser.parse_args()
    os.umask(0o077)
    try:
        if os.geteuid() != 0 or b.run(['git', '-C', str(PROJECT), 'rev-parse', 'HEAD']) != args.expected_head:
            raise b.BackupError('Root and expected Git HEAD required')
        if bool(args.api_image) != bool(args.web_image):
            raise b.BackupError('Specify both approved local images')
        for p in (PROJECT / '.env', AUTH_ENV):
            s = p.lstat()
            if not stat.S_ISREG(s.st_mode) or s.st_uid != 0 or stat.S_IMODE(s.st_mode) != 0o600:
                raise b.BackupError('Deployment env files must be root-owned mode 0600')
        b.private_dir(b.ROOT)
        b.private_dir(b.STATE)
        fd = os.open(b.STATE / 'backup.lock', os.O_CREAT | os.O_RDWR | os.O_NOFOLLOW, 0o600)
        with os.fdopen(fd, 'a') as lock:
            try:
                fcntl.flock(lock, fcntl.LOCK_EX | fcntl.LOCK_NB)
            except BlockingIOError:
                raise b.BackupError('Backup or deploy is already running')
            signal.signal(signal.SIGTERM, b.interrupted)
            signal.signal(signal.SIGINT, b.interrupted)
            if args.recover:
                rollback()
                print('DEPLOY_RECOVERY_OK', flush=True)
            else:
                deploy(args.api_image, args.web_image)
                print('DEPLOY_OK: API_WEB_HEALTHY_DB_UNCHANGED', flush=True)
        return 0
    except BaseException as error:
        message = str(error) if isinstance(error, b.BackupError) else 'Internal failure; raw details suppressed'
        print('DEPLOY_FAILED: ' + message, flush=True)
        return 1

if __name__ == '__main__':
    raise SystemExit(main())
