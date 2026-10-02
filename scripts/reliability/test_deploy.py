#!/usr/bin/env python3
"""Targeted rollout tests; fake Docker and no production access."""
import copy
import fcntl
import importlib.util
import json
import os
from pathlib import Path
import subprocess
import sys
import tempfile
import unittest
from unittest.mock import patch

spec = importlib.util.spec_from_file_location('pnet_deploy', Path(__file__).with_name('deploy.py'))
d = importlib.util.module_from_spec(spec)
spec.loader.exec_module(d)
b = d.b

class DeployTests(unittest.TestCase):
    def setUp(self):
        self.tmp = tempfile.TemporaryDirectory()
        self.addCleanup(self.tmp.cleanup)
        self.root = Path(self.tmp.name)
        self.state = self.root / '.automation'
        self.state.mkdir(mode=0o700)
        for obj, key, value in [(b, 'ROOT', self.root), (b, 'STATE', self.state),
                (b, 'RECOVERY', self.state / 'recovery.json'),
                (d, 'MARKER', self.state / 'deploy-recovery.json'),
                (d, 'PROJECT', self.root), (d, 'AUTH_ENV', self.root / 'auth.env')]:
            p = patch.object(obj, key, value)
            p.start()
            self.addCleanup(p.stop)
        for name in [*d.LAYERS, '.env', 'auth.env']:
            p = self.root / name
            p.write_text('fixture')
            p.chmod(0o600)
        self.old_api = 'sha256:' + 'a' * 64
        self.old_web = 'sha256:' + 'b' * 64
        self.new_api = 'sha256:' + 'c' * 64
        self.new_web = 'sha256:' + 'd' * 64
        self.env = {'PNET_PUBLIC_ORIGIN': 'https://example.invalid',
                    'PNET_AUTH_KEY_FILE': '/run/secrets/pnet_auth_key',
                    'PNET_MEDIA_DIR': '/app/private-media', 'DATABASE_URL': 'private-fixture'}
        self.config = {'name': 'pnet', 'services': {
            'api': {'restart': 'unless-stopped', 'environment': self.env,
                'volumes': [{'source': 'contact_media', 'target': '/app/private-media'}],
                'secrets': [{'source': 'pnet_auth_key'}], 'healthcheck': {'test': ['CMD', 'node']}},
            'web': {'restart': 'unless-stopped', 'healthcheck': {'test': ['CMD', 'wget']}}},
            'volumes': {'contact_media': {'name': 'pnet_contact_media'}, 'db_data': {'name': 'pnet_db_data'}},
            'secrets': {'pnet_auth_key': {'file': '/opt/pnet-secrets/auth-key'}}}
        self.items = {s: {'id': s, 'image': image, 'state': {'Running': True, 'StartedAt': 'initial'},
                'mounts': [], 'restartCount': 0} for s, image in
                [('api', self.old_api), ('web', self.old_web), ('db', 'sha256:' + 'e' * 64)]}
        self.items['api']['mounts'] = [{'Type': 'volume', 'Name': 'pnet_contact_media',
                                      'Destination': '/app/private-media'}]
        self.items['db']['mounts'] = [{'Type': 'volume', 'Name': 'pnet_db_data',
                                     'Destination': '/var/lib/postgresql/data'}]
        self.commands = []
        self.rollouts = []
        self.fail_candidate = False
        self.fail_rollback = False
        for obj, key, fn in [(b, 'run', self.fake_run), (b, 'inspect', self.fake_inspect),
                (b, 'health', lambda cid: None), (d, 'wait_healthy', self.fake_wait)]:
            p = patch.object(obj, key, side_effect=fn)
            p.start()
            self.addCleanup(p.stop)

    def fake_inspect(self, cid, service):
        return copy.deepcopy(self.items[service])

    def fake_run(self, args, **kwargs):
        self.commands.append(args)
        if args[0] == 'git':
            return 'approved-head'
        if args[:3] == ['docker', 'image', 'inspect']:
            return args[-1]
        if args[:2] == ['docker', 'inspect']:
            if 'Env' in args[3]:
                return json.dumps([k + '=' + v for k, v in self.env.items()])
            return 'null'
        if 'config' in args:
            return json.dumps(self.config)
        if 'up' in args:
            service = args[-1]
            overlay = Path(args[args.index('up') - 1])
            data = json.loads(overlay.read_text())['services'][service]
            self.rollouts.append((overlay.name, service, data['image']))
            if self.fail_rollback and overlay.name == 'rollback.json':
                raise b.BackupError('rollback failed')
            self.items[service]['image'] = data['image']
        return ''

    def fake_wait(self, service, image):
        if self.fail_candidate and image == self.new_api:
            raise b.BackupError('candidate unhealthy')

    def test_same_image_rollout_preserves_layers_and_never_recreates_db(self):
        d.deploy()
        self.assertEqual(self.rollouts, [('target.json', 'api', self.old_api),
                                        ('target.json', 'web', self.old_web)])
        self.assertFalse(d.MARKER.exists())
        for cmd in self.commands:
            if 'up' in cmd:
                files = [cmd[i + 1] for i, arg in enumerate(cmd) if arg == '-f']
                self.assertEqual(files[:4], [str(self.root / f) for f in d.LAYERS])
                self.assertIn('--no-deps', cmd)
                self.assertIn('--no-build', cmd)
                self.assertEqual(cmd[cmd.index('--pull') + 1], 'never')
                self.assertNotIn('db', cmd[cmd.index('up'):])

    def test_failed_candidate_restores_both_previous_images_and_health_policy(self):
        self.fail_candidate = True
        with self.assertRaises(b.BackupError):
            d.deploy(self.new_api, self.new_web)
        self.assertEqual(self.items['api']['image'], self.old_api)
        self.assertEqual(self.items['web']['image'], self.old_web)
        self.assertEqual([s for name, s, _ in self.rollouts if name == 'rollback.json'], ['api', 'web'])
        self.assertFalse(d.MARKER.exists())
        overlay = next(self.state.glob('deploy-*/rollback.json'))
        self.assertTrue(json.loads(overlay.read_text())['services']['api']['healthcheck']['disable'])

    def test_failed_rollback_retains_marker_and_blocks_backup(self):
        self.fail_candidate = self.fail_rollback = True
        with self.assertRaises(b.BackupError):
            d.deploy(self.new_api, self.new_web)
        self.assertTrue(d.MARKER.exists())
        with patch.object(b, 'inspect', side_effect=AssertionError('must refuse before Docker')):
            with self.assertRaises(b.BackupError):
                b.backup()

    def test_recovery_refuses_changed_configuration(self):
        self.fail_candidate = self.fail_rollback = True
        with self.assertRaises(b.BackupError):
            d.deploy(self.new_api, self.new_web)
        (self.root / 'compose.media.yaml').write_text('changed')
        before = len(self.rollouts)
        with self.assertRaises(b.BackupError):
            d.rollback()
        self.assertEqual(len(self.rollouts), before)
        self.assertTrue(d.MARKER.exists())

    def test_private_configuration_changes_fail_before_rollout(self):
        for mutation in ('auth', 'media', 'origin'):
            with self.subTest(mutation=mutation):
                config = copy.deepcopy(self.config)
                if mutation == 'auth':
                    config['services']['api']['secrets'] = []
                elif mutation == 'media':
                    config['volumes']['contact_media']['name'] = 'wrong'
                else:
                    config['services']['api']['environment']['PNET_PUBLIC_ORIGIN'] = 'https://wrong.invalid'
                with self.assertRaises(b.BackupError):
                    d.validate_config(config, self.env)
        self.assertFalse(self.rollouts)

    def test_backup_lock_blocks_deploy_before_mutation(self):
        with (self.state / 'backup.lock').open('a') as lock:
            fcntl.flock(lock, fcntl.LOCK_EX | fcntl.LOCK_NB)
            with patch.object(sys, 'argv', ['deploy.py', '--expected-head', 'approved-head', '--apply-current']):
                self.assertEqual(d.main(), 1)
        self.assertFalse(self.rollouts)

    def test_noop_backup_recovery_does_not_conflict_with_deploy_lock(self):
        with (self.state / 'backup.lock').open('a') as lock:
            fcntl.flock(lock, fcntl.LOCK_EX | fcntl.LOCK_NB)
            with patch.object(sys, 'argv', ['backup.py', '--recover']):
                self.assertEqual(b.main(), 0)
        self.assertFalse(self.rollouts)
        self.assertFalse(b.RECOVERY.exists())

    def test_prior_health_conversion_preserves_probe_and_durations(self):
        self.assertEqual(d.prior_health(None), {'disable': True})
        raw = {'Test': ['CMD', 'probe'], 'Interval': 20000000000, 'Timeout': 6000000000, 'Retries': 3}
        result = d.prior_health(raw)
        self.assertEqual(result['test'], raw['Test'])
        self.assertEqual(result['interval'], '20000000000ns')
        self.assertEqual(result['timeout'], '6000000000ns')
        self.assertEqual(result['retries'], 3)

if __name__ == '__main__':
    os.umask(0o077)
    unittest.main()
