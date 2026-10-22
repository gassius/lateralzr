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

log_bind_sources() {
    python3 -c '
import json, os, sys
data = json.load(sys.stdin)
want = {
    "app": "/var/log/lateralzr-host",
    "queue": "/var/log/lateralzr-host",
    "scheduler": "/var/log/lateralzr-host",
    "nginx": "/var/log/nginx",
}
for name, target in want.items():
    found = None
    for volume in data.get("services", {}).get(name, {}).get("volumes", []):
        if isinstance(volume, dict) and volume.get("target") == target:
            source = volume.get("source") or ""
            found = os.path.normpath(source) if source else None
            break
    print(f"{name}={found}")
'
}

assert_json_file_logging() {
    local label="$1"
    local err
    if ! err="$("${COMPOSE[@]}" config --format json | python3 -c '
import json, sys
data = json.load(sys.stdin)
services = data.get("services") or {}
if not services:
    sys.stderr.write("no services in compose config\n")
    sys.exit(1)
failed = 0
for name in sorted(services):
    logging = services[name].get("logging") or {}
    driver = logging.get("driver")
    options = logging.get("options") or {}
    max_size = str(options.get("max-size") or "")
    max_file = str(options.get("max-file") or "")
    if driver != "json-file" or max_size != "10m" or max_file != "3":
        sys.stderr.write(
            "%s logging=%s\n" % (name, {"driver": driver, "options": options})
        )
        failed = 1
if failed:
    sys.exit(1)
' 2>&1)"; then
        echo "FAIL ${label} json-file logging" >&2
        echo "$err" >&2
        exit 1
    fi
    echo "OK ${label} json-file logging"
}

assert_case() {
    local label="$1"
    local storage="$2"
    local public="$3"
    local logs="$4"
    local nginx_logs="$5"
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

    got="$("${COMPOSE[@]}" config --format json | log_bind_sources)"
    expected=$(printf 'app=%s\nqueue=%s\nscheduler=%s\nnginx=%s' "$logs" "$logs" "$logs" "$nginx_logs")
    if [[ "$got" != "$expected" ]]; then
        echo "FAIL ${label} log binds" >&2
        echo "expected:" >&2
        echo "$expected" >&2
        echo "got:" >&2
        echo "$got" >&2
        exit 1
    fi
    echo "OK ${label} log binds"
    assert_json_file_logging "$label"
}

default_storage="$ROOT/storage"
default_public="$ROOT/storage/app/public"
default_logs="$ROOT/logs"
default_nginx_logs="$ROOT/logs/nginx"

echo "=== unset ==="
unset LATERALZR_STORAGE || true
assert_case "unset" "$default_storage" "$default_public" "$default_logs" "$default_nginx_logs"

echo "=== empty LATERALZR_STORAGE ==="
LATERALZR_STORAGE='' assert_case "empty" "$default_storage" "$default_public" "$default_logs" "$default_nginx_logs"

echo "=== LATERALZR_STORAGE=/mnt/x ==="
LATERALZR_STORAGE=/mnt/x assert_case "set" "/mnt/x" "/mnt/x/app/public" "/mnt/logs" "/mnt/logs/nginx"

echo "=== .env only ==="
printf 'LATERALZR_STORAGE=/mnt/from-env\n' > .env
unset LATERALZR_STORAGE || true
assert_case "env-file" "/mnt/from-env" "/mnt/from-env/app/public" "/mnt/logs" "/mnt/logs/nginx"

echo "All compose storage bind cases passed."
