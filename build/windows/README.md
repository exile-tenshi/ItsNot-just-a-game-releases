# Windows builds — local PC first

**Build and run on your Windows PC** — see [WINDOWS.md](../WINDOWS.md) in the repo root.

```bat
setup-windows.bat
build-windows.bat
dist\GLM-5.1-UI\GLM-5.1-UI.exe
```

## Optional: CI build

GitHub Actions can also build on `windows-latest` (`.github/workflows/build-windows.yml`). Download **GLM-5.1-UI-windows** from the Actions tab if you prefer not to build locally.

## Cursor agents on your PC

Use **My Machines** so agents execute on your Windows box:

```powershell
irm 'https://cursor.com/install?win32=true' | iex
agent worker start
```

Pick your machine at [cursor.com/agents](https://cursor.com/agents).
