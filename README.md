# JobCraft

Prepare a **job-specific application package** for the German job market: build a profile once,
search live jobs (HR4U API), and for each role understand your fit and assemble what you actually
need: tailored CV bullets, fit analysis, a cover letter when required, portal answers, and a
Germany-specific readiness checklist, then track the next action on a kanban board.

Target user (v1): **tech / IT professionals**, including emigrants.

## Docs

| Doc | Purpose |
|---|---|
| [docs/SPEC.md](docs/SPEC.md) | Product spec: what is being built and why. |
| [docs/TECHNICAL.md](docs/TECHNICAL.md) | Stack, architecture, data model, key decisions. |
| [docs/API.md](docs/API.md) | Backend endpoint contract. |
| [docs/LLM_CONTRACTS.md](docs/LLM_CONTRACTS.md) | Exact JSON each LLM task returns. |
| [docs/UI.md](docs/UI.md) | Screen inventory and endpoint use. |
| [docs/TASKS.md](docs/TASKS.md) | Ordered implementation tasks. |
| [docs/hr4u-findings.md](docs/hr4u-findings.md) | Live HR4U API validation results. |
| [docs/docs.md](docs/docs.md) | Upstream HR4U Job Search API reference. |

## Backend

```bash
cp .env.example .env
cd backend
uv sync
uv run uvicorn app.main:app --reload --host 127.0.0.1 --port 8000
```

Health and settings:

```bash
curl http://127.0.0.1:8000/health
curl http://127.0.0.1:8000/api/settings
```

Settings are loaded from the repository-root `.env`. `LLM_DEFAULT_PROVIDER` defaults to `mistral`
for the EU/GDPR-friendly provider. Cloud providers such as Anthropic and OpenAI are opt-in, and
backend endpoints never expose HR4U or LLM tokens.

Run backend tests:

```bash
cd backend
uv run pytest
```

## Frontend

```bash
cd frontend
npm install
npm run dev
```

The Vite app serves at `http://127.0.0.1:5173/` by default. Placeholder routes are available at
`/profile`, `/search`, and `/board`.

Build the frontend:

```bash
cd frontend
npm run build
```

## Existing HR4U Smoke Test

```bash
python scripts/test_hr4u_api.py --include-negative-auth
```
