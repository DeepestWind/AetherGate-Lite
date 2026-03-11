#!/usr/bin/env bash

set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
CONSOLE_DIR="$ROOT_DIR/frontend/console"

cd "$CONSOLE_DIR"

DEV_PORT="${DEV_PORT:-3001}"
PROXY_TARGET="${PROXY_TARGET:-http://127.0.0.1:8000}"
DEFAULT_TOKEN="${VITE_DEFAULT_TOKEN:-${AETHERGATE_AUTH_TOKEN:-}}"

read_config_token() {
  local config_path="$ROOT_DIR/config.toml"

  if [[ ! -f "$config_path" ]]; then
    return 0
  fi

  awk '
    BEGIN { in_app = 0 }
    /^\[app\][[:space:]]*$/ { in_app = 1; next }
    /^\[[^]]+\][[:space:]]*$/ { in_app = 0 }
    in_app && /^[[:space:]]*auth_token[[:space:]]*=/ {
      value = $0
      sub(/^[^=]*=[[:space:]]*/, "", value)
      gsub(/^[[:space:]]*"/, "", value)
      gsub(/"[[:space:]]*$/, "", value)
      print value
      exit
    }
  ' "$config_path"
}

if [[ -z "$DEFAULT_TOKEN" ]]; then
  DEFAULT_TOKEN="$(read_config_token)"
fi

if ! command -v npm >/dev/null 2>&1; then
  echo "npm is required to run the console."
  exit 1
fi

if [[ ! -d node_modules ]]; then
  npm install
fi

echo "Starting console dev server on http://127.0.0.1:${DEV_PORT}"
if [[ -n "$DEFAULT_TOKEN" ]]; then
  echo "Loaded auth_token from config.toml for console dev session"
fi
VITE_DEV_PORT="$DEV_PORT" VITE_PROXY_TARGET="$PROXY_TARGET" VITE_DEFAULT_TOKEN="$DEFAULT_TOKEN" npm run dev
