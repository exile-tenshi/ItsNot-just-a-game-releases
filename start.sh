#!/usr/bin/env bash
# Start GLM-5.1 UI — single process, runs entirely on this PC
set -euo pipefail
ROOT="$(cd "$(dirname "$0")" && pwd)"
cd "$ROOT"

echo "==> GLM-5.1 UI — local mode (no cloud required)"

# Python deps
if ! python3 -c "import fastapi" 2>/dev/null; then
  echo "==> Installing Python dependencies..."
  pip install -r backend/requirements.txt -q
fi

# Build frontend if needed
if [ ! -d "frontend/dist" ] || [ "frontend/dist/index.html" -ot "frontend/package.json" ]; then
  if command -v npm >/dev/null 2>&1; then
    echo "==> Building frontend..."
    (cd frontend && npm install --silent && npm run build)
  else
    echo "WARN: npm not found — API only at :8000 (install Node.js to serve UI)"
  fi
fi

# Check Ollama (optional warning)
if ! curl -sf http://127.0.0.1:11434/api/tags >/dev/null 2>&1; then
  echo ""
  echo "NOTE: Ollama is not running on this PC yet."
  echo "  Install from https://ollama.com"
  echo "  Then run:  ollama pull llama3.1:8b"
  echo ""
fi

echo "==> Starting server at http://localhost:8000"
export PATH="${HOME}/.local/bin:${PATH}"
cd backend && exec python3 main.py
