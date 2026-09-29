#!/usr/bin/env bash
# Does not start or recreate any production service.
set -euo pipefail
test "$(git branch --show-current)" = feature/security-auth-baseline
test "$(git rev-parse HEAD)" = cd2bc1404cc3e7e607ea3a5cdefb301e8b32f7fe
git --no-pager diff --check
RUN_ID="$(date -u +%Y%m%d%H%M%S)-$$"
TEST_PROJECT="pnet-auth-test-$RUN_ID"
SNAPSHOT="$(mktemp /tmp/pnet-auth-test-production.XXXXXXXX.json)"
python3 - "$SNAPSHOT" <<'PY'
import json, subprocess, sys
result = {}
for service in ('api', 'db', 'web'):
    ids = subprocess.check_output(['docker', 'compose', '--profile', '*', 'ps', '-aq', service], text=True).split()
    assert len(ids) == 1, service
    item = json.loads(subprocess.check_output(['docker', 'inspect', ids[0]], text=True))[0]
    assert item['State']['Status'] == 'running', service
    result[service] = [item['Id'], item['Image'], item['State']['StartedAt'], item['RestartCount']]
with open(sys.argv[1], 'w') as file:
    json.dump(result, file)
print('PRODUCTION_SNAPSHOT_OK')
PY
COMPOSE=(docker compose --profile '*' --env-file /dev/null -p "$TEST_PROJECT" -f compose.auth-test.yaml)
# This build is tagged under the unique test project, not pnet-api.
"${COMPOSE[@]}" build test web-test
trap '"${COMPOSE[@]}" stop -t 10 test db web-test >/dev/null' EXIT
"${COMPOSE[@]}" up --abort-on-container-exit --exit-code-from test test
"${COMPOSE[@]}" run --rm --no-deps web-test
python3 - "$SNAPSHOT" <<'PY'
import json, subprocess, sys
before = json.load(open(sys.argv[1]))
for service, expected in before.items():
    ids = subprocess.check_output(['docker', 'compose', '--profile', '*', 'ps', '-aq', service], text=True).split()
    assert ids == [expected[0]], f'{service}: container changed'
    item = json.loads(subprocess.check_output(['docker', 'inspect', ids[0]], text=True))[0]
    actual = [item['Id'], item['Image'], item['State']['StartedAt'], item['RestartCount']]
    assert actual == expected, f'{service}: production state changed'
    assert item['State']['Status'] == 'running', service
print('API_DB_WEB_UNCHANGED')
PY
printf 'AUTH_ISOLATED_TEST_OK\n'
