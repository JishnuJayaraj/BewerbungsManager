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

## Quick start (one command)

```bash
cp .env.example .env          # fill in HR4U_* and LLM_* keys
./run.sh                      # migrate + seed demo data, then run backend + frontend
```

`./run.sh --no-seed` skips the demo data. Backend serves on `http://localhost:8000`, frontend on
`http://localhost:5173` (Vite proxies `/api` and `/health` to the backend). Requires `uv` and `npm`.

The demo seed creates one profile and one saved application (a Berlin "Senior Python Engineer")
so the UI has content on first load — search → save → brief → fit → generate → board.

## Run as a home server (one port, accessible on your WiFi)

To let another device on your network use it (e.g. a spare laptop acting as the server),
build the frontend once and serve everything from FastAPI on a single port:

```bash
cp .env.example .env          # fill keys
./serve.sh                    # builds UI, migrates, serves on 0.0.0.0:8000
```

Then on any device on the same WiFi open `http://<server-ip>:<port>` (the script prints the URL;
find the IP with `hostname -I`). Notes:
- The app is **single-user** (no accounts) — one running instance = one shared profile + board.
  For separate people, run separate instances with their own `DATABASE_URL`.
- Keep the server machine awake; allow the port through its firewall; LLM calls run on your key.

## Backend

```bash
cp .env.example .env
cd backend
uv sync
uv run alembic upgrade head            # create/upgrade the schema
uv run python -m app.seed              # optional: demo profile + application (idempotent)
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

Run backend tests (includes the end-to-end happy path `tests/test_e2e_happy_path.py`, which
drives search → save → brief → fit → generate → board with the HR4U client and LLM services faked):

```bash
cd backend
uv run pytest
```

### Postgres (multi-user-ready)

The schema is database-agnostic (portable SQLAlchemy types: `Uuid`, `JSON`, `Enum`, …), so the
same migration applies on Postgres. Switch by pointing `DATABASE_URL` at Postgres and installing
the driver:

```bash
cd backend
uv sync --extra postgres                                   # installs psycopg
export DATABASE_URL="postgresql+psycopg://user:pass@localhost:5432/jobcraft"
uv run alembic upgrade head
uv run python -m app.seed                                  # optional demo data
```

## Frontend

```bash
cd frontend
npm install
npm run dev
```

The Vite app serves at `http://127.0.0.1:5173/` by default, with screens for Profile, Search,
Workspace (brief/fit/artifacts/checklist/comms), Board (kanban), and Settings/privacy.

Build the frontend:

```bash
cd frontend
npm run build
```

## Existing HR4U Smoke Test

```bash
python scripts/test_hr4u_api.py --include-negative-auth
```
