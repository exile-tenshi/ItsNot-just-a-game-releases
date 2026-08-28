@echo off
REM Build GLM-5.1 UI Windows desktop bundle (.exe + portable folder)
cd /d "%~dp0.."

echo ==^> Building frontend...
cd frontend
call npm ci --silent
if errorlevel 1 (
  call npm install --silent
)
call npm run build
if errorlevel 1 exit /b 1
cd ..

echo ==^> Installing Python dependencies...
python -m pip install -r backend\requirements.txt pyinstaller -q

echo ==^> Building Windows executable...
python -m PyInstaller scripts\glm-ui.spec --noconfirm --clean
if errorlevel 1 exit /b 1

echo.
echo ==^> Done! Portable app folder:
echo     dist\GLM-5.1-UI\
echo     Run: dist\GLM-5.1-UI\GLM-5.1-UI.exe
echo.
