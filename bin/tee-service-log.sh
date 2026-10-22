#!/bin/sh
# Append a command's stdout/stderr to a bind-mounted file while keeping
# the same stream on container stdout for the json-file logging driver.
# Forwards SIGTERM/SIGINT to the child so queue/scheduler stop cleanly.
set -eu

if [ "${1:-}" = "-h" ] || [ "${1:-}" = "--help" ]; then
    echo "usage: tee-service-log.sh <logfile> <command> [args...]" >&2
    exit 0
fi

if [ "$#" -lt 2 ]; then
    echo "usage: tee-service-log.sh <logfile> <command> [args...]" >&2
    exit 64
fi

log=$1
shift

mkdir -p "$(dirname "$log")"
touch "$log"

if command -v stdbuf >/dev/null 2>&1; then
    set -- stdbuf -oL -eL "$@"
fi

fifo="${TMPDIR:-/tmp}/lz-tee-$$.fifo"
mkfifo "$fifo"
tee -a "$log" < "$fifo" &
tee_pid=$!
cmd_pid=""

# Invoked from the TERM/INT trap (ShellCheck SC2329 cannot see that).
# shellcheck disable=SC2329
cleanup() {
    if [ -n "$cmd_pid" ]; then
        kill -TERM "$cmd_pid" 2>/dev/null || true
        wait "$cmd_pid" || true
    fi
    kill -TERM "$tee_pid" 2>/dev/null || true
    wait "$tee_pid" || true
    rm -f "$fifo"
}

trap 'cleanup; exit 0' TERM INT

"$@" > "$fifo" 2>&1 &
cmd_pid=$!
wait "$cmd_pid"
status=$?
kill -TERM "$tee_pid" 2>/dev/null || true
wait "$tee_pid" || true
rm -f "$fifo"
exit "$status"
