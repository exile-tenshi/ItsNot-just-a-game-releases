@echo off
REM GLM-5.1 UI - run locally on your PC (opens browser automatically)
cd /d "%~dp0"

set "PY="
where py >nul 2>&1 && (
  for /f "delims=" %%v in ('py -3.11 -c "import sys; print(sys.executable)" 2^>nul') do set "PY=%%v"
)
if not defined PY where python >nul 2>&1 && set "PY=python"
if not defined PY (
  echo Python not found. Run setup-windows.bat first.
  pause
  exit /b 1
)

"%PY%" -c "import fastapi" 2>nul || (
  echo Installing Python dependencies...
  "%PY%" -m pip install -r backend\requirements.txt -q
)

if not exist "frontend\dist\index.html" (
  echo Building frontend...
  cd frontend
  call npm install --silent
  call npm run build
  cd ..
)

where curl >nul 2>&1 && curl -sf http://127.0.0.1:11434/api/tags >nul 2>&1 || (
  echo.
  echo NOTE: Ollama is not running. Install from https://ollama.com
  echo       Then: ollama pull qwen2.5-coder:14b
  echo.
)

echo Starting GLM-5.1 UI on your PC...
"%PY%" launcher.py
