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

ensure_uv_environment() {
  if [[ ! -x .venv/bin/python ]]; then
    uv venv
  fi

  if ! .venv/bin/python -c "import fastapi, sqlalchemy, httpx, uvicorn, cryptography" >/dev/null 2>&1; then
    uv pip install -e .
  fi
}

ensure_venv_environment() {
  if [[ ! -x .venv/bin/python ]]; then
    python3 -m venv .venv
  fi

  if ! .venv/bin/python -c "import fastapi, sqlalchemy, httpx, uvicorn, cryptography" >/dev/null 2>&1; then
    .venv/bin/pip install -e .
  fi
}

if command -v uv >/dev/null 2>&1; then
  ensure_uv_environment
else
  ensure_venv_environment
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
exec .venv/bin/python -m uvicorn "${UVICORN_ARGS[@]}"
