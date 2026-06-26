# JobCraft Backend

FastAPI backend for JobCraft.

## Run locally

From the repository root:

```bash
cp .env.example .env
cd backend
uv sync
uv run uvicorn app.main:app --reload --host 127.0.0.1 --port 8000
```

Then check:

```bash
curl http://127.0.0.1:8000/health
curl http://127.0.0.1:8000/api/settings
```

## Configuration

Settings are loaded from the repository-root `.env` using `pydantic-settings`.

The default LLM provider is `mistral`, the EU/GDPR-friendly provider for local-first v1.
Cloud providers such as Anthropic and OpenAI are opt-in by setting `LLM_DEFAULT_PROVIDER`
and the matching API key. Backend endpoints never return HR4U or LLM secrets.
