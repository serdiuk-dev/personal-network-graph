#!/usr/bin/env python3
"""Retention-only tests with synthetic files; no production backup access."""
from datetime import datetime, timedelta, timezone
import fcntl
import hashlib
import json
import os
from pathlib import Path
import stat
import tempfile
import unittest
from unittest.mock import patch
import retention_preview as r


class RetentionTests(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory()
        self.addCleanup(self.temp.cleanup)
        self.root = Path(self.temp.name)
        self.state = self.root / '.automation'
        self.state.mkdir(mode=0o700)
        (self.state / 'backup.lock').touch(mode=0o600)
        self.now = datetime(2026, 10, 2, 19, tzinfo=timezone.utc)
        for attr, value in [('ROOT', self.root), ('STATE', self.state)]:
            p = patch.object(r.b, attr, value)
            p.start()
            self.addCleanup(p.stop)
        original = Path.lstat
        def test_lstat(path):
            raw = original(path)
            values = list(raw)
            values[4] = 0
            return os.stat_result(values, {'st_blocks': raw.st_blocks})
        p = patch.object(Path, 'lstat', test_lstat)
        p.start()
        self.addCleanup(p.stop)

    def write(self, path, value):
        path.write_text(json.dumps(value))
        path.chmod(0o600)

    def add_set(self, days):
        started = self.now - timedelta(days=days)
        finished = started + timedelta(seconds=1)
        folder = self.root / ('scheduled-db-media-' + started.strftime('%Y%m%dT%H%M%S%fZ'))
        folder.mkdir(mode=0o700)
        sums = {}
        for name in r.PAYLOAD:
            p = folder / name
            p.write_bytes(b'synthetic fixture')
            p.chmod(0o600)
            sums[name] = hashlib.sha256(p.read_bytes()).hexdigest()
        self.write(folder / 'sha256.json', sums)
        self.write(folder / 'manifest.json', {
            'format': 'pnet-db-media-v1', 'status': 'success', 'apiRecovered': True,
            'checksums': sums, 'startedAt': started.isoformat(), 'finishedAt': finished.isoformat()})
        return folder

    def point_to(self, folder):
        self.write(self.state / 'last-success.json', {
            'status': 'success', 'directory': folder.name, 'finishedAt': self.now.isoformat()})

    def test_all_recent_and_minimum_14_old_sets_are_preserved(self):
        newest = self.add_set(1)
        self.point_to(newest)
        for days in range(2, 41):
            self.add_set(days)
        report = r.preview(self.now)
        self.assertEqual(len(report['keep']), 30)
        self.assertEqual(len(report['candidatesOnly']), 10)
        report = r.preview(self.now + timedelta(days=100))
        self.assertEqual(len(report['keep']), 14)
        self.assertEqual(len(report['candidatesOnly']), 26)
        self.assertFalse(report['deletionEnabled'])

    def test_old_last_success_pointer_and_newest_are_both_protected(self):
        folders = [self.add_set(days) for days in range(40, 60)]
        self.point_to(folders[-1])
        report = r.preview(self.now)
        names = {x['directory'] for x in report['keep']}
        self.assertIn(folders[-1].name, names)
        self.assertIn(folders[0].name, names)
        self.assertEqual(len(names), 15)

    def test_manual_incomplete_unknown_and_symlink_sets_are_preserved(self):
        self.point_to(self.add_set(1))
        (self.root / 'manual-release').mkdir()
        (self.root / '.incomplete-scheduled-test').mkdir()
        (self.root / 'unknown').symlink_to('/not-read')
        name = 'scheduled-db-media-20260101T000000000000Z'
        (self.root / name).symlink_to('/not-read')
        report = r.preview(self.now)
        self.assertEqual(report['excludedCounts'], {
            'incomplete': 1, 'other_preserved': 2, 'invalid_scheduled': 1})

    def test_invalid_pointer_or_target_aborts_whole_preview(self):
        folder = self.add_set(1)
        self.point_to(folder)
        (folder / 'database.dump').chmod(0o644)
        with self.assertRaises(ValueError):
            r.preview(self.now)
        self.write(self.state / 'last-success.json', {'status': 'success', 'directory': '../escape'})
        with self.assertRaises(ValueError):
            r.preview(self.now)

    def test_malformed_metadata_future_time_and_extra_files_are_excluded(self):
        self.point_to(self.add_set(1))
        old = self.add_set(60)
        cases = ['bad map', 'future time', 'extra file']
        original = (old / 'manifest.json').read_text()
        for case in cases:
            with self.subTest(case=case):
                manifest = json.loads(original)
                if case == 'bad map':
                    manifest['checksums']['media.tar.gz'] = '0' * 64
                elif case == 'future time':
                    manifest['finishedAt'] = (self.now + timedelta(days=1)).isoformat()
                else:
                    (old / 'extra').touch(mode=0o600)
                self.write(old / 'manifest.json', manifest)
                self.assertEqual(r.preview(self.now)['excludedCounts']['invalid_scheduled'], 1)

    def test_linked_payload_is_excluded_without_reading_target(self):
        self.point_to(self.add_set(1))
        old = self.add_set(60)
        payload = old / 'database.dump'
        payload.unlink()
        payload.symlink_to('/not-read')
        self.assertEqual(r.preview(self.now)['excludedCounts']['invalid_scheduled'], 1)
        payload.unlink()
        os.link(old / 'media.tar.gz', payload)
        self.assertEqual(r.preview(self.now)['excludedCounts']['invalid_scheduled'], 1)

    def test_pending_recovery_and_busy_lock_do_not_publish(self):
        self.point_to(self.add_set(1))
        with patch.object(r.os, 'geteuid', return_value=0):
            with (self.state / 'backup.lock').open('a') as lock:
                fcntl.flock(lock, fcntl.LOCK_EX | fcntl.LOCK_NB)
                self.assertEqual(r.main(), 1)
            (self.state / 'deploy-recovery.json').symlink_to('/not-read')
            self.assertEqual(r.main(), 1)
        self.assertFalse((self.state / 'retention-preview.json').exists())

    def test_private_report_and_no_backup_changes_or_docker_calls(self):
        folder = self.add_set(1)
        self.point_to(folder)
        before = {p.name: (p.read_bytes(), p.stat().st_mode) for p in folder.iterdir()}
        pointer = (self.state / 'last-success.json').read_bytes()
        with patch.object(r.os, 'geteuid', return_value=0), \
             patch.object(r, 'datetime', wraps=datetime) as clock, \
             patch.object(r.b, 'run', side_effect=AssertionError('No commands allowed')):
            clock.now.return_value = self.now
            self.assertEqual(r.main(), 0)
        report = self.state / 'retention-preview.json'
        self.assertEqual(stat.S_IMODE(report.stat().st_mode), 0o600)
        self.assertFalse(json.loads(report.read_text())['deletionEnabled'])
        self.assertEqual(before, {p.name: (p.read_bytes(), p.stat().st_mode) for p in folder.iterdir()})
        self.assertEqual(pointer, (self.state / 'last-success.json').read_bytes())


if __name__ == '__main__':
    unittest.main()
