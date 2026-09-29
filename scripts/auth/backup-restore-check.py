#!/usr/bin/env python3
"""Pre-v0.41 backup and isolated restore gate; no production migration/deploy."""
import hashlib
import json
import os
from pathlib import Path
import subprocess
import time
from datetime import datetime, timezone

os.umask(0o077)
compose = ['docker', 'compose', '--profile', '*']
expected = 'cd2bc1404cc3e7e607ea3a5cdefb301e8b32f7fe'

def capture(args):
    result = subprocess.run(args, capture_output=True, text=True)
    if result.returncode:
        raise RuntimeError('Command failed; raw output suppressed to protect deployment data.')
    return result.stdout.strip()

def inspect_services():
    state = {}
    for service in ('api', 'db', 'web'):
        ids = capture(compose + ['ps', '-aq', service]).split()
        if len(ids) != 1:
            raise RuntimeError(f'{service}: expected one container')
        item = json.loads(capture(['docker', 'inspect', ids[0]]))[0]
        if item['State']['Status'] != 'running':
            raise RuntimeError(f'{service}: not running')
        if service == 'db' and item['State'].get('Health', {}).get('Status') != 'healthy':
            raise RuntimeError('Database not healthy')
        state[service] = {
            'id': item['Id'], 'image': item['Image'],
            'startedAt': item['State']['StartedAt'], 'restartCount': item['RestartCount'],
        }
    return state

def source_sql(sql):
    return capture(compose + ['exec', '-T', 'db', 'sh', '-ec',
        'exec psql -X -v ON_ERROR_STOP=1 -U "$POSTGRES_USER" -d "$POSTGRES_DB" -Atc "$1"',
        'sh', sql])

name = None
started = False
try:
    if os.geteuid() != 0:
        raise RuntimeError('Run on VPS as root; backup requires a private root-owned directory.')
    for args in (['branch', '--show-current'], ['status', '--short'], ['show', '--no-patch', '--decorate', '--oneline', 'HEAD']):
        print(capture(['git'] + args), flush=True)
    if capture(['git', 'branch', '--show-current']) != 'feature/security-auth-baseline':
        raise RuntimeError('Unexpected branch')
    for ref in ('HEAD', 'origin/main', 'v0.40.0^{}'):
        if capture(['git', 'rev-parse', ref]) != expected:
            raise RuntimeError('Unexpected Git baseline')
    capture(['git', 'diff', '--check'])
    before = inspect_services()
    if source_sql('SELECT to_regclass(\'public."Owner"\') IS NULL') != 't':
        raise RuntimeError('Owner table already exists; reassess migration state first.')
    migrations_sql = 'SELECT migration_name FROM "_prisma_migrations" WHERE finished_at IS NOT NULL AND rolled_back_at IS NULL ORDER BY migration_name'
    migrations = source_sql(migrations_sql)
    if len(migrations.splitlines()) != 9:
        raise RuntimeError('Unexpected completed migration count')
    stamp = datetime.now(timezone.utc).strftime('%Y%m%dT%H%M%S%fZ')
    folder = Path('/root/pnet-backups') / ('pre-v041-' + stamp)
    folder.mkdir(parents=True, mode=0o700, exist_ok=False)
    archive = folder / 'database.dump'
    log = folder / 'private-backup-restore.log'
    with archive.open('xb') as dump, log.open('xb') as errors:
        result = subprocess.run(compose + ['exec', '-T', 'db', 'sh', '-ec',
            'exec pg_dump -U "$POSTGRES_USER" -d "$POSTGRES_DB" --format=custom'],
            stdout=dump, stderr=errors)
        dump.flush()
        os.fsync(dump.fileno())
    if result.returncode or archive.stat().st_size < 5:
        raise RuntimeError('Backup failed; private logs retained on VPS.')
    with archive.open('rb') as stream:
        if stream.read(5) != b'PGDMP':
            raise RuntimeError('Invalid dump header')
    with archive.open('rb') as stream:
        digest = hashlib.file_digest(stream, 'sha256').hexdigest()
    (folder / 'database.dump.sha256').write_text(digest + '  database.dump\n')
    print('BACKUP_CREATED: ' + str(archive), flush=True)
    # Exact production PostgreSQL image, no network, no ports, no persistent volume.
    # Trust applies only to this network-isolated temporary restore container.
    name = 'pnet-auth-restore-' + stamp.lower()
    capture(['docker', 'run', '-d', '--name', name, '--network', 'none',
        '--tmpfs', '/var/lib/postgresql/data',
        '-e', 'POSTGRES_USER=pnet_restore', '-e', 'POSTGRES_DB=pnet_restore',
        '-e', 'POSTGRES_HOST_AUTH_METHOD=trust', before['db']['image']])
    started = True
    for attempt in range(45):
        ready = subprocess.run(['docker', 'exec', name, 'pg_isready', '-h', '127.0.0.1', '-U', 'pnet_restore', '-d', 'pnet_restore'], stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
        if ready.returncode == 0:
            break
        if attempt == 44:
            raise RuntimeError('Isolated restore database did not become ready')
        time.sleep(1)
    with archive.open('rb') as dump, log.open('ab') as errors:
        result = subprocess.run(['docker', 'exec', '-i', name, 'pg_restore',
            '--exit-on-error', '--no-owner', '--no-privileges',
            '-U', 'pnet_restore', '-d', 'pnet_restore'], stdin=dump, stdout=errors, stderr=errors)
    if result.returncode:
        raise RuntimeError('Restore failed; private logs retained on VPS.')
    restored = capture(['docker', 'exec', name, 'psql', '-X', '-v', 'ON_ERROR_STOP=1',
        '-U', 'pnet_restore', '-d', 'pnet_restore', '-Atc', migrations_sql])
    if restored != migrations:
        raise RuntimeError('Restored migration history differs')
    capture(['docker', 'stop', '--time', '10', name])
    started = False
    after = inspect_services()
    if after != before:
        raise RuntimeError('Production containers changed during backup/restore')
    rollback = {}
    for service in ('api', 'web'):
        tag = f'pnet-{service}:pre-v041-{stamp.lower()}'
        capture(['docker', 'image', 'tag', before[service]['image'], tag])
        rollback[service] = tag
    checkpoint = {
        'baseline': expected, 'createdAt': stamp, 'containers': before,
        'backup': str(archive), 'backupSha256': digest,
        'restoreVerified': True, 'restoreContainer': name, 'rollback': rollback,
    }
    (folder / 'checkpoint.json').write_text(json.dumps(checkpoint, indent=2) + '\n')
    print('CHECKPOINT: ' + str(folder / 'checkpoint.json'), flush=True)
    print('RESTORE_VERIFIED\nAPI_DB_WEB_UNCHANGED\nV041_BACKUP_GATE_OK', flush=True)
except Exception as error:
    print('STOP: ' + str(error), flush=True)
    raise SystemExit(1)
finally:
    if started and name:
        result = subprocess.run(['docker', 'stop', '--time', '10', name], stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
        if result.returncode:
            print('STOP: could not stop isolated restore container ' + name, flush=True)
