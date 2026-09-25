#!/usr/bin/env bash

# Assert docker-compose.prod.yml interpolates LATERALZR_STORAGE like Compose does.
# Cases: unset, empty, set in the shell, and .env-only.

set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
cd "$ROOT"

if ! docker compose version >/dev/null 2>&1; then
    echo "docker compose is required" >&2
    exit 1
fi

COMPOSE=(docker compose -f docker-compose.prod.yml --project-directory "$ROOT")
ENV_BAK=""
if [[ -f .env ]]; then
    ENV_BAK="$(mktemp)"
    cp .env "$ENV_BAK"
fi
cleanup() {
    if [[ -n "$ENV_BAK" ]]; then
        mv "$ENV_BAK" .env
    else
        rm -f .env
    fi
}
trap cleanup EXIT

: > .env

bind_sources() {
    python3 -c '
import json, sys
data = json.load(sys.stdin)
want = {
    "app": "/var/www/html/storage",
    "queue": "/var/www/html/storage",
    "scheduler": "/var/www/html/storage",
    "nginx": "/var/www/html/public/storage",
}
for name, target in want.items():
    found = None
    for volume in data.get("services", {}).get(name, {}).get("volumes", []):
        if isinstance(volume, dict) and volume.get("target") == target:
            found = volume.get("source")
            break
    print(f"{name}={found}")
'
}

assert_case() {
    local label="$1"
    local storage="$2"
    local public="$3"
    local got
    got="$("${COMPOSE[@]}" config --format json | bind_sources)"
    local expected
    expected=$(printf 'app=%s\nqueue=%s\nscheduler=%s\nnginx=%s' "$storage" "$storage" "$storage" "$public")
    if [[ "$got" != "$expected" ]]; then
        echo "FAIL ${label}" >&2
        echo "expected:" >&2
        echo "$expected" >&2
        echo "got:" >&2
        echo "$got" >&2
        exit 1
    fi
    echo "OK ${label}"
}

default_storage="$ROOT/storage"
default_public="$ROOT/storage/app/public"

echo "=== unset ==="
unset LATERALZR_STORAGE || true
assert_case "unset" "$default_storage" "$default_public"

echo "=== empty LATERALZR_STORAGE ==="
LATERALZR_STORAGE='' assert_case "empty" "$default_storage" "$default_public"

echo "=== LATERALZR_STORAGE=/mnt/x ==="
LATERALZR_STORAGE=/mnt/x assert_case "set" "/mnt/x" "/mnt/x/app/public"

echo "=== .env only ==="
printf 'LATERALZR_STORAGE=/mnt/from-env\n' > .env
unset LATERALZR_STORAGE || true
assert_case "env-file" "/mnt/from-env" "/mnt/from-env/app/public"

echo "All compose storage bind cases passed."
