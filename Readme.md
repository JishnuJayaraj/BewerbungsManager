# JobCraft

Prepare a **job-specific application package** for the German job market: build a profile once,
search live jobs (HR4U API), and for each role understand your fit and assemble what you actually
need — tailored CV bullets, fit analysis, a cover letter when required, portal answers, and a
Germany-specific readiness checklist — then track the next action on a kanban board.

Target user (v1): **tech / IT professionals**, incl. emigrants (English-language roles are well
covered — see findings).

## Status

Planning complete; implementation not started. The HR4U API is validated (**GO**). Build by
working through `docs/TASKS.md` in order — the next executable task is **Task 01A**.

## Docs (read in this order)

| Doc | Purpose |
|---|---|
| [docs/SPEC.md](docs/SPEC.md) | Product spec — what we're building and why. |
| [docs/TECHNICAL.md](docs/TECHNICAL.md) | Stack, architecture, data model, key decisions. |
| [docs/API.md](docs/API.md) | Backend endpoint contract (FE↔BE). |
| [docs/LLM_CONTRACTS.md](docs/LLM_CONTRACTS.md) | Exact JSON each LLM task returns. |
| [docs/UI.md](docs/UI.md) | Screen inventory + endpoints per screen. |
| [docs/TASKS.md](docs/TASKS.md) | Ordered, self-contained build tasks (the loop). |
| [docs/hr4u-findings.md](docs/hr4u-findings.md) | Live HR4U API validation results. |
| [docs/docs.md](docs/docs.md) | Upstream HR4U Job Search API reference. |

## For the implementation agent

1. Read `docs/SPEC.md` + `docs/TECHNICAL.md`, then **only the current task** in `docs/TASKS.md`
   (plus the contract docs that task's Inputs name). Don't read ahead.
2. Implement within the task's Scope; satisfy every "Done when"; tick the checkbox; fill the
   one-line Handoff note; commit as `task NN: <title>`. Then context can be cleared.
3. Stack: Python/FastAPI + SQLModel (backend), React/Vite/TS (frontend), litellm (swappable LLMs,
   **EU/Mistral default** for GDPR). Backend owns all secrets.

## Setup

```bash
cp .env.example .env     # fill in HR4U_TOKEN, HR4U_BASE_URL, and LLM_* keys
python -m venv .venv && source .venv/bin/activate
```

Smoke-test the HR4U API:

```bash
python scripts/test_hr4u_api.py --include-negative-auth
```

`.env` is gitignored — never commit secrets.
