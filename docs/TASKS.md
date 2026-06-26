# JobCraft — Implementation Tasks

Ordered, self-contained build tasks. Each is sized for **one agent session** and is designed so
context can be cleared between tasks without losing the thread.

Source of truth:
- [SPEC.md](./SPEC.md) — product.
- [TECHNICAL.md](./TECHNICAL.md) — stack, data model, decisions.
- [API.md](./API.md) — backend endpoints, request/response/error shapes (FE↔BE contract).
- [LLM_CONTRACTS.md](./LLM_CONTRACTS.md) — exact JSON each LLM task returns.
- [UI.md](./UI.md) — screen inventory + which endpoints each screen calls.
- [docs.md](./docs.md) — the HR4U API contract; client to port: [`scripts/test_hr4u_api.py`](../scripts/test_hr4u_api.py).

---

## How to run a task (agent protocol)

For each task, in order:
1. Read **SPEC.md**, **TECHNICAL.md**, and **only the current task** in this file, plus the
   contract docs the task's Inputs name (**API.md** for any endpoint work, **LLM_CONTRACTS.md**
   for any LLM task, **UI.md** for any screen). Do not read ahead — later tasks are out of scope.
2. Confirm the task's **Depends on** are checked off. If not, stop and report.
3. Implement strictly within the task's **Scope**. Do not build features owned by later tasks
   (a "Not in this task" list is given to prevent scope creep).
4. Satisfy every **Done when** check. Run the verification commands listed.
5. Tick the task's checkbox (`[ ]` → `[x]`) and fill the **Handoff note** (one line: what exists
   now, anything the next task should know). Keep notes terse.
6. Commit with message `task NN: <title>`. Then the context can be safely cleared.

Rules that apply to every task:
- Stay within the module layout in TECHNICAL §3. New deps must be justified by a task.
- Backend owns all secrets; never expose HR4U/LLM tokens to the frontend.
- `user_id` on every owned row; single-user mode uses the fixed local user.
- If a task reveals the spec is wrong/ambiguous, stop and surface it rather than guessing.

Legend: `[ ]` todo · `[x]` done · **B** backend · **F** frontend · **X** cross-cutting.

---

## Phase 0 — De-risk & foundation

### [x] Task 00 — Validate the HR4U API (X) — GATE
- **Depends on:** none.
- **Why first:** the whole premise depends on this single data source (TECHNICAL §11 risk).
- **Inputs:** `.env` (has `HR4U_BASE_URL`, `HR4U_TOKEN`), `scripts/test_hr4u_api.py`, `docs.md`.
- **Scope:** Run the smoke test against the real host. Probe coverage with a few IT/tech phrases
  (DE + EN), exercise `aggregations` for `duplicates`, `sources`, `employmentTypes`,
  `occupationAreas`. Record: does auth work, latency, how many hits for tech roles, how bad is
  duplication, are English-language roles present/taggable, what `/jobs/{uuid}` returns.
- **Outputs:** `docs/hr4u-findings.md` — concise findings + any schema surprises vs `docs.md` +
  a go/no-go note. No app code.
- **Done when:** smoke test passes (or failure is documented with cause); findings file answers
  coverage / duplication / English-role / freshness; any divergence from `docs.md` is noted.
- **Not in this task:** writing the app client (that's Task 03).
- **Handoff note:** _Done — **GO**. Host `https://job-search-api.hr4you.org`; auth + all 3
  endpoints work; strong IT coverage; English roles abundant; semantic query is high quality.
  Full results in `docs/hr4u-findings.md`. **Two findings that change later tasks:** (1) `should`
  + any filter does NOT restrict by phrase (returns everything in the filter) — basic search must
  use `queryType: must` + title-weighted fields (Task 04); (2) `text.fulltext` is raw HTML — strip
  it in the client mapping (Task 03). De-dup is a non-issue (duplicates agg = 0) → light guard only._

### [x] Task 00B — Reconcile docs & contracts (X)
- **Depends on:** none (pre-implementation; can run alongside 00).
- **Inputs:** SPEC.md, TECHNICAL.md, TASKS.md.
- **Scope:** Eliminate spec drift before coding. Fix broken cross-references; resolve the data-model
  decisions (checklist = single `PackageChecklist` table, **not** `Application.checklist`;
  `PORTAL_ANSWER` distinct from `ANSWER_DRAFT`; `ApplicationBrief.company_motivation` present;
  fixed Germany-checklist fields). Add **API.md**, **LLM_CONTRACTS.md**, **UI.md**. Ensure data
  model, artifact kinds, endpoint names, screen names, and task names match everywhere.
- **Outputs:** `docs/API.md`, `docs/LLM_CONTRACTS.md`, `docs/UI.md`; reconciled SPEC/TECHNICAL/TASKS.
- **Done when:** no task references a missing section; every FE-needed endpoint is in API.md; every
  LLM output has a schema in LLM_CONTRACTS.md; checklist/artifact-kind/brief-field conflicts gone.
- **Handoff note:** _Done. Three contract docs added; `Application.checklist` removed in favor of
  `PackageChecklist` (1:1); `PORTAL_ANSWER`≠`ANSWER_DRAFT` documented; broken `pitfalls #N` refs
  in Tasks 05/09 replaced with concrete text. API.md/LLM_CONTRACTS.md/UI.md are authoritative._

### [x] Task 01A — Backend scaffold & config (B)
- **Depends on:** 00, 00B.
- **Inputs:** TECHNICAL §1, §3, §8; API.md (conventions, `/health`, `/api/settings`).
- **Scope:** Create `backend/` (FastAPI + pyproject/uv, `app/main.py` with `GET /health`,
  `app/config.py` via pydantic-settings reading `.env`). `.gitignore` (`.env`, db files). Config
  reads all keys in TECHNICAL §8 incl. per-task LLM model overrides, `DATABASE_URL`, `SINGLE_USER`.
  **GDPR default:** `LLM_DEFAULT_PROVIDER` defaults to the EU provider (Mistral); cloud providers
  opt-in (note in config docstring + README). Implement read-only `GET /api/settings` (API.md).
  Error-shape middleware per API.md.
- **Outputs:** runnable backend; root `README.md` (backend run instructions).
- **Done when:** backend boots, `/health` → 200, `/api/settings` returns provider + gdpr notice
  (no secrets); config loads `.env` without crashing when optional keys absent; error shape matches
  API.md.
- **Not in this task:** models, feature endpoints, frontend.
- **Handoff note:** _Done. FastAPI backend scaffold added with pydantic-settings config, Mistral/GDPR default, `/health`, read-only `/api/settings`, normalized API error shape, uv project/tests, and README run instructions._

### [x] Task 01B — Frontend scaffold (F)
- **Depends on:** 01A.
- **Inputs:** TECHNICAL §1, §3 (frontend layout).
- **Scope:** Create `frontend/` (Vite + React + TS, TanStack Query + Zod installed). Build runs
  and serves a placeholder page; basic routing skeleton with empty Profile / Search / Board
  routes. Toolchain only — proves the frontend builds and runs.
- **Outputs:** runnable frontend (`npm run dev`); README updated with frontend run.
- **Done when:** dev server serves; the three routes resolve to placeholder pages; `npm run build`
  succeeds.
- **Not in this task:** API client wiring, nav chrome, privacy notice (Task 11); feature screens
  (Tasks 12–16).
- **Handoff note:** _Done. Vite React/TS frontend scaffold added with TanStack Query, Zod, basic Profile/Search/Board placeholder routes, README run instructions, and passing production build._

---

## Phase 1 — Backend core

### [x] Task 02 — Data models & migrations (B)
- **Depends on:** 00B, 01A.
- **Inputs:** TECHNICAL §4 (full data model, reconciled), §7 decisions 10–11.
- **Scope:** Define all SQLModel tables from TECHNICAL §4: User, Profile, Skill, Experience,
  Project, Application, ApplicationBrief, GeneratedArtifact, RequirementCheck, PackageChecklist,
  CommsLogEntry, SearchPreset. Note: the readiness checklist is the **`PackageChecklist` table
  (1:1 with Application)** — there is **no** `checklist` field on `Application`. `user_id` on every
  owned table. `app/db.py` (engine/session, fixed local user when `SINGLE_USER`). Init Alembic +
  first migration.
- **Outputs:** `app/models/*`, `app/db.py`, `migrations/` with one migration that creates the schema.
- **Done when:** `alembic upgrade head` builds the schema on a fresh SQLite db; a seed of the local
  user works; models import cleanly. Enums match the spec (artifact kinds incl. `PORTAL_ANSWER`,
  `ANSWER_DRAFT`; statuses; requirement HAVE/PARTIAL/MISSING).
- **Not in this task:** endpoints, services, business logic.
- **Handoff note:** _Done. SQLModel tables/enums, `app/db.py` engine/session/local-user seed, Alembic initial schema migration, and focused model tests added; fresh SQLite upgrade verified._

### [x] Task 03 — HR4U async client service (B)
- **Depends on:** 00, 02.
- **Inputs:** `scripts/test_hr4u_api.py`, `docs.md`, `docs/hr4u-findings.md`, TECHNICAL §5.
- **Scope:** `app/services/hr4u.py` — async httpx client wrapping `/autocomplete`, `POST /search`,
  `GET /jobs/{uuid}`. Raw `Authorization` header, host from config. Pydantic schemas mirroring the
  job shape (`app/schemas/hr4u.py`). Map `404` from job details to a typed "expired" result.
  Include a request-body builder helper (queries/filters/aggregations/sort/page/size). **Per
  findings:** strip HTML from `text.fulltext` in the schema mapping (downstream LLM consumers need
  clean text); tolerate missing/empty sub-fields (`benefits`) and sparse `counterpart`.
- **Outputs:** `app/services/hr4u.py`, `app/schemas/hr4u.py`, a small live/mocked test.
- **Done when:** client fetches real search + autocomplete + one job detail (or mocked if API
  unavailable, with a live test guarded by env); schemas parse the real response without loss of
  the fields the app needs (title, fulltext, requirements, addresses, counterpart, classifications).
- **Not in this task:** HTTP routes, search UI, semantic/profile wiring.
- **Handoff note:** _Done. Async httpx HR4U client, flexible job schemas with cleaned `text.fulltext`, request-body builder, typed expired detail result, mocked tests, and guarded live smoke test added._

### [x] Task 04 — Search & job-detail endpoints with de-dup (B)
- **Depends on:** 03.
- **Inputs:** TECHNICAL §5 (layered search), SPEC §5.2, `docs/hr4u-findings.md` (duplication);
  API.md (search/jobs/presets endpoints + response shapes).
- **Scope:** `app/routers/search.py` + `jobs.py`. Endpoints: basic search (friendly inputs →
  request body), advanced passthrough (full body), autocomplete, job detail. Saved-search CRUD
  (`SearchPreset`, stores exact `query_json`). **Per findings (critical):** the basic-search builder
  must set `queryType: must` for the user's phrase whenever any filter (location/radius/job/
  employment type) is applied — `should` + a filter does NOT restrict by phrase and returns the
  whole filter set. Default basic search to `must` + title-weighted fields for precision. De-dup is
  a **light client guard** (drop identical `uuid`/`link`), not a core feature (duplicates agg = 0).
- **Outputs:** search/jobs routers + request/response schemas; SearchPreset CRUD.
- **Done when:** `POST /api/search/basic` and `POST /api/search/advanced` return deduped jobs (basic
  query and full advanced body respectively); autocomplete works; presets save and replay verbatim;
  job-detail returns detail or a typed "expired" for unknown UUID.
- **Not in this task:** LLM, profile, saving an application.
- **Handoff note:** _Done. Search/jobs routers added with basic must/title-field builder, advanced passthrough, autocomplete, light de-dup, typed expired detail response, and SearchPreset CRUD preserving query JSON._

### [x] Task 05 — LLM layer + evidence-citation verifier (B)
- **Depends on:** 01A.
- **Inputs:** TECHNICAL §6, SPEC §6, §7 decisions 2 & 8; LLM_CONTRACTS.md (output schemas +
  "Citation verification" section, which defines the exact v1 rule).
- **Scope:** `app/services/llm.py` — litellm wrapper `complete(messages, *, task)` with per-task
  provider/model resolution (EU default), structured-JSON request + Pydantic validation + one
  retry. **`app/services/citations.py`** — deterministic verifier implementing the v1 rule from
  LLM_CONTRACTS.md exactly: a claim is `SUPPORTED` **iff** its `evidence_ref` is a syntactically
  valid typed id (`skill:/experience:/project:/job:<field>`) **and** that id exists in this
  application's profile/job inputs with the right source type. Anything else → `UNSUPPORTED`.
  **v1 verifies citation existence + source type only — NOT semantic truth.** Do not implement
  fuzzy "key terms appear" matching; do not over-promise semantic verification.
- **Outputs:** `app/services/llm.py`, `app/services/citations.py`, unit tests for the verifier.
- **Done when:** a mocked completion validates/repairs JSON; switching `LLM_DEFAULT_PROVIDER` +
  token changes provider with no other code change; the verifier marks a ref to a non-existent or
  wrong-type id, and an `UNSUPPORTED` self-report, as UNSUPPORTED, and a valid existing ref as
  SUPPORTED.
- **Not in this task:** the actual CV/fit/generate prompts (later tasks consume this layer).
- **Handoff note:** _Done. LiteLLM wrapper added with per-task provider/model/key resolution, JSON validation plus one repair retry, deterministic v1 citation verifier, and focused tests._

---

## Phase 2 — Backend LLM features

### [x] Task 06 — Profile: paste-CV parsing + profile CRUD (B)
- **Depends on:** 02, 05.
- **Inputs:** SPEC §5.1, TECHNICAL §4 (Profile/Skill/Experience/Project), §6 (`cv_parse`);
  API.md (`/api/profile*`); LLM_CONTRACTS.md §1 (`cv_parse` schema).
- **Scope:** `app/services/cv_parser.py` (pasted text → structured Profile + Skill/Experience/
  Project as JSON, validated). `app/routers/profile.py` — CRUD for profile, skills, experiences,
  projects, and `brief_defaults`. Manual editing must be fully supported (no parse required).
- **Outputs:** cv_parser service, profile router, schemas.
- **Done when:** posting CV text yields a structured, editable profile; manual create/edit of each
  entity works; `brief_defaults` persist; parsing failure degrades to an empty editable profile.
- **Not in this task:** PDF/DOCX upload (non-goal v1); any job/workspace logic.
- **Handoff note:** _Done. CV parser service, profile router, profile schemas, manual profile/skill/experience/project CRUD, brief_defaults persistence, and parse-failure fallback tests added._

### [x] Task 07 — Save job → application, brief, comms (B)
- **Depends on:** 02, 04.
- **Inputs:** SPEC §5.3 (workspace, guided brief, company motivation), §5.5 (comms log), TECHNICAL §4
  (Application/ApplicationBrief/CommsLogEntry), §7 decision 11 (snapshot at save-time); API.md
  (`/api/applications*`, `.../brief`, `.../comms`).
- **Scope:** `app/routers/applications.py`:
  - **Save a job** (creates `Application` + `job_snapshot`; idempotent per `job_uuid` → 409).
  - **Application list / get / PATCH / delete** — `PATCH` covers `status`, `board_order`,
    `next_action`, `followup_date`, `needs_followup`, `contact` (needed by the kanban board, Task 16).
  - **`ApplicationBrief` GET/PUT** (target_angle, emphasize chips + free text, avoid, tone,
    language, `company_motivation`, user_notes); pre-fill from profile `brief_defaults`.
  - **`CommsLogEntry` CRUD** (`.../comms` GET/POST/DELETE) — the manual comms timeline.
- **Outputs:** applications router (full CRUD + PATCH), brief endpoints, comms endpoints, schemas.
- **Done when:** saving a job snapshots its details and creates an application; list/PATCH/delete
  work (status + board_order + next_action persist); brief saves/loads and is pre-filled from
  `brief_defaults`; comms entries create/list/delete; deleting a job source later doesn't break the card.
- **Not in this task:** fit analysis, generation, checklist (Task 10), board UI.
- **Handoff note:** _Done. Applications router added with save/snapshot/idempotency, list/get/patch/delete, brief prefill/update, comms log CRUD, schemas, and route tests._

### [x] Task 08 — Fit analysis + requirements checklist (B)
- **Depends on:** 05, 06, 07.
- **Inputs:** SPEC §5.3–5.4, §6 mode 3; TECHNICAL §6 (single `fit` call), §4 (RequirementCheck);
  API.md (`.../fit`, `.../requirements/*`); LLM_CONTRACTS.md §3 (`fit` schema).
- **Scope:** `app/services/fit.py` — one `fit` LLM call producing structured fit analysis
  (`strong_matches`, `weak_matches`, `unknowns`, `suggested_angle`, `risks_to_address`,
  `do_not_claim`) **and** the LLM-extracted requirements checklist (have/partial/missing + evidence)
  in the same call. Persist as a `FIT_ANALYSIS` artifact + `RequirementCheck` rows. Surface
  language-level / requirement gaps as honest risks.
- **Outputs:** fit service, fit endpoint, persistence of analysis + requirement checks.
- **Done when:** running fit on a saved job returns explanation (not a score) + a checklist matched
  to the profile; evidence refs point at real profile entities; re-running creates a new version.
- **Not in this task:** cover letter / CV bullets / portal answers.
- **Handoff note:** _Done. Fit service/router added with single-call fit schema, FIT_ANALYSIS artifact versioning, RequirementCheck replacement/override, profile-evidence filtering, and route tests._

### [x] Task 09 — Artifact generation (CV bullets, cover letter, portal answers) (B)
- **Depends on:** 05, 07, 08.
- **Inputs:** SPEC §5.3–5.4, §6 mode 4, §7 (regenerate-with-instruction); TECHNICAL §6, §7
  decisions 1 & 2; LLM_CONTRACTS.md §4 (exact `generate` output schemas, incl. the `format=anschreiben`
  rule: German cover letters use Betreff, Sie-form, "Sehr geehrte …", "Mit freundlichen Grüßen";
  CV tailoring is bullet-level, not a Lebenslauf rewrite); API.md (`/api/applications/{id}/generate`,
  `/api/artifacts/{id}`, `/api/artifacts/{id}/export`).
- **Scope:** `app/services/generate.py` producing `GeneratedArtifact`s of kinds
  `CV_BULLET_SUGGESTIONS` (with original+suggested for before/after diff), `COVER_LETTER` (German
  *Anschreiben* conventions when language=DE), and `PORTAL_ANSWER` (requires `portal_question`).
  Inputs = profile + job + brief + company_motivation. **Run every output through the citation
  verifier (Task 05)**; set `citations` + `has_unsupported`; honor fit's `do_not_claim`. Support
  regenerate-with-instruction (new version, old kept; `is_current` per kind). Also implement the
  **export backend** `GET /api/artifacts/{id}/export?format=markdown|pdf` (Markdown + PDF; the
  Task 15 UI's copy-to-clipboard is client-side and needs no endpoint).
- **Outputs:** generate service, generation + artifact-read + export endpoints, versioning.
- **Done when:** each kind generates; DE cover letter follows Anschreiben form; unsupported claims
  are flagged not hidden; regenerate produces a new version preserving history; export returns a
  Markdown and a PDF rendering of an artifact.
- **Not in this task:** UI, checklist.
- **Handoff note:** _Done. Generate service/router added for cover letters, CV bullet suggestions, and portal answers with citation verification, version history/current flags, artifact read/list, and Markdown/PDF export._

### [x] Task 10 — Germany package checklist + job suggestions (B)
- **Depends on:** 06, 07, 08.
- **Inputs:** SPEC §5.6 (PackageChecklist), §5.2 (LLM job suggestions), §6 mode 2; TECHNICAL §4;
  API.md (`.../checklist`, `/api/suggestions`); LLM_CONTRACTS.md §2 (`suggest` schema).
- **Scope:** `PackageChecklist` CRUD endpoints (salary, start date, certificates, language levels,
  work-permit relevance, portal-answer status, item booleans, notes); language-gap auto-flag from
  fit. `app/services/suggest.py` — profile → shortlist of roles + ready-made HR4U search queries.
- **Outputs:** checklist router, suggest service + endpoint.
- **Done when:** checklist persists per application and reflects language gaps from fit; suggestions
  return runnable queries that the search endpoint accepts.
- **Not in this task:** UI.
- **Handoff note:** _Done. PackageChecklist GET/PUT added with auto-create, Germany item normalization, fit-derived German language gap prefill, plus `/api/suggestions` backed by LLM suggest output and runnable HR4U search bodies._

---

## Phase 3 — Frontend

### [x] Task 11 — Frontend foundation (F)
- **Depends on:** 01B, and at least 04 (endpoints to call).
- **Inputs:** TECHNICAL §1, §3 frontend layout; API.md (client conventions, error shape,
  `/api/settings`); UI.md §6 (settings/privacy) + global nav.
- **Scope:** typed API client (Zod) against API.md conventions + error shape, TanStack Query setup,
  app shell/routing, nav between Profile / Search / Board / Workspace, and the **Settings/privacy**
  screen (active provider + GDPR notice from `/api/settings`; EU default) per SPEC §9 / UI.md §6.
- **Outputs:** `frontend/src/{api,components,pages}` with routing + typed API client + settings page.
- **Done when:** all top-level routes render; API client calls `/health`, `/api/settings`, and
  search successfully; privacy notice visible; API errors parse to the API.md error shape.
- **Not in this task:** feature screens.
- **Handoff note:** _Done. Typed Zod API client + TanStack query hooks added for health/settings/basic search and API errors; app shell/nav routes Profile/Search/Board/Workspace/Settings; settings/privacy notice is live from `/api/settings`; Vite proxy verified against backend._

### [x] Task 12 — Profile editor UI (F)
- **Depends on:** 06, 11.
- **Inputs:** SPEC §5.1; UI.md §1 (Profile page); API.md (`/api/profile*`).
- **Scope:** paste-CV box → parse → editable profile (skills/experiences/projects, bullets editable),
  `brief_defaults` editor. Manual add/edit always available.
- **Done when:** user can paste a CV, review/edit parsed data, and save; manual editing works with
  no parse.
- **Handoff note:** _Done. Profile page now loads/saves identity + brief defaults, parses pasted CV into editable state, and supports manual create/update/delete for skills, experiences with bullets, and projects via typed API hooks._

### [x] Task 13 — Search UI + save job (F)
- **Depends on:** 04, 07 (save-to-board: `POST /api/applications`), 10 (`/api/suggestions`), 11.
- **Inputs:** SPEC §5.2 (layered), TECHNICAL §5; UI.md §2 (Search page); API.md (`/api/search*`,
  `/api/jobs/*`, `/api/suggestions`).
- **Scope:** basic search (phrase, location+radius, job/employment type), advanced filter panel
  (the rest), aggregation facets, results list, job detail, save-to-board, saved presets. No API
  jargon in the basic tier.
- **Done when:** basic + advanced search work, facets filter, a job can be saved (creates
  application), presets save/replay.
- **Handoff note:** _Done. Search page now supports basic search, advanced HR4U filters, aggregation facets, job detail, save-to-board with workspace link, suggestions replay, and saved preset create/replay/delete via typed API hooks._

### [x] Task 14 — Workspace UI: brief, fit, requirements, evidence (F)
- **Depends on:** 07, 08, 12, 13.
- **Inputs:** SPEC §5.3, §5.4; UI.md §3 (Workspace); API.md (`/api/applications/{id}*`, `.../brief`,
  `.../fit`, `.../requirements/*`).
- **Scope:** workspace screen — job snapshot, **guided brief builder** (selectable angles +
  evidence chips + free text), **company-motivation** section, **fit analysis** panel (strong/weak/
  unknowns/angle/risks), **requirements checklist** (have/partial/missing), **matched evidence**.
  Missing-info prompts before running fit/generation.
- **Done when:** user can build a brief from suggestions, run fit, and see the checklist + cited
  evidence; missing-info prompts pre-fill the brief.
- **Handoff note:** _Done. Workspace page now loads saved applications, shows job snapshots, edits guided briefs with evidence chips/company motivation/prompts, runs/loads fit, renders fit sections, requirement checklist with overrides, and matched evidence via typed API hooks._

### [x] Task 15 — Artifacts UI: generation, citations, diff, regenerate, export (F)
- **Depends on:** 09, 14.
- **Inputs:** SPEC §5.3 (artifacts, citations, export), §7 (regenerate); UI.md §4 (Artifacts panel);
  API.md (`.../generate`, `/api/artifacts/*`); LLM_CONTRACTS.md §4 (artifact content shapes).
- **Scope:** generate/view cover letter, CV bullet **before/after diff**, portal answers; highlight
  **unsupported** spans; regenerate-with-instruction control; version switcher; **export** to
  Markdown/clipboard/PDF.
- **Done when:** each artifact generates and renders; unsupported claims are visibly flagged; diff
  shows old vs new bullets; regenerate keeps history; export produces usable output.
- **Handoff note:** _Done. Workspace artifacts panel supports cover letter/CV bullets/portal answer generation, regenerate instructions, version switching, citation and unsupported-claim rendering, CV before/after diff, Markdown/copy/PDF export via typed artifact API hooks._

### [ ] Task 16 — Kanban board, next action, comms log, package checklist (F)
- **Depends on:** 07, 10, 14.
- **Inputs:** SPEC §5.5, §5.6; UI.md §5 (Kanban board); API.md (`/api/applications`, `.../comms`,
  `.../checklist`).
- **Scope:** kanban (Saved→Applied→Interview→Offer→Rejected/Closed) with drag-drop (dnd-kit), per-card
  next action + follow-up date, comms log timeline (paste email / log call / note), Germany package
  checklist on card + workspace.
- **Done when:** cards move and persist order/status; next action + follow-up date save; comms
  entries timeline works; checklist editable and reflects fit-derived gaps.
- **Handoff note:** _…_

---

## Phase 4 — Hardening

### [ ] Task 17 — End-to-end pass, seed data, docs (X)
- **Depends on:** all above.
- **Scope:** wire a full happy path (search → save → brief → fit → generate → board), add seed/demo
  data, a top-to-bottom run script, and update `README.md` + reconcile any spec drift discovered
  during build. Validate the Postgres switch (`DATABASE_URL`) and `alembic upgrade head` on Postgres.
- **Done when:** a fresh clone can run backend+frontend, complete the happy path against the real
  HR4U API, and the Postgres migration applies cleanly.
- **Handoff note:** _…_

---

## Progress tracker

Update as tasks complete (mirror the checkboxes above):

- [x] 00 Validate HR4U API (GATE) — GO; see docs/hr4u-findings.md
- [x] 00B Reconcile docs & contracts
- [x] 01A Backend scaffold & config
- [x] 01B Frontend scaffold
- [x] 02 Data models & migrations
- [x] 03 HR4U async client
- [x] 04 Search endpoints + de-dup
- [x] 05 LLM layer + citation verifier
- [x] 06 Profile parsing + CRUD
- [x] 07 Save job + application CRUD/PATCH + brief + comms
- [x] 08 Fit analysis + requirements checklist
- [x] 09 Artifact generation
- [x] 10 Package checklist + suggestions
- [x] 11 Frontend foundation
- [x] 12 Profile editor UI
- [x] 13 Search UI + save job
- [x] 14 Workspace UI
- [x] 15 Artifacts UI
- [ ] 16 Kanban + comms + checklist UI
- [ ] 17 E2E, seed, docs
