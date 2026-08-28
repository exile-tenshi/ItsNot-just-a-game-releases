@echo off
setlocal enabledelayedexpansion
cd /d "%~dp0\..\.."

echo ========================================
echo   GLM-5.1 UI - Build on YOUR Windows PC
echo ========================================

REM Find Python
set "PY="
where py >nul 2>&1 && (
  for /f "delims=" %%v in ('py -3.11 -c "import sys; print(sys.executable)" 2^>nul') do set "PY=%%v"
)
if not defined PY where python >nul 2>&1 && set "PY=python"
if not defined PY (
  echo ERROR: Python 3.11+ not found. Run setup-windows.bat first.
  pause
  exit /b 1
)

where node >nul 2>&1 || (
  echo ERROR: Node.js not found. Run setup-windows.bat first.
  pause
  exit /b 1
)

echo.
echo [1/5] Installing Python dependencies...
"%PY%" -m pip install -r backend\requirements.txt -q
"%PY%" -m pip install pyinstaller -q

echo.
echo [2/5] Building frontend...
cd frontend
if not exist node_modules call npm install --silent
call npm run build
if errorlevel 1 (
  echo ERROR: Frontend build failed
  cd ..
  pause
  exit /b 1
)
cd ..

if not exist "frontend\dist\index.html" (
  echo ERROR: frontend\dist\index.html missing after build
  pause
  exit /b 1
)

echo.
echo [3/5] Running PyInstaller...
"%PY%" -m PyInstaller build\windows\GLM-UI.spec --noconfirm --clean
if errorlevel 1 (
  echo ERROR: PyInstaller build failed
  pause
  exit /b 1
)

echo.
echo [4/5] Creating release zip...
if not exist release mkdir release
powershell -NoProfile -Command "Compress-Archive -Path 'dist\GLM-5.1-UI\*' -DestinationPath 'release\GLM-5.1-UI-windows.zip' -Force" 2>nul
if exist release\GLM-5.1-UI-windows.zip (
  echo Created: release\GLM-5.1-UI-windows.zip
)

echo.
echo [5/5] Done!
echo.
echo   Run the app:  dist\GLM-5.1-UI\GLM-5.1-UI.exe
echo   Or zip:       release\GLM-5.1-UI-windows.zip
echo.
echo   Tip: Install Ollama from https://ollama.com
echo        ollama pull qwen2.5-coder:14b
echo.
pause
endlocal
