#!/usr/bin/env bash
# Start GLM-5.1 UI — optimized coding agent
set -euo pipefail
ROOT="$(cd "$(dirname "$0")" && pwd)"
cd "$ROOT"

echo "==> GLM-5.1 UI — trained coding agent"

if ! python3 -c "import fastapi" 2>/dev/null; then
  echo "==> Installing Python dependencies..."
  pip install -r backend/requirements.txt -q
fi

if [ ! -d "frontend/dist" ] || [ "frontend/dist/index.html" -ot "frontend/package.json" ]; then
  if command -v npm >/dev/null 2>&1; then
    echo "==> Building frontend..."
    (cd frontend && npm install --silent && npm run build)
  fi
fi

# Recommend best local model for agent quality
RECOMMENDED="qwen2.5-coder:14b"
if curl -sf http://127.0.0.1:11434/api/tags >/dev/null 2>&1; then
  if ! curl -sf http://127.0.0.1:11434/api/tags | grep -q "qwen2.5-coder"; then
    echo ""
    echo "TIP: For best agent quality, pull the trained-recommended model:"
    echo "  ollama pull $RECOMMENDED"
    echo "  (or: ollama pull qwen2.5:14b)"
    echo ""
  fi
else
  echo ""
  echo "Setup for best results:"
  echo "  1. Install Ollama — https://ollama.com"
  echo "  2. ollama pull $RECOMMENDED"
  echo ""
fi

echo "==> Starting at http://localhost:8000 (Agent tab)"
export PATH="${HOME}/.local/bin:${PATH}"
cd backend && exec python3 main.py
