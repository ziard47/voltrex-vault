#!/usr/bin/env bash
# Voltrex Vault - Chrome Native Messaging Host Launcher
set -e

DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" >/dev/null 2>&1 && pwd)"
ROOT_DIR="$(cd "$DIR/.." >/dev/null 2>&1 && pwd)"
HOST_SCRIPT="$ROOT_DIR/dist/electron/native-host/index.js"

# Resolve node binary
NODE_BIN="$(which node 2>/dev/null || echo "/usr/bin/node")"

if [ ! -f "$HOST_SCRIPT" ]; then
  # Auto-compile if not yet built
  cd "$ROOT_DIR" && npm run build:electron >/dev/null 2>&1
fi

exec "$NODE_BIN" "$HOST_SCRIPT" "$@"
