#!/usr/bin/env bash
set -e

if [ -z "$ANTHROPIC_API_KEY" ]; then
  echo "Error: ANTHROPIC_API_KEY environment variable is not set."
  echo "Set it with: export ANTHROPIC_API_KEY=sk-ant-..."
  exit 1
fi

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

echo "Building frontend..."
cd "$SCRIPT_DIR/frontend"
npm run build

echo ""
echo "Starting Receipt Checker on http://localhost:8000"
echo ""
cd "$SCRIPT_DIR/backend"
python main.py
