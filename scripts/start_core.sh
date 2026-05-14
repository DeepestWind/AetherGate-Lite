#!/usr/bin/env bash

set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT_DIR"

HOST="${HOST:-127.0.0.1}"
PORT="${PORT:-8000}"
RELOAD="${RELOAD:-1}"

if [[ ! -f config.toml ]]; then
  cp config.example.toml config.toml
  echo "Created config.toml from config.example.toml"
fi

if ! command -v uv >/dev/null 2>&1; then
  echo "uv is required. Install it from https://docs.astral.sh/uv/"
  exit 1
fi

UVICORN_ARGS=(
  app.main:app
  --host "$HOST"
  --port "$PORT"
)

if [[ "$RELOAD" == "1" ]]; then
  UVICORN_ARGS+=(--reload)
fi

echo "Starting Branchat core on http://${HOST}:${PORT}"
if [[ -f frontend/console/dist/index.html ]]; then
  echo "Built console is available at http://${HOST}:${PORT}/"
else
  echo "Built console is not available. Run ./scripts/build_console.sh or use ./scripts/start.sh for dev mode."
fi
exec uv run --locked --no-dev -m uvicorn "${UVICORN_ARGS[@]}"
