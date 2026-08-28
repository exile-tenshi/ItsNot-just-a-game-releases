# GLM-5.1 UI — Run and Build on Your Windows PC

Everything runs **locally on your machine**. No cloud agent, no GitHub Actions required.

## First-time setup (5 minutes)

### 1. Install prerequisites

| Tool | Download | Notes |
|------|----------|-------|
| **Python 3.11+** | https://www.python.org/downloads/ | Check **"Add python.exe to PATH"** |
| **Node.js 20 LTS** | https://nodejs.org | For building the UI |
| **Ollama** (optional) | https://ollama.com | Local AI — no API key needed |

### 2. Clone or download this repo

```powershell
git clone https://github.com/exile-tenshi/ItsNot-just-a-game-releases.git
cd ItsNot-just-a-game-releases
```

### 3. Run setup

Double-click **`setup-windows.bat`** or in Command Prompt:

```bat
setup-windows.bat
```

This installs Python + Node dependencies and builds the UI.

### 4. Pull a local model (recommended)

```bat
ollama pull qwen2.5-coder:14b
```

---

## Run locally (dev mode)

Double-click **`run.bat`** or:

```bat
run.bat
```

- Starts the server on **http://127.0.0.1:8000**
- Opens your browser automatically
- Uses Ollama on your PC by default

---

## Build the Windows `.exe` on your PC

Double-click **`build-windows.bat`** or:

```bat
build-windows.bat
```

Output:

| Path | What it is |
|------|------------|
| `dist\GLM-5.1-UI\GLM-5.1-UI.exe` | Standalone app — double-click to run |
| `release\GLM-5.1-UI-windows.zip` | Zip to share or move to another PC |

**Important:** Keep the whole `dist\GLM-5.1-UI\` folder together (`GLM-5.1-UI.exe` needs the `_internal` folder).

After building, you can copy `dist\GLM-5.1-UI\` anywhere on your PC and run the `.exe` — no Python install needed on that machine.

---

## Use Cursor agents on your Windows PC

To have a Cursor Cloud Agent run commands **on your Windows machine** (build, test, edit files locally):

```powershell
irm 'https://cursor.com/install?win32=true' | iex
agent worker start
```

Then at [cursor.com/agents](https://cursor.com/agents), pick **your Windows machine** in the environment dropdown.

---

## Troubleshooting

| Problem | Fix |
|---------|-----|
| `Python not found` | Reinstall Python with "Add to PATH", or run `py -3.11 setup-windows.bat` |
| `npm not found` | Install Node.js LTS and restart Command Prompt |
| Browser doesn't open | Manually go to http://127.0.0.1:8000 |
| Agent says "needs model" | Start Ollama, run `ollama pull qwen2.5-coder:14b` |
| PyInstaller fails | Run `setup-windows.bat` first, then `build-windows.bat` |

---

## File reference

| Script | Purpose |
|--------|---------|
| `setup-windows.bat` | One-time install + UI build |
| `run.bat` | Run app locally (Python + browser) |
| `build-windows.bat` | Build `.exe` on your PC |
| `build\windows\build.bat` | Same build (called by above) |
