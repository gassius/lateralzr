#!/bin/sh
# Append a command's stdout/stderr to a bind-mounted file while keeping
# the same stream on container stdout for the json-file logging driver.
# Forwards SIGTERM/SIGINT to the child so queue/scheduler stop cleanly.
# Line-buffer tee so a long-running worker's startup line reaches the
# file (block-buffered tee left queue.log at 0 bytes).
set -eu
umask 002

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
echo "tee-service-log: starting $*" >> "$log"

if command -v stdbuf >/dev/null 2>&1; then
    set -- stdbuf -oL -eL "$@"
fi

fifo="${TMPDIR:-/tmp}/lz-tee-$$.fifo"
mkfifo "$fifo"
if command -v stdbuf >/dev/null 2>&1; then
    stdbuf -oL -eL tee -a "$log" < "$fifo" &
else
    tee -a "$log" < "$fifo" &
fi
tee_pid=$!
cmd_pid=""

# Invoked from traps. ShellCheck cannot see trap-called functions.
# shellcheck disable=SC2317,SC2329
cleanup() {
    if [ -n "${cmd_pid:-}" ]; then
        kill -TERM "$cmd_pid" 2>/dev/null || true
        wait "$cmd_pid" || true
    fi
    if [ -n "${tee_pid:-}" ]; then
        kill -TERM "$tee_pid" 2>/dev/null || true
        wait "$tee_pid" || true
    fi
    rm -f "$fifo"
}

trap cleanup EXIT
trap 'exit 0' TERM INT

# stdout and stderr both go through the fifo into tee.
"$@" > "$fifo" 2>&1 &
cmd_pid=$!
wait "$cmd_pid"
status=$?
# Wait for the child before EXIT removes the fifo (B1 / review minor).
cmd_pid=""
# Drain tee via EOF; SIGTERM on the normal path drops buffered lines.
wait "$tee_pid" || true
tee_pid=""
exit "$status"
