#!/usr/bin/env bash

set -euo pipefail

if [ -f "$HOME/.zshrc" ]; then
  # Load user-local Node 20 PATH overrides when the shell session has not sourced them yet.
  # shellcheck disable=SC1090
  source "$HOME/.zshrc"
fi

if ! command -v node >/dev/null 2>&1; then
  echo "node is missing"
  exit 1
fi

NODE_MAJOR="$(node -p 'process.versions.node.split(".")[0]')"
if [ "$NODE_MAJOR" -lt 20 ]; then
  echo "Node 20+ is required. Current: $(node -v)"
  echo "Run: source ~/.zshrc"
  exit 1
fi

exec "$@"
