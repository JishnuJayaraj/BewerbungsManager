# JobCraft — Technical Design (v1)

_Last updated: 2026-06-26 — companion to [SPEC.md](./SPEC.md)_

## 1. Stack

| Layer | Choice | Why |
|---|---|---|
| Backend | **Python 3.11+ / FastAPI** | Reuses the existing HR4U Python client; async HTTP; typed Pydantic models mirror the job schema. |
| ORM / DB | **SQLModel** on **SQLite** (dev) → **Postgres** (prod-ready) | One model definition for ORM + API schema. SQLite for local-first; swap URL for Postgres later. |
| Migrations | **Alembic** | Schema evolves as features land. |
| HTTP client | **httpx** | Async, replaces stdlib `urllib` from the smoke script. |
| LLM layer | **litellm** | Unified call across Claude / OpenAI / Mistral; provider + model configured per task. |
| Frontend | **React + Vite + TypeScript** | Workspace UI, layered search, drag-drop kanban. |
| Frontend data | **TanStack Query** | Server-state caching for search/workspace/board. |
| Kanban | **dnd-kit** | Accessible drag-and-drop. |
| Validation | **Pydantic v2** (BE) / **Zod** (FE) | Typed boundaries on both sides. |

## 2. High-level architecture

```
                  ┌──────────────────────────────────────────────┐
  React (Vite) ──►│ FastAPI                                       │
   - Profile      │  /api/profile     profile CRUD + CV parse     │──► litellm ──► Claude/OpenAI/Mistral
   - Search       │  /api/search      proxy to HR4U               │     (per-task model config)
   - Workspace    │  /api/jobs/{id}   proxy to HR4U               │──► HR4U Job Search API
   - Kanban       │  /api/applications  CRUD + comms + brief      │     (/autocomplete /search /jobs)
                  │  /api/applications/{id}/brief   steer intent  │
                  │  /api/applications/{id}/fit     fit analysis  │
                  │  /api/applications/{id}/generate gen artifacts│
                  │  services/ hr4u.py  llm.py                     │
                  │  models/   SQLModel ──► SQLite/Postgres        │
                  └──────────────────────────────────────────────┘
```

The backend is the only thing holding HR4U and LLM tokens; the frontend never calls them directly.

## 3. Module layout

```
hr4u/
├── docs/                  SPEC.md, TECHNICAL.md, docs.md
├── scripts/               test_hr4u_api.py (existing smoke test)
├── .env                   HR4U_BASE_URL, HR4U_TOKEN, LLM_* (gitignored)
├── backend/
│   ├── app/
│   │   ├── main.py
│   │   ├── config.py          pydantic-settings, reads .env
│   │   ├── db.py
│   │   ├── models/            SQLModel tables
│   │   ├── schemas/           request/response + HR4U job models
│   │   ├── services/
│   │   │   ├── hr4u.py        async HR4U client
│   │   │   ├── llm.py         litellm wrapper, per-task model resolution
│   │   │   ├── cv_parser.py   CV text → structured profile
│   │   │   ├── suggest.py     profile → roles/search queries
│   │   │   ├── fit.py         profile + job + brief → fit analysis + requirements checklist
│   │   │   └── generate.py    cover letter / CV bullets / answer drafts
│   │   └── routers/           profile, search, jobs, applications, brief, fit, generate
│   └── migrations/           alembic
└── frontend/
    └── src/{api,components,features,pages}
```

## 4. Data model sketch

`user_id` is on every table from day one (local-first now, multi-user later without a rewrite).
In single-user mode it defaults to a fixed local user.

```
User
  id            uuid pk
  email         str (nullable in single-user)
  created_at

Profile                       # one per user; the "deep picture"
  id            uuid pk
  user_id       fk → User
  full_name / headline / seniority / years_exp / summary
  locations     json          # [{place, lat, lon, radius_km}]
  preferences   json          # employment_types[], job_types[], contract_types[],
                              #   occupation_areas[], salary_min, remote, deal_breakers[]
  brief_defaults json         # default tone, language, target_angle (pre-fills new briefs)
  raw_cv_text   text          # pasted CV source
  updated_at

Skill
  id / profile_id fk
  name          str
  kind          enum(IT_SKILL, SOFT_SKILL, LANGUAGE, CERT)
  level         str           # optional self-rating
  source        enum(CV, MANUAL)

Experience                    # roles/jobs held — first-class for matched evidence
  id / profile_id fk
  title / company
  start / end / is_current
  summary       text
  bullets       json          # [str] — existing CV bullets, editable
  tech          json          # [str] skills used

Project                       # notable projects — first-class for matched evidence
  id / profile_id fk
  name / role / summary
  tech          json
  links         json

Application                   # a tracked job pursuit (kanban card)
  id            uuid pk
  user_id       fk → User
  job_uuid      str           # HR4U job UUID
  job_snapshot  json          # cached job details (postings expire at source)
  job_title / company
  status        enum(SAVED, APPLIED, INTERVIEW, OFFER, REJECTED, CLOSED)
  board_order   int
  contact       json          # from HR4U counterpart, user-editable
  next_action   str           # single next step shown on the card
  followup_date date nullable
  needs_followup bool
  applied_at    datetime nullable
  created_at / updated_at
  # Readiness checklist lives in PackageChecklist (1:1), NOT on Application.

ApplicationBrief              # how the user steers intent (one per application)
  id            uuid pk
  application_id fk → Application
  target_angle  text           # picked from guided suggestions or free text
  emphasize     json           # selected evidence chips + free text
  avoid         text
  tone          str
  language      enum(DE, EN)
  company_motivation text       # "Why this company?" — feeds every artifact
  user_notes    text           # why I want this, concerns/deal-breakers, etc.
  created_at / updated_at

GeneratedArtifact             # all LLM outputs — cover letter is just one kind
  id            uuid pk
  application_id fk → Application
  kind          enum(COVER_LETTER, CV_BULLET_SUGGESTIONS, FIT_ANALYSIS,
                     PORTAL_ANSWER, ANSWER_DRAFT)
                # PORTAL_ANSWER = v1: answers to a job's application-portal free-text questions.
                # ANSWER_DRAFT  = reserved/post-MVP: interview-question prep. Distinct kinds.
  content       json|text      # structured for FIT_ANALYSIS / CV_BULLET_SUGGESTIONS / PORTAL_ANSWER
  citations     json           # [{claim_span, evidence_ref}] or {span: UNSUPPORTED}
  has_unsupported bool          # any claim not backed by profile/job evidence
  inputs_snapshot json          # profile+job+brief+company_motivation → provenance
  model_used    str
  is_current    bool            # current version per kind
  created_at

PackageChecklist              # Germany-specific readiness, 1:1 with Application (single home)
  id            uuid pk
  application_id fk → Application (unique)
  salary_expectation      str nullable       # Gehaltsvorstellung
  earliest_start_date     date nullable       # frühestmöglicher Eintrittstermin
  language_level_required  str nullable       # e.g. C1 (from job/fit)
  language_level_user      str nullable       # e.g. B2 → gap surfaced as a risk
  work_permit_status       enum(NOT_RELEVANT, EU_CITIZEN, HAVE_PERMIT, NEED_SPONSORSHIP, UNKNOWN)
  certificates_ready       bool
  cover_letter_required    bool
  items                    json               # booleans, see fixed keys below
  notes         text
  # items fixed keys: {cv_reviewed, cover_letter, requirements_checked, salary_set,
  #   start_date_set, language_ok, work_permit_ok, certificates, portal_answers,
  #   submitted, followup_set}

RequirementCheck              # LLM-extracted job requirements vs profile
  id            uuid pk
  application_id fk → Application
  requirement   str            # LLM-extracted from job text
  status        enum(HAVE, PARTIAL, MISSING)
  evidence      json           # matched skill/experience/project ids
  user_override enum nullable

CommsLogEntry                 # manual timeline
  id / application_id fk
  kind          enum(EMAIL, CALL, NOTE, EVENT)
  occurred_at   datetime
  subject       str nullable
  body          text
  direction     enum(INBOUND, OUTBOUND, NONE)
  created_at

SearchPreset                  # saved searches (replay complex queries)
  id / user_id fk
  name          str
  query_json    json           # full HR4U /search request body
  created_at
```

Notes:
- **`GeneratedArtifact` replaces a cover-letter-only table** — the app naturally produces fit
  analyses, CV bullet suggestions, and answer drafts too. `inputs_snapshot` makes any artifact
  reproducible and explains _what it was generated from_.
- `Experience` / `Project` are first-class so **matched evidence** and CV bullet tailoring have
  something concrete to cite.
- `job_snapshot` is captured at save-time so cards survive the posting expiring (`404` on
  `/jobs/{uuid}` → "expired" card state).
- `checklist` shape: `{cover_letter, cv_reviewed, requirements_checked, salary_location_ok,
  submitted, followup_set}` (booleans).

## 5. HR4U integration (layered search)

Wrap the three endpoints in `services/hr4u.py` (async httpx), carrying over what the smoke
script proves: raw `Authorization` token, host from `HR4U_BASE_URL`.

- `GET /autocomplete?phrase=&size=` → typeahead.
- `POST /search` → full body (`queries[]` single/multi/semantic, `filters[]`, `aggregations[]`,
  `highlighting`, `sort`, `page`, `size`).
- `GET /jobs/{uuid}` → detail + snapshot.

> **Query semantics (validated, see `hr4u-findings.md`):** `should` only ranks — when combined
> with any `filter` it does NOT restrict by phrase (returns the whole filter set). Basic search
> must therefore use `queryType: must` for the user's phrase + title-weighted fields. `text.fulltext`
> is raw HTML (strip it in the client). De-dup is a light client guard (duplicates agg = 0).

**The UI layers the power so it doesn't feel like an API console:**
- **Basic search** maps friendly inputs (phrase, location+radius, job type, employment type) to
  a simple request body (`queryType: must`, title-weighted) — no `must`/`should`/`isSet`/`dateFrom`
  exposed to the user.
- **Advanced filters** expose the rest behind a panel.
- **Saved presets** persist the exact request body (`SearchPreset.query_json`) for verbatim replay.

The backend builds/forwards the body so full API power remains available; the frontend decides
how much to surface. Semantic queries reuse profile text.

## 6. LLM layer (litellm) — four task modes

`llm.complete(messages, *, task)` where `task ∈ {cv_parse, suggest, fit, generate}`.

- **Per-task provider/model config** (cost-aware; no hardcoded "best model"):
  - `LLM_DEFAULT_PROVIDER`, `LLM_DEFAULT_MODEL`
  - optional per-task overrides, e.g. `LLM_GENERATE_MODEL` (higher quality for artifacts),
    `LLM_PARSE_MODEL` / `LLM_SUGGEST_MODEL` (cheaper/faster)
  - provider tokens: `ANTHROPIC_API_KEY` / `OPENAI_API_KEY` / `MISTRAL_API_KEY`
- Switching a provider = change provider + token; litellm normalizes the call.
- **Structured tasks** (`cv_parse`, `suggest`, `fit`, CV bullet suggestions) request JSON and
  validate with Pydantic; retry once on parse failure.
- **Fit analysis output** (structured): `strong_matches[]`, `weak_matches[]`, `unknowns[]`,
  `suggested_angle`, `risks_to_address[]`, `do_not_claim[]`, and `requirements[]`
  (`{requirement, status, evidence}`). The requirements checklist is **LLM-extracted** and
  produced in the **same `fit` call** (one call → fit + checklist; cheaper, consistent).
  Explanation, **not a score**.
- **Generation** supports **regenerate-with-instruction**: prior artifact + free-text steer
  ("make it shorter", "use German B2 wording") → new version, old kept.
- **Evidence-citation constraint (all generation):** the prompt requires every factual claim to
  reference profile/job evidence (skill/experience/project ids or job fields). Output carries
  `citations`; any claim it can't ground is marked `UNSUPPORTED` and `has_unsupported=true`. The
  UI highlights unsupported spans for the user to fix or remove — the anti-fabrication guarantee.
- **Artifact kinds** include `PORTAL_ANSWER` (German application-portal free-text questions).
  Cover letter is one kind among several, deliberately not privileged.

## 7. Key decisions (ADR-style)

1. **The product is the job-specific application _package_, not "cover letter generation."**
   Search is the entry point; value lands when the user assembles what a German application
   actually needs (CV bullets, fit, portal answers, checklist) — the cover letter is one
   artifact among several, not the headline.
2. **Evidence citations are mandatory on all generation.** Every claim cites profile/job
   evidence or is flagged `UNSUPPORTED`. _Why:_ honesty/anti-fabrication is the product's
   trust anchor, especially for relocating users who can't afford embellishment to backfire.
3. **LLM gives fit _explanation_ on saved jobs, not per-result ranking.** Useful and cheap;
   avoids the expense/opacity of scoring every search hit.
4. **CV _tailoring_, not rewriting.** Suggest 2–4 bullet edits + emphasis; never fabricate.
   Honesty (`do_not_claim`, `MISSING` requirements) is first-class.
5. **`GeneratedArtifact` over a cover-letter-only table.** The app emits several artifact kinds;
   one versioned, provenance-carrying table covers them.
6. **`ApplicationBrief` is the steering surface.** Separating intent (angle/emphasize/avoid/tone)
   from output lets the user shape generation deliberately.
7. **Layered search (basic / advanced / presets).** Full API power retained, API jargon hidden.
8. **Per-task model config; no hardcoded "best model."** Quality where it matters, cost elsewhere.
9. **Paste CV text in v1; PDF/DOCX later; manual editor always.** Cuts early parsing pain.
10. **`user_id` everywhere (local-first, multi-user-ready).** No rewrite when accounts arrive.
11. **Snapshot job details at save-time.** Postings expire; the board must stay meaningful.
12. **Backend owns all secrets.** Never ship HR4U/LLM tokens to the browser.
13. **Manual comms log (no inbox sync) in v1.** Defer the biggest complexity sink.

## 8. Configuration (.env)

Already present locally (gitignored): `HR4U_BASE_URL`, `HR4U_TOKEN`. Add for the LLM + app:

```
# HR4U (present)
HR4U_BASE_URL=...
HR4U_TOKEN=...

# LLM (litellm) — per-task models, cost-aware
LLM_DEFAULT_PROVIDER=anthropic
LLM_DEFAULT_MODEL=...                 # pick per cost/quality, not hardcoded "best"
# LLM_GENERATE_MODEL=...              # optional: higher quality for cover letters
# LLM_PARSE_MODEL=...                 # optional: cheaper/faster for parsing/suggest
ANTHROPIC_API_KEY=...
# OPENAI_API_KEY=...
# MISTRAL_API_KEY=...

# App
DATABASE_URL=sqlite:///./jobcraft.db
SINGLE_USER=true
```

`config.py` loads these via `pydantic-settings`; supersedes the smoke-script `.env` loader.

## 9. Build sequence (matches SPEC §10 MVP)

1. Backend skeleton: config, db, models, `services/hr4u.py` (port smoke client to httpx).
2. Profile editor + **paste CV text** parse (Skill/Experience/Project).
3. Search (basic tier) + **save job** → creates `Application` + snapshot.
4. Job workspace + **guided `ApplicationBrief`** (angles/prompts) + **company motivation**.
5. **Fit analysis** (`services/fit.py`) + LLM requirements checklist (one call).
6. **CV bullet tailoring** suggestions (before/after diff) — CV-first.
7. **Cover letter** generation + versioning with **evidence citations** (`GeneratedArtifact`).
8. **Portal/application answer** drafting (`PORTAL_ANSWER`).
9. **Germany `PackageChecklist`** on workspace + card.
10. Kanban + next action / follow-up date + comms log.
11. Alembic migrations; validate Postgres switch.

## 10. Accepted extended features (from SPEC §11)

- **Guided brief builder:** `ApplicationBrief.target_angle`/`emphasize` populated from
  suggested angles + matched-evidence chips; free text remains a fallback.
- **Company-motivation helper:** `ApplicationBrief.company_motivation` feeds every artifact's
  `inputs_snapshot`.
- **Evidence citations:** `GeneratedArtifact.citations` + `has_unsupported`; enforced in prompt,
  surfaced in UI. Anti-fabrication guarantee.
- **Germany `PackageChecklist`:** salary, start date, certificates, language level (required vs
  user), work permit, portal-answer status; gaps surface as fit-analysis risks.
- **Portal/application answers:** `GeneratedArtifact` kind `PORTAL_ANSWER`.
- **Requirements checklist (`RequirementCheck`): LLM-extracted**, produced in the same `fit`
  call; matched HAVE/PARTIAL/MISSING against profile evidence.
- **Before/after diff view** for CV bullet suggestions (original + suggested in the
  `CV_BULLET_SUGGESTIONS` artifact).
- **Export** CV bullets + cover letter + portal answers to Markdown/clipboard/PDF.
- **`brief_defaults` on Profile** pre-fill each new brief (default tone/language/angle).
- **Interview-prep** (post-MVP) as a `GeneratedArtifact` of kind `ANSWER_DRAFT` (already reserved).

## 11. Open technical questions

- SQLite vs Postgres for the first hosted multi-user deployment.
- Rate limiting / caching for HR4U search calls.
- File storage for original CV uploads once PDF/DOCX + multi-user land.
