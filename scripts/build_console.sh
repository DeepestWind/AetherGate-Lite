#!/usr/bin/env bash

set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
CONSOLE_DIR="$ROOT_DIR/frontend/console"

cd "$CONSOLE_DIR"

if ! command -v npm >/dev/null 2>&1; then
  echo "npm is required to build the console."
  exit 1
fi

if [[ ! -d node_modules ]]; then
  npm install
fi

echo "Building AetherGate-Lite console..."
npm run build

