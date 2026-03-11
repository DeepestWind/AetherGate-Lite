#!/usr/bin/env bash

set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT_DIR"

HOST="${HOST:-127.0.0.1}"
PORT="${PORT:-8000}"
CORE_RELOAD="${CORE_RELOAD:-1}"
DEV_PORT="${DEV_PORT:-3001}"
PROXY_TARGET="${PROXY_TARGET:-http://127.0.0.1:${PORT}}"

CORE_PID=""
CONSOLE_PID=""

cleanup() {
  local exit_code="${1:-0}"

  trap - EXIT INT TERM

  if [[ -n "$CONSOLE_PID" ]] && kill -0 "$CONSOLE_PID" >/dev/null 2>&1; then
    kill "$CONSOLE_PID" >/dev/null 2>&1 || true
  fi

  if [[ -n "$CORE_PID" ]] && kill -0 "$CORE_PID" >/dev/null 2>&1; then
    kill "$CORE_PID" >/dev/null 2>&1 || true
  fi

  wait >/dev/null 2>&1 || true
  exit "$exit_code"
}

trap 'cleanup 0' EXIT
trap 'cleanup 130' INT TERM

echo "Starting AetherGate-Lite core on http://${HOST}:${PORT}"
HOST="$HOST" PORT="$PORT" RELOAD="$CORE_RELOAD" "$ROOT_DIR/scripts/start_core.sh" &
CORE_PID="$!"

echo "Starting AetherGate-Lite console on http://127.0.0.1:${DEV_PORT}"
DEV_PORT="$DEV_PORT" PROXY_TARGET="$PROXY_TARGET" "$ROOT_DIR/scripts/start_console.sh" &
CONSOLE_PID="$!"

echo "Core API: http://${HOST}:${PORT}"
echo "Console UI: http://127.0.0.1:${DEV_PORT}"

while true; do
  if ! kill -0 "$CORE_PID" >/dev/null 2>&1; then
    set +e
    wait "$CORE_PID"
    CORE_EXIT_CODE="$?"
    set -e
    echo "Core process exited with code ${CORE_EXIT_CODE}"
    cleanup "$CORE_EXIT_CODE"
  fi

  if ! kill -0 "$CONSOLE_PID" >/dev/null 2>&1; then
    set +e
    wait "$CONSOLE_PID"
    CONSOLE_EXIT_CODE="$?"
    set -e
    echo "Console process exited with code ${CONSOLE_EXIT_CODE}"
    cleanup "$CONSOLE_EXIT_CODE"
  fi

  sleep 1
done
