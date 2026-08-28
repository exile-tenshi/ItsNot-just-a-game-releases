# GLM-5.1 UI — Coding Agent (Cursor-like)

Full coding AI on your PC with **internet access**, **cloud providers**, and every major feature from Cursor, Cline, and Windsurf.

## Training (aligned with top AI tools)

Training is verified against **Cursor, Claude Code, Cline, Windsurf, Aider, and Continue.dev**.

| File | Purpose |
|------|---------|
| `config/agent-training.json` | Master training — same rules as top agents |
| `config/training-sources.md` | Verification doc — what was aligned |
| `AGENTS.md` | Open agent standard |
| `CLAUDE.md` | Claude Code project memory |
| `.cursor/rules/01-agent-behaviour.mdc` | Cursor alwaysApply rules |

Key cross-tool rules: **5+ files = plan + approval**, **never install without asking**, **minimal diffs**, **verify before done**, **≤3 bullet summary**.

## Model quality (trained agent)

The agent uses **trained prompts + few-shot examples** from `config/agent-training.json`:

- 6-phase workflow: UNDERSTAND → EXPLORE → PLAN → EXECUTE → VERIFY → REPORT
- Auto-indexes your project (README, structure, entry points, git log)
- Verify-after-edit: runs tests/build after file changes
- Smart model routing to best available model

### Recommended models

| Use case | Model |
|----------|-------|
| **Best local agent** | `ollama pull qwen2.5-coder:14b` |
| Strong local fallback | `qwen2.5:14b` |
| Best cloud | Z.AI `glm-5.1` or OpenAI `gpt-4o` |

```bash
ollama pull qwen2.5-coder:14b
./start.sh
```

Configs: `config/agent-training.json`, `config/model-quality.json`

## Quick start

```bash
chmod +x start.sh && ./start.sh
```

Open **http://localhost:8000** → **Agent** tab

## Features (Cursor parity)

| Feature | Tool / Tab |
|---------|----------------|
| **Agent mode** | Autonomous loop — read, edit, run, iterate |
| **File operations** | `read_file`, `write_file`, `edit_file` |
| **Codebase search** | `search_codebase` (regex / ripgrep) |
| **Terminal** | `run_terminal` — tests, builds, npm, pip |
| **Web search** | `web_search` — docs, errors, APIs |
| **Fetch URLs** | `fetch_url` — read docs pages |
| **Git** | `git_status`, `git_diff`, `git_log` |
| **@file context** | Attach files from workspace tree |
| **Streaming** | Live agent + tool progress |
| **Chat** | General conversation |
| **PC Builder** | Gaming rig advisor |
| **Multi-provider** | Local Ollama, Z.AI GLM-5.1, OpenAI, OpenRouter |

Config: `config/coding-agent.json`

## Internet

Internet is **enabled by default** for:
- Web search and documentation lookup
- Fetching URLs (GitHub, Stack Overflow, docs)
- Optional cloud AI providers (Z.AI, OpenAI, OpenRouter)

Local Ollama still works offline for file/terminal/git tools.

## Providers (Settings tab)

| Provider | Base URL | API Key |
|----------|----------|---------|
| Local (Ollama) | `http://127.0.0.1:11434/v1` | `local` (none) |
| Z.AI GLM-5.1 | `https://api.z.ai/api/paas/v4/` | Z.AI key |
| OpenAI | `https://api.openai.com/v1` | OpenAI key |
| OpenRouter | `https://openrouter.ai/api/v1` | OpenRouter key |

## Setup

```bash
# Local model (recommended to start)
ollama pull llama3.1:8b
# Or for better agent tool use:
ollama pull qwen2.5:14b

./start.sh
```

For cloud GLM-5.1, add `ZAI_API_KEY` to `.env` and select **Z.AI** in Settings.

## Agent API

```bash
curl -N -X POST http://localhost:8000/api/agent/run \
  -H "Content-Type: application/json" \
  -d '{"message": "List all Python files and run tests"}'
```

## Project structure

```
├── config/coding-agent.json   # All Cursor-like features + tools
├── config/local.json         # Internet + unlimited usage
├── backend/agent.py            # Agent loop
├── backend/tools.py            # Tool definitions
├── backend/workspace.py        # Sandboxed file ops
├── backend/web_search.py       # Internet search
└── frontend/.../AgentPanel.tsx # IDE-style agent UI
```

## Usage limits

No artificial caps locally. Cloud providers use their own quotas.

## License

MIT
