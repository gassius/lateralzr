#!/usr/bin/env bash

# Assert bin/compose-storage-bind matches docker compose config and bin/storage-host.
# Cases: unset, empty, set in the shell, .env-only, missing docker, and a
# deliberate path mismatch.

set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
cd "$ROOT"

BIND="$ROOT/bin/compose-storage-bind"
HOST="$ROOT/bin/storage-host"
VERIFY="$ROOT/bin/deploy-prod-verify"

if [[ ! -x "$BIND" || ! -x "$HOST" || ! -x "$VERIFY" ]]; then
    echo "compose-storage-bind, storage-host, and deploy-prod-verify must be executable" >&2
    exit 1
fi

# shellcheck source=bin/deploy-prod-verify
source "$VERIFY"

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

assert_eq() {
    local label="$1"
    local expected="$2"
    local got="$3"
    if [[ "$got" != "$expected" ]]; then
        echo "FAIL ${label}: expected '${expected}', got '${got}'" >&2
        exit 1
    fi
    echo "OK ${label}"
}

assert_match_case() {
    local label="$1"
    local expected="$2"
    local bind_got host_got host_abs

    if ! docker compose version >/dev/null 2>&1; then
        echo "docker compose is required for ${label}" >&2
        exit 1
    fi

    bind_got="$("$BIND")"
    host_got="$("$HOST")"
    host_abs="$(storage_host_abs "$host_got")"

    assert_eq "${label} compose-storage-bind" "$expected" "$bind_got"
    if ! storage_paths_match "$host_got" "$bind_got"; then
        echo "FAIL ${label}: storage-host '${host_got}' (${host_abs}) != compose bind '${bind_got}'" >&2
        exit 1
    fi
    echo "OK ${label} storage-host matches compose bind"
}

echo "=== docker missing (fail-soft, stderr visible) ==="
missing_dir="$(mktemp -d)"
ln -s "$(command -v python3)" "$missing_dir/python3"
ln -s "$(command -v bash)" "$missing_dir/bash"
missing_err="$(mktemp)"
missing_out="$(PATH="$missing_dir" "$BIND" 2>"$missing_err" || true)"
assert_eq "docker-missing stdout" "" "$missing_out"
if ! grep -q 'docker not found' "$missing_err"; then
    echo "FAIL docker-missing stderr should mention docker" >&2
    cat "$missing_err" >&2
    exit 1
fi
echo "OK docker-missing stderr"
rm -rf "$missing_dir" "$missing_err"

if ! docker compose version >/dev/null 2>&1; then
    echo "docker compose is required" >&2
    exit 1
fi

echo "=== unset ==="
unset LATERALZR_STORAGE || true
assert_match_case "unset" "$ROOT/storage"

echo "=== empty LATERALZR_STORAGE ==="
LATERALZR_STORAGE='' assert_match_case "empty" "$ROOT/storage"

echo "=== LATERALZR_STORAGE=/mnt/dummy-storage ==="
LATERALZR_STORAGE=/mnt/dummy-storage assert_match_case "set" "/mnt/dummy-storage"

echo "=== .env only ==="
printf 'LATERALZR_STORAGE=/mnt/from-env\n' > .env
unset LATERALZR_STORAGE || true
assert_match_case "env-file" "/mnt/from-env"

echo "=== .env quoted / padded simple values ==="
printf 'LATERALZR_STORAGE="/mnt/from-env"\n' > .env
unset LATERALZR_STORAGE || true
assert_eq "env-quoted" "/mnt/from-env" "$("$HOST")"
printf "LATERALZR_STORAGE='/mnt/from-env'\n" > .env
assert_eq "env-single-quoted" "/mnt/from-env" "$("$HOST")"
printf 'LATERALZR_STORAGE=/mnt/from-env  \n' > .env
assert_eq "env-padded" "/mnt/from-env" "$("$HOST")"

echo "=== .env interior whitespace is rejected ==="
printf 'LATERALZR_STORAGE="/mnt/env storage"\n' > .env
unset LATERALZR_STORAGE || true
if host_err="$("$HOST" 2>&1)"; then
    echo "FAIL env-spaces should be rejected, got: ${host_err}" >&2
    exit 1
fi
if [[ "$host_err" != *'/mnt/env storage'* || "$host_err" == *'/mnt/envstorage'* ]]; then
    echo "FAIL env-spaces should keep interior whitespace in the error: ${host_err}" >&2
    exit 1
fi
echo "OK env-spaces rejected"

echo "=== verify --storage-only (match) ==="
printf 'LATERALZR_STORAGE=/mnt/from-env\n' > .env
unset LATERALZR_STORAGE || true
"$VERIFY" --storage-only >/dev/null
echo "OK verify --storage-only match"

echo "=== storage_paths_match rejects mismatch ==="
if storage_paths_match "/mnt/dummy-storage" "/mnt/other-storage"; then
    echo "FAIL expected mismatch between dummy and other" >&2
    exit 1
fi
echo "OK storage_paths_match mismatch"

echo "=== compose-storage-bind does not swallow compose stderr ==="
bad_compose="$(mktemp)"
printf 'this is not: valid: yaml: [\n' > "$bad_compose"
bad_err="$(mktemp)"
bad_out="$("$BIND" "$bad_compose" 2>"$bad_err" || true)"
assert_eq "bad-compose stdout" "" "$bad_out"
if [[ ! -s "$bad_err" ]]; then
    echo "FAIL bad compose should write stderr (2>/dev/null would hide it)" >&2
    exit 1
fi
echo "OK bad-compose stderr"
rm -f "$bad_compose" "$bad_err"

echo "All compose-storage-bind cases passed."
