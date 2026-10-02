#!/usr/bin/env python3
"""New automation tests with fake Docker only; no production DB or media."""
import contextlib
import fcntl
import importlib.util
import io
import json
import os
from pathlib import Path
import subprocess
import tarfile
import tempfile
import sys
import unittest
from unittest.mock import patch

spec = importlib.util.spec_from_file_location('pnet_backup', Path(__file__).with_name('backup.py'))
b = importlib.util.module_from_spec(spec)
spec.loader.exec_module(b)

class BackupTests(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory()
        self.addCleanup(self.temp.cleanup)
        root = Path(self.temp.name)
        self.root, self.state = root, root / '.automation'
        self.state.mkdir(mode=0o700)
        for key, value in [('ROOT', root), ('STATE', self.state),
                           ('RECOVERY', self.state / 'recovery.json'),
                           ('STAGING_OWNER', (os.getuid(), os.getgid()))]:
            p = patch.object(b, key, value)
            p.start()
            self.addCleanup(p.stop)
        self.running = True
        self.stopped = False
        self.fail = None
        self.states = {}
        for s in ('api', 'db', 'web'):
            self.states[s] = {'id': s, 'image': 'image-' + s,
                'state': {'Running': True, 'StartedAt': 'before', 'RestartCount': 0},
                'mounts': []}
        self.states['api']['mounts'] = [{'Type': 'volume', 'Name': 'pnet_contact_media',
                                        'Destination': '/app/private-media'}]
        self.states['db']['mounts'] = [{'Type': 'volume', 'Name': 'pnet_db_data',
                                       'Destination': '/var/lib/postgresql/data'}]
        for key, fn in [('run', self.fake_run), ('inspect', self.fake_inspect),
                        ('health', lambda cid: None)]:
            p = patch.object(b, key, side_effect=fn)
            p.start()
            self.addCleanup(p.stop)
        p = patch.object(b.subprocess, 'run', return_value=subprocess.CompletedProcess([], 0))
        p.start()
        self.addCleanup(p.stop)
        p = patch.object(b.time, 'sleep')
        p.start()
        self.addCleanup(p.stop)

    def fake_inspect(self, cid, service):
        value = json.loads(json.dumps(self.states[service]))
        if service == 'api':
            value['state']['Running'] = self.running
        return value

    def fake_run(self, args, *, output=None, timeout=120):
        action = args[1]
        if action == 'ps':
            return 'api' if 'volume=pnet_contact_media' in args else 'db'
        if action == 'stop':
            self.stopped = True
            self.running = False
            if self.fail == 'stop':
                raise b.BackupError('stop interrupted')
        if action == 'start':
            if self.fail == 'start':
                raise b.BackupError('start failed')
            self.running = True
        if action == 'exec':
            if output is None:
                if self.fail == 'metadata' and 'node' in args:
                    raise b.BackupError('source metadata rejected')
                return '4096'
            if self.fail == 'dump':
                raise b.BackupError('dump failed')
            if self.fail == 'signal':
                raise KeyboardInterrupt()
            output.write(b'PGDMP' + b'fake-payload')
        if action == 'cp':
            if self.fail == 'copy':
                raise b.BackupError('copy failed')
            media = Path(args[-1])
            media.mkdir(mode=0o700)
            p = media / 'fixture.webp'
            p.write_bytes(b'fake-media')
            p.chmod(0o600)
        return ''

    def test_success_is_paired_private_and_published_only_after_recovery(self):
        name = b.backup()
        self.assertTrue(self.stopped and self.running)
        self.assertFalse(b.RECOVERY.exists())
        final = self.root / name
        manifest = json.loads((final / 'manifest.json').read_text())
        self.assertEqual(manifest['status'], 'success')
        self.assertFalse(manifest['restoreTested'])
        for filename, digest in manifest['checksums'].items():
            self.assertEqual(b.digest(final / filename), digest)
        self.assertEqual(final.stat().st_mode & 0o777, 0o700)
        for p in final.iterdir():
            self.assertEqual(p.stat().st_mode & 0o777, 0o600)
        self.assertFalse((final / 'media').exists())
        with tarfile.open(final / 'media.tar.gz') as archive:
            photo = archive.getmember('./fixture.webp')
            self.assertEqual((photo.uid, photo.gid, photo.mode), (*b.MEDIA_OWNER, 0o600))

    def test_invalid_source_metadata_is_rejected_before_stop(self):
        self.fail = 'metadata'
        with self.assertRaises(b.BackupError):
            b.backup()
        self.assertFalse(self.stopped)
        self.assertTrue(self.running)
        self.assertFalse(b.RECOVERY.exists())

    def test_archive_uses_container_owner_without_chowning_staging(self):
        media = self.root / 'root-staging'
        media.mkdir(mode=0o700)
        photo = media / 'fixture.webp'
        photo.write_bytes(b'fake-media')
        photo.chmod(0o600)
        before = [(p.stat().st_uid, p.stat().st_gid) for p in (media, photo)]
        dest = self.root / 'owner-check.tar.gz'
        b.pack_media(media, dest)
        self.assertEqual(before, [(p.stat().st_uid, p.stat().st_gid) for p in (media, photo)])
        with tarfile.open(dest) as archive:
            for member in archive:
                self.assertEqual((member.uid, member.gid), (1000, 1000))
                self.assertEqual((member.uname, member.gname), ('', ''))

    def test_stop_dump_copy_and_signal_failures_resume_api_without_publishing(self):
        for failure in ('stop', 'dump', 'copy', 'signal'):
            with self.subTest(failure=failure):
                self.fail = failure
                with self.assertRaises(b.BackupError):
                    b.backup()
                self.assertTrue(self.running)
                self.assertFalse(b.RECOVERY.exists())
                self.assertFalse(list(self.root.glob('scheduled-db-media-*')))

    def test_failed_restart_keeps_recovery_marker(self):
        self.fail = 'start'
        with self.assertRaises(b.BackupError):
            b.backup()
        self.assertFalse(self.running)
        self.assertTrue(b.RECOVERY.exists())
        self.assertFalse(list(self.root.glob('scheduled-db-media-*')))

    def test_crash_marker_recovers_same_container(self):
        self.running = False
        b.atomic_json(b.RECOVERY, {'id': 'api', 'image': 'image-api'})
        b.recover()
        self.assertTrue(self.running)
        self.assertFalse(b.RECOVERY.exists())

    def test_recovery_refuses_changed_image(self):
        self.running = False
        b.atomic_json(b.RECOVERY, {'id': 'api', 'image': 'wrong-image'})
        with self.assertRaises(b.BackupError):
            b.recover()
        self.assertFalse(self.running)
        self.assertTrue(b.RECOVERY.exists())

    def test_archive_failure_occurs_after_api_recovery(self):
        with patch.object(b, 'pack_media', side_effect=b.BackupError('archive failed')):
            with self.assertRaises(b.BackupError):
                b.backup()
        self.assertTrue(self.running)
        self.assertFalse(list(self.root.glob('scheduled-db-media-*')))

    def test_parallel_run_fails_before_docker(self):
        with (self.state / 'backup.lock').open('a') as lock:
            fcntl.flock(lock, fcntl.LOCK_EX | fcntl.LOCK_NB)
            with contextlib.redirect_stdout(io.StringIO()), patch.object(b.signal, 'signal'), patch.object(sys, 'argv', ['backup.py']):
                self.assertEqual(b.main(), 1)
        self.assertFalse(self.stopped)

    def test_preexisting_stopped_api_is_not_started(self):
        self.running = False
        with self.assertRaises(b.BackupError):
            b.backup()
        self.assertFalse(self.stopped)
        self.assertFalse(self.running)
        self.assertFalse(b.RECOVERY.exists())

    def test_media_symlinks_are_rejected(self):
        media = self.root / 'media-fixture'
        media.mkdir(mode=0o700)
        (media / 'link').symlink_to('/etc/passwd')
        with self.assertRaises(b.BackupError):
            b.pack_media(media, self.root / 'bad.tar.gz')

if __name__ == '__main__':
    os.umask(0o077)
    unittest.main()
