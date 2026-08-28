# GLM-5.1 UI — Local Gaming PC Builder

Runs **entirely on your PC** — no API keys, no cloud, no usage limits. Built for unlimited gaming PC build planning from budget 1080p rigs to no-compromise 4K enthusiast systems.

## One command start

```bash
chmod +x start.sh
./start.sh
```

Open **http://localhost:8000**

Windows: double-click `start.bat` or run it from Command Prompt.

## One-time setup (this PC only)

1. **Install Ollama** — https://ollama.com
2. **Pull a model** (any of these work well for PC builds):
   ```bash
   ollama pull llama3.1:8b
   ollama pull qwen2.5:14b
   ```
3. **Run the app** — `./start.sh`

That's it. No accounts, no subscriptions, no internet after setup.

## Features

| Tab | What it does |
|-----|--------------|
| **Chat** | Unlimited local AI chat |
| **PC Builder** | Preset builds ($800–$5000) + custom budget/resolution/use-case builder |
| **Restrictions** | Review allowed/not-allowed policy files |
| **Test Suite** | Validate restriction guard scenarios |
| **Settings** | Ollama URL, model, connection test |

## Usage limits

**None.** Local mode disables all artificial caps (`config/local.json`):

- No daily message limit
- No token quotas
- No rate limiting
- Limited only by your CPU/GPU/RAM

## PC Builder presets

| Build | Budget | Target |
|-------|--------|--------|
| Solid 1080p Gamer | $800 | 1080p high settings |
| 1440p High Refresh | $1,400 | 1440p ultra, 100+ FPS |
| 1440p Enthusiast | $2,200 | Max 1440p |
| 4K Ultra Gaming | $3,200 | 4K ultra 60–120 FPS |
| Ultimate 4K / 240Hz | $5,000 | No-compromise flagship |
| Game + Stream | $2,500 | 1440p play + 1080p stream |
| VR Ready | $2,000 | PCVR high settings |
| SFF LAN | $1,800 | Portable ITX build |

Config: `config/pc-builder-presets.json`

## Project structure

```
├── start.sh / start.bat     # Single-process launcher
├── config/
│   ├── local.json           # Local-only, unlimited usage config
│   ├── pc-builder-presets.json
│   └── restrictions-test.json
├── restrictions/            # Policy review files
├── backend/                 # FastAPI + OpenAI SDK → Ollama
└── frontend/                # React UI (served from :8000)
```

## Optional cloud fallback

Cloud is **not required**. To use Z.AI instead of Ollama, set in `.env`:

```
LOCAL_MODE=false
ZAI_API_KEY=your-key
INFERENCE_BASE_URL=https://api.z.ai/api/paas/v4/
GLM_MODEL=glm-5.1
```

## SDK (local)

```python
from openai import OpenAI

client = OpenAI(
    api_key="local",
    base_url="http://127.0.0.1:11434/v1",
)

response = client.chat.completions.create(
    model="llama3.1:8b",
    messages=[{"role": "user", "content": "Design a $2000 gaming PC"}],
)
```

## License

MIT
