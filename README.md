# GLM-5.1 UI

A full chat interface for **GLM-5.1** using Z.AI's **OpenAI-compatible API** and the official **`openai` Python SDK**. Restrictions are separated into reviewable files, with a test config for validating allowed and not-allowed scenarios.

## Features

- **Chat** — streaming and non-streaming completions via `glm-5.1`
- **Restrictions review** — human-readable `restrictions/RESTRICTIONS.md` plus structured JSON
- **Test suite** — automated validation from `config/restrictions-test.json`
- **Local restriction guard** — pre-check prompts against Z.AI policy categories before API calls

## Quick start

### 1. Backend

```bash
cd backend
pip install -r requirements.txt
cp ../.env.example ../.env
# Edit ../.env and set ZAI_API_KEY
cd ..
python -m uvicorn backend.main:app --reload --app-dir backend
```

Or from `backend/`:

```bash
python main.py
```

### 2. Frontend

```bash
cd frontend
npm install
npm run dev
```

Open http://localhost:5173

## API configuration (official OpenAI SDK)

| Setting | Value |
|---------|-------|
| SDK | `openai>=1.0.0` |
| Base URL | `https://api.z.ai/api/paas/v4/` |
| Model | `glm-5.1` |
| API key | https://z.ai/manage-apikey/apikey-list |

```python
from openai import OpenAI

client = OpenAI(
    api_key="your-Z.AI-api-key",
    base_url="https://api.z.ai/api/paas/v4/",
)

response = client.chat.completions.create(
    model="glm-5.1",
    messages=[{"role": "user", "content": "Hello"}],
)
```

## Restrictions layout

| File | Purpose |
|------|---------|
| `restrictions/RESTRICTIONS.md` | **Review document** — allowed/not-allowed summary from Z.AI terms |
| `restrictions/allowed.json` | Structured allowed use categories |
| `restrictions/not-allowed.json` | Structured prohibited categories with guard keywords |
| `config/restrictions-test.json` | **Test config** — all allowed & not-allowed scenarios for automated tests |

Run tests via the UI **Test Suite** tab or:

```bash
curl -X POST http://localhost:8000/api/tests/run
```

## Restriction guard modes

Set `RESTRICTION_GUARD_MODE` in `.env`:

- `enforce` — block violating prompts locally (default)
- `log_only` — detect violations but allow requests
- `disabled` — skip local checks (Z.AI server moderation still applies)

## Project structure

```
├── restrictions/          # Policy files for review
├── config/                # Test configuration
├── backend/               # FastAPI + OpenAI SDK
├── frontend/              # React + Vite UI
└── .env.example
```

## References

- [Z.AI OpenAI Python SDK guide](https://docs.z.ai/guides/develop/openai/python.md)
- [Z.AI Terms of Use](https://docs.z.ai/legal-agreement/terms-of-use.md)
- [GLM Coding Plan Usage Policy](https://docs.z.ai/devpack/usage-policy.md)
- [API error codes](https://docs.z.ai/api-reference/api-code.md)

## License

MIT — GLM-5.1 model weights are MIT-licensed by Zhipu AI.
