#!/usr/bin/env python3
"""Synthetic metadata and fake commands only; never access production."""
from datetime import datetime, timedelta, timezone
import fcntl
import json
import os
from pathlib import Path
import stat
import tempfile
import unittest
from unittest.mock import patch
import monitor as m


class MonitorTests(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory()
        self.addCleanup(self.temp.cleanup)
        self.root = Path(self.temp.name)
        self.state = self.root / '.automation'
        self.state.mkdir(mode=0o700)
        self.now = datetime(2026, 10, 2, 17, tzinfo=timezone.utc)
        self.finished = self.now - timedelta(hours=2)
        self.name = 'scheduled-db-media-20261002T150000000000Z'
        self.folder = self.root / self.name
        self.folder.mkdir(mode=0o700)
        for key, value in [('ROOT', self.root), ('STATE', self.state)]:
            p = patch.object(m, key, value)
            p.start()
            self.addCleanup(p.stop)
        # Production requires UID 0; allow this test runner's UID in lstat only.
        original = Path.lstat
        def synthetic_lstat(path):
            result = original(path)
            values = list(result)
            values[4] = 0
            return os.stat_result(values)
        p = patch.object(Path, 'lstat', synthetic_lstat)
        p.start()
        self.addCleanup(p.stop)
        self.write(self.state / 'last-success.json', {
            'status': 'success', 'directory': self.name, 'finishedAt': self.finished.isoformat()})
        self.write(self.state / 'last-run.json', {'status': 'success', 'finishedAt': self.finished.isoformat()})
        self.write(self.folder / 'manifest.json', {'format': 'pnet-db-media-v1',
            'status': 'success', 'apiRecovered': True, 'finishedAt': self.finished.isoformat()})
        for name in ('database.dump', 'media.tar.gz'):
            p = self.folder / name
            p.write_bytes(b'synthetic')
            p.chmod(0o600)
        p = self.state / 'backup.lock'
        p.touch(mode=0o600)
        self.units = {'LoadState': 'loaded', 'ActiveState': 'active',
                      'UnitFileState': 'enabled', 'Result': 'success'}
        self.unit_patch = patch.object(m, 'unit', return_value=self.units)
        self.unit_patch.start()
        self.addCleanup(self.unit_patch.stop)
        self.container_patch = patch.object(m, 'container', return_value=True)
        self.inspect = self.container_patch.start()
        self.addCleanup(self.container_patch.stop)

    def write(self, path, value):
        path.write_text(json.dumps(value))
        path.chmod(0o600)

    def evaluate(self, busy=False, previous=None):
        return m.evaluate(self.now, busy, previous or {})

    def test_valid_current_set_is_ok_and_report_is_private(self):
        report = self.evaluate()
        self.assertEqual(report['status'], 'ok')
        m.publish(report)
        p = self.state / 'monitor-status.json'
        self.assertEqual(stat.S_IMODE(p.stat().st_mode), 0o600)
        self.assertEqual(json.loads(p.read_text())['backupAgeSeconds'], 7200)

    def test_old_manifest_cannot_be_refreshed_by_success_pointer(self):
        manifest = json.loads((self.folder / 'manifest.json').read_text())
        manifest['finishedAt'] = (self.now - timedelta(hours=27)).isoformat()
        self.write(self.folder / 'manifest.json', manifest)
        self.assertIn('BACKUP_STALE', self.evaluate()['alerts'])

    def test_failed_run_recovery_and_unhealthy_are_visible(self):
        self.write(self.state / 'last-run.json', {'status': 'failed', 'finishedAt': self.finished.isoformat()})
        (self.state / 'recovery.json').touch()
        (self.state / 'deploy-recovery.json').symlink_to(self.state / 'missing')
        self.inspect.return_value = False
        alerts = self.evaluate()['alerts']
        for code in ('LAST_BACKUP_RUN_FAILED', 'BACKUP_RECOVERY_PENDING',
                     'DEPLOY_RECOVERY_PENDING', 'API_NOT_READY', 'WEB_NOT_READY', 'DB_NOT_READY'):
            self.assertIn(code, alerts)

    def test_busy_defers_health_but_not_staleness_or_timer(self):
        self.units['ActiveState'] = 'inactive'
        self.now += timedelta(hours=27)
        report = self.evaluate(True)
        self.inspect.assert_not_called()
        self.assertIn('BACKUP_STALE', report['alerts'])
        self.assertIn('BACKUP_TIMER_NOT_ENABLED_ACTIVE', report['alerts'])

    def test_busy_expires_and_clears_after_operation(self):
        self.assertEqual(self.evaluate(True)['status'], 'busy')
        previous = {'busySince': (self.now - timedelta(minutes=31)).isoformat()}
        self.assertIn('BACKUP_OR_DEPLOY_BUSY_TOO_LONG', self.evaluate(True, previous)['alerts'])
        self.assertNotIn('busySince', self.evaluate(False, previous))

    def test_missing_corrupt_or_future_metadata_is_not_ok(self):
        for value in ('not-json', json.dumps({'status': 'success', 'directory': '../escape'}),
                      json.dumps({'status': 'success', 'directory': self.name,
                                  'finishedAt': (self.now + timedelta(hours=1)).isoformat()})):
            with self.subTest(value=value):
                (self.state / 'last-success.json').write_text(value)
                self.assertIn('BACKUP_METADATA_INVALID_OR_MISSING', self.evaluate()['alerts'])

    def test_artifact_symlink_and_public_permissions_are_rejected(self):
        artifact = self.folder / 'database.dump'
        artifact.chmod(0o644)
        self.assertEqual(self.evaluate()['status'], 'alert')
        artifact.unlink()
        artifact.symlink_to(self.folder / 'media.tar.gz')
        self.assertEqual(self.evaluate()['status'], 'alert')

    def test_failed_unit_and_inspection_are_visible_without_raw_output(self):
        self.units['Result'] = 'exit-code'
        self.inspect.side_effect = RuntimeError('SENSITIVE_TEST_STRING')
        report = self.evaluate()
        self.assertIn('BACKUP_SERVICE_FAILED', report['alerts'])
        self.assertIn('API_INSPECTION_FAILED', report['alerts'])
        self.assertNotIn('SENSITIVE_TEST_STRING', json.dumps(report))

    def test_real_flock_is_observed_without_taking_backup_lock(self):
        self.assertFalse(m.shared_busy())
        with (self.state / 'backup.lock').open('a') as lock:
            fcntl.flock(lock, fcntl.LOCK_EX | fcntl.LOCK_NB)
            self.assertTrue(m.shared_busy())
        self.assertFalse(m.shared_busy())

    def test_main_publishes_ok_then_failure_exit_code(self):
        with patch.object(m.os, 'geteuid', return_value=0), patch.object(m, 'datetime', wraps=datetime) as clock:
            clock.now.return_value = self.now
            self.assertEqual(m.main(), 0)
            self.units['Result'] = 'exit-code'
            self.assertEqual(m.main(), 1)
        self.assertEqual(json.loads((self.state / 'monitor-status.json').read_text())['status'], 'alert')

    def test_container_identity_and_health_selection(self):
        self.container_patch.stop()
        labels = {'com.docker.compose.project': 'pnet', 'com.docker.compose.service': 'api'}
        def raw(health):
            return '\n'.join(map(json.dumps, [labels, True, False, False, health]))
        with patch.object(m, 'command', return_value=raw('healthy')):
            self.assertTrue(m.container('api'))
        with patch.object(m, 'command', return_value=raw('unhealthy')):
            self.assertFalse(m.container('api'))
        labels['com.docker.compose.project'] = 'another-project'
        with patch.object(m, 'command', return_value=raw('healthy')):
            with self.assertRaises(ValueError):
                m.container('api')


if __name__ == '__main__':
    unittest.main()
