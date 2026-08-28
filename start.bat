@echo off
REM Start GLM-5.1 UI on Windows — local mode, no cloud required
cd /d "%~dp0"

echo ==^> GLM-5.1 UI - local mode

python -c "import fastapi" 2>nul || (
  echo ==^> Installing Python dependencies...
  pip install -r backend\requirements.txt -q
)

if not exist "frontend\dist\index.html" (
  echo ==^> Building frontend...
  cd frontend
  call npm install --silent
  call npm run build
  cd ..
)

curl -sf http://127.0.0.1:11434/api/tags >nul 2>&1 || (
  echo.
  echo NOTE: Ollama is not running. Install from https://ollama.com
  echo   Then run: ollama pull llama3.1:8b
  echo.
)

echo ==^> Starting at http://localhost:8000
cd backend
python main.py
