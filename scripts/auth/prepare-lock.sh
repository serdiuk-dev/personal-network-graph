#!/usr/bin/env bash
# Run from the repository root after applying the candidate patch.
set -euo pipefail
EXPECTED=cd2bc1404cc3e7e607ea3a5cdefb301e8b32f7fe
test "$(git branch --show-current)" = feature/security-auth-baseline
test "$(git rev-parse HEAD)" = "$EXPECTED"
git diff --exit-code HEAD -- apps/api/package-lock.json
WORK="$(mktemp -d /tmp/pnet-auth-lock.XXXXXXXX)"
cp apps/api/package.json apps/api/package-lock.json "$WORK/"
# Only package manifests are mounted. No source, environment or production network.
docker run --rm --network bridge \
  --mount "type=bind,source=$WORK,target=/work" \
  -w /work node:24-alpine \
  npm install --package-lock-only --ignore-scripts --no-audit --no-fund
python3 - "$WORK/package-lock.json" <<'PY'
import json
from pathlib import Path
import sys
before = json.loads(Path('apps/api/package-lock.json').read_text())
path = Path(sys.argv[1])
after = json.loads(path.read_text())
# A candidate may only add dependencies: no existing locked package may change.
for name, package in before['packages'].items():
    if not name:
        continue
    assert name in after['packages'], f'Locked package removed: {name}'
    updated = after['packages'][name]
    for field in ('version', 'integrity', 'resolved'):
        assert package.get(field) == updated.get(field), f'Locked package changed: {name} ({field})'
for name, version in {'argon2': '0.45.1', 'otpauth': '9.5.2', 'prisma': '6.19.3', '@prisma/client': '6.19.3'}.items():
    assert after['packages']['node_modules/' + name]['version'] == version, name
assert after['packages']['']['dependencies'] == json.loads(Path('apps/api/package.json').read_text())['dependencies']
Path('apps/api/package-lock.json').write_bytes(path.read_bytes())
print('AUTH_LOCK_OK: existing versions preserved; Prisma 6.19.3')
PY
git --no-pager diff --check
