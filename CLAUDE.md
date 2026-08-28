# Claude Code / GLM Agent Project Memory

## Build & test

```bash
# Backend
cd backend && pip install -r requirements.txt && python3 main.py

# Frontend
cd frontend && npm install && npm run build

# Full stack
./start.sh
```

## Architecture

- `backend/` — FastAPI + OpenAI SDK agent (Ollama / Z.AI / OpenAI)
- `frontend/` — React + Vite UI
- `config/agent-training.json` — trained prompts (Cursor/Claude Code aligned)
- `config/coding-agent.json` — tool and feature config

## Coding conventions

- Python: type hints, pathlib, minimal diffs
- TypeScript: strict types, match existing component style
- Agent changes: always run build/test after edits
- Do not over-engineer — only modify what the task requires

## Communication

- Lead with the answer
- Summarize done work in ≤3 bullets
- State uncertainty explicitly
