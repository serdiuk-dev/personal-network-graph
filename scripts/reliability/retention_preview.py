#!/usr/bin/env python3
"""Metadata-only retention proposal. No deletion mode and no Docker calls."""
import fcntl
import json
import os
from pathlib import Path
import re
from datetime import datetime, timedelta, timezone
import backup as b
import monitor as m

KEEP_DAYS = 30
KEEP_LATEST = 14
NAME = re.compile(r'scheduled-db-media-([0-9]{8}T[0-9]{12}Z)')
PAYLOAD = {'database.dump', 'media.tar.gz', 'photo-hashes.json',
           'images.json', 'dump-catalogue.txt'}
FILES = PAYLOAD | {'manifest.json', 'sha256.json'}


def parse_time(value, now):
    m.age(value, now)  # Reject naive or materially future timestamps.
    return datetime.fromisoformat(value).astimezone(timezone.utc)


def inspect_set(folder, now):
    match = NAME.fullmatch(folder.name)
    if not match:
        raise ValueError('Unexpected set name')
    stamp = datetime.strptime(match[1], '%Y%m%dT%H%M%S%fZ').replace(tzinfo=timezone.utc)
    m.private(folder, directory=True)
    entries = list(folder.iterdir())
    if {p.name for p in entries} != FILES:
        raise ValueError('Unexpected backup contents')
    apparent = 0
    allocated = folder.stat().st_blocks * 512
    for path in entries:
        m.private(path)
        s = path.lstat()
        if s.st_nlink != 1 or s.st_size <= 0:
            raise ValueError('Empty or hardlinked backup entry')
        apparent += s.st_size
        allocated += s.st_blocks * 512
    manifest = m.read_json(folder / 'manifest.json')
    if manifest.get('format') != b.FORMAT or manifest.get('status') != 'success' or manifest.get('apiRecovered') is not True:
        raise ValueError('Incomplete backup manifest')
    checksums = manifest.get('checksums')
    if not isinstance(checksums, dict) or set(checksums) != PAYLOAD:
        raise ValueError('Unexpected checksum map')
    if not all(isinstance(v, str) and re.fullmatch('[0-9a-f]{64}', v) for v in checksums.values()):
        raise ValueError('Invalid checksum metadata')
    if m.read_json(folder / 'sha256.json') != checksums:
        raise ValueError('Checksum metadata differs')
    started = parse_time(manifest['startedAt'], now)
    finished = parse_time(manifest['finishedAt'], now)
    if not stamp <= started <= finished:
        raise ValueError('Inconsistent backup timestamps')
    return {'directory': folder.name, 'finishedAt': finished.isoformat(),
            'apparentBytes': apparent, 'allocatedBytes': allocated}


def select(records, protected, now):
    ordered = sorted(records, key=lambda r: (r['finishedAt'], r['directory']), reverse=True)
    if not ordered or protected not in {r['directory'] for r in ordered}:
        raise ValueError('Last-success set cannot be validated')
    cutoff = now - timedelta(days=KEEP_DAYS)
    keep, candidates = [], []
    for index, record in enumerate(ordered):
        reasons = []
        if index < KEEP_LATEST:
            reasons.append('latest_14')
        if parse_time(record['finishedAt'], now) >= cutoff:
            reasons.append('within_30_days')
        if record['directory'] == protected:
            reasons.append('last_success_pointer')
        if index == 0:
            reasons.append('newest_success')
        if reasons:
            keep.append(record | {'reasons': reasons})
        else:
            candidates.append(record)
    return keep, candidates


def preview(now):
    for name in ('recovery.json', 'deploy-recovery.json'):
        if os.path.lexists(b.STATE / name):
            raise ValueError('Recovery pending')
    pointer = m.read_json(b.STATE / 'last-success.json')
    protected = pointer.get('directory')
    if pointer.get('status') != 'success' or not isinstance(protected, str) or not NAME.fullmatch(protected):
        raise ValueError('Invalid last-success pointer')
    parse_time(pointer['finishedAt'], now)
    records = []
    exclusions = {'incomplete': 0, 'other_preserved': 0, 'invalid_scheduled': 0}
    for folder in sorted(b.ROOT.iterdir()):
        if folder.name == '.automation':
            continue
        if folder.name.startswith('.incomplete-scheduled-'):
            exclusions['incomplete'] += 1
            continue
        if not NAME.fullmatch(folder.name):
            exclusions['other_preserved'] += 1
            continue
        try:
            records.append(inspect_set(folder, now))
        except Exception:
            exclusions['invalid_scheduled'] += 1
    keep, candidates = select(records, protected, now)
    return {'status': 'preview', 'generatedAt': now.isoformat(),
            'deletionEnabled': False, 'integrityRehashed': False,
            'policy': {'keepDays': KEEP_DAYS, 'keepLatest': KEEP_LATEST},
            'keep': keep, 'candidatesOnly': candidates, 'excludedCounts': exclusions,
            'candidateAllocatedBytes': sum(r['allocatedBytes'] for r in candidates)}


def main():
    os.umask(0o077)
    try:
        if os.geteuid() != 0:
            raise ValueError('Root required')
        m.private(b.ROOT, directory=True)
        m.private(b.STATE, directory=True)
        path = b.STATE / 'backup.lock'
        m.private(path)
        fd = os.open(path, os.O_RDWR | os.O_NOFOLLOW)
        with os.fdopen(fd, 'a') as lock:
            fcntl.flock(lock, fcntl.LOCK_EX | fcntl.LOCK_NB)
            report = preview(datetime.now(timezone.utc))
            b.atomic_json(b.STATE / 'retention-preview.json', report)
        print('RETENTION_PREVIEW_OK: ' + json.dumps({
            'keep': len(report['keep']), 'candidates': len(report['candidatesOnly']),
            'excludedCounts': report['excludedCounts'], 'deletionEnabled': False}), flush=True)
        return 0
    except Exception:
        print('RETENTION_PREVIEW_FAILED: busy, pending recovery or invalid metadata; '
              'previous report may be stale; no deletion performed', flush=True)
        return 1


if __name__ == '__main__':
    raise SystemExit(main())
