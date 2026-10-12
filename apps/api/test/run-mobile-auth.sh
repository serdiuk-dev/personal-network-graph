#!/usr/bin/env bash
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/../../.." && pwd)"
cd "$ROOT"
command -v docker >/dev/null || { echo "STOP: Docker is required for isolated PostgreSQL tests."; exit 1; }
docker info >/dev/null
COMPOSE_FILE="$ROOT/apps/api/test/mobile-auth.compose.yml"
PROJECT="pnet-faceid-test-$(date +%s)-$$"
compose=(docker compose --env-file /dev/null -p "$PROJECT" -f "$COMPOSE_FILE")
cleanup() { "${compose[@]}" down --volumes --remove-orphans; }
trap cleanup EXIT
"${compose[@]}" run --build --rm tests
echo "MOBILE_AUTH_POSTGRES_TESTS_OK"
