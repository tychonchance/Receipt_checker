#!/bin/bash
set -euo pipefail

# Only run full setup in remote (Claude Code on the web) environments
if [ "${CLAUDE_CODE_REMOTE:-}" != "true" ]; then
  exit 0
fi

PROJECT_DIR="${CLAUDE_PROJECT_DIR:-$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)}"

echo "=== Receipt Checker: installing dependencies ==="

echo "--- Python backend (pip) ---"
pip install -q -r "$PROJECT_DIR/backend/requirements.txt"

echo "--- Node frontend (npm) ---"
cd "$PROJECT_DIR/frontend"
npm install --silent

echo "--- Setting PYTHONPATH ---"
echo "export PYTHONPATH=\"$PROJECT_DIR/backend\"" >> "$CLAUDE_ENV_FILE"

echo "=== Setup complete ==="
