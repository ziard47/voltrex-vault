#!/usr/bin/env bash
# Voltrex Vault - Chrome Native Messaging Host Launcher
set -e

DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" >/dev/null 2>&1 && pwd)"
ROOT_DIR="$(cd "$DIR/.." >/dev/null 2>&1 && pwd)"
HOST_SCRIPT="$ROOT_DIR/dist/electron/native-host/index.js"

# Resolve Node binary across custom NVM, Volta, asdf, and standard system paths
NODE_BIN="/home/deck/.nvm/versions/node/v24.18.0/bin/node"

if [ ! -x "$NODE_BIN" ]; then
  NODE_BIN="$(which node 2>/dev/null || true)"
fi

if [ ! -x "$NODE_BIN" ]; then
  for candidate in "$HOME"/.nvm/versions/node/*/bin/node "$HOME"/.local/bin/node /usr/local/bin/node /usr/bin/node; do
    if [ -x "$candidate" ]; then
      NODE_BIN="$candidate"
      break
    fi
  done
fi

if [ ! -x "$NODE_BIN" ]; then
  echo "Error: Node.js executable could not be found." >&2
  exit 1
fi

if [ ! -f "$HOST_SCRIPT" ]; then
  # Auto-compile if not yet built
  cd "$ROOT_DIR" && "$NODE_BIN" -e "require('child_process').execSync('npm run build:electron', { stdio: 'inherit' })" >/dev/null 2>&1 || true
fi

exec "$NODE_BIN" "$HOST_SCRIPT" "$@"
