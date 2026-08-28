@echo off
setlocal enabledelayedexpansion
cd /d "%~dp0\..\.."

echo ========================================
echo   GLM-5.1 UI - Windows Desktop Build
echo ========================================

where python >nul 2>&1 || (
  echo ERROR: Python not found. Install Python 3.11+ from https://python.org
  exit /b 1
)

where node >nul 2>&1 || (
  echo ERROR: Node.js not found. Install from https://nodejs.org
  exit /b 1
)

echo.
echo [1/4] Installing Python dependencies...
python -m pip install -r backend\requirements.txt -q
python -m pip install pyinstaller -q

echo.
echo [2/4] Building frontend...
cd frontend
if not exist node_modules call npm install --silent
call npm run build
if errorlevel 1 (
  echo ERROR: Frontend build failed
  exit /b 1
)
cd ..

if not exist "frontend\dist\index.html" (
  echo ERROR: frontend\dist\index.html missing after build
  exit /b 1
)

echo.
echo [3/4] Running PyInstaller...
python -m PyInstaller build\windows\GLM-UI.spec --noconfirm --clean
if errorlevel 1 (
  echo ERROR: PyInstaller build failed
  exit /b 1
)

echo.
echo [4/4] Done!
echo.
echo Output: dist\GLM-5.1-UI\
echo Run:     dist\GLM-5.1-UI\GLM-5.1-UI.exe
echo.
echo Tip: Install Ollama from https://ollama.com and run:
echo      ollama pull qwen2.5-coder:14b
echo.

endlocal
