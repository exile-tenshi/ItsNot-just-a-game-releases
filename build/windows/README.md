# Windows builds (Cloud Agent note)

Cursor **managed** Cloud Agent VMs run Linux only. Native Windows `.exe` builds require one of:

## Option A — GitHub Actions (recommended)

Every push to `main` runs `.github/workflows/build-windows.yml` on `windows-latest`.
Download the **GLM-5.1-UI-windows** artifact from the Actions tab.

## Option B — My Machines (local Windows PC)

1. PowerShell: `irm 'https://cursor.com/install?win32=true' | iex`
2. Run: `agent worker start`
3. Start a new agent and pick your Windows machine in the environment dropdown.
4. Run: `build\windows\build.bat`

## Option C — Build locally on Windows

```bat
build\windows\build.bat
dist\GLM-5.1-UI\GLM-5.1-UI.exe
```

The Linux Cloud Agent environment (`.cursor/environment.json`) is for backend/frontend dev and CI prep — not for producing the Windows binary directly.
