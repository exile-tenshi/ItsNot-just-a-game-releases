@echo off
setlocal enabledelayedexpansion
cd /d "%~dp0"

echo.
echo  ============================================
echo    GLM-5.1 UI - Windows Local Setup
echo  ============================================
echo.

REM --- Find Python (py launcher or python on PATH) ---
set "PY="
where py >nul 2>&1 && (
  for /f "delims=" %%v in ('py -3.11 -c "import sys; print(sys.executable)" 2^>nul') do set "PY=%%v"
)
if not defined PY where python >nul 2>&1 && set "PY=python"
if not defined PY (
  echo [ERROR] Python 3.11+ not found.
  echo         Install from https://www.python.org/downloads/
  echo         Check "Add python.exe to PATH" during install.
  pause
  exit /b 1
)
echo [OK] Python: %PY%

REM --- Node.js ---
where node >nul 2>&1 || (
  echo [ERROR] Node.js not found. Install LTS from https://nodejs.org
  pause
  exit /b 1
)
for /f "delims=" %%v in ('node -v') do echo [OK] Node: %%v

echo.
echo [1/3] Installing Python dependencies...
"%PY%" -m pip install --upgrade pip -q
"%PY%" -m pip install -r backend\requirements.txt -q
if errorlevel 1 goto :fail

echo.
echo [2/3] Installing frontend and building UI...
cd frontend
if not exist node_modules call npm install
call npm run build
if errorlevel 1 (
  cd ..
  goto :fail
)
cd ..

if not exist "frontend\dist\index.html" (
  echo [ERROR] Frontend build did not produce frontend\dist\index.html
  goto :fail
)

echo.
echo [3/3] Setup complete!
echo.
echo  Run the app (dev mode, opens browser):
echo    run.bat
echo.
echo  Build standalone .exe (no Python needed after):
echo    build-windows.bat
echo.
echo  Optional - local AI model (Ollama):
echo    https://ollama.com
echo    ollama pull qwen2.5-coder:14b
echo.
pause
exit /b 0

:fail
echo.
echo Setup failed. See errors above.
pause
exit /b 1
