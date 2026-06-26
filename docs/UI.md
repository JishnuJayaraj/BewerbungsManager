# JobCraft — UI Screen Inventory (v1)

Lightweight, stable targets for frontend tasks — **not** a visual design spec. Defines which
screens exist, what each contains, and which API endpoints (see [API.md](./API.md)) it calls.
Routing and layout decisions here are authoritative; styling is the implementer's discretion
(see the `frontend-design` skill for polish).

Global: top nav between **Home · Profile · Search · Board** (+ Settings). The **Workspace** is
contextual — it opens per application from a Board card, a Search result, or the Home overview;
the bare `/workspace` route redirects to Board. A persistent **privacy/GDPR notice** (CV + job
text are sent to the configured LLM provider; EU provider is the default) is shown on first use
and in Settings (SPEC §9).

---

## 0. Home / overview  (landing route `/`)
- Hero + a **3-step guided journey**: Build profile → Find roles → Craft & track. Each step shows
  done/active state and links to the relevant screen (derived from profile skills + applications).
- **Stat tiles** (skills, saved roles, in progress) and a **recent applications** list linking
  into each Workspace. Acts as the cold-start and re-entry hub.

## 1. Profile page  (Task 12 ← API: `/api/profile*`)
- Hero with an **"Enrich with AI"** button that opens a **modal** — auto-loads targeted
  gap-filling questions (`POST /api/profile/enrich/questions`); the user answers and
  `POST /api/profile/enrich/apply` folds them back in (seniority/years/summary/target roles, new
  skills, **experience bullets, and education**), showing what changed.
- Paste-CV textarea → "Parse CV" (`POST /api/profile/parse`); extracts identity, skills,
  experiences, **education**, projects, links.
- Editable sections: **Identity** (name/headline/seniority/years/summary), **Skills** (IT/soft/
  cert), **Languages** (separate — German level matters), **Experiences** (editable bullets),
  **Education**, **Projects**, **Links** (GitHub/portfolio/LinkedIn). Each supports manual
  add/edit/delete (no parse needed).
- **Application defaults** card (clearly explained): the starting tone / language / positioning
  angle for each job's generated materials (overridable per application in the Workspace).

## 2. Search / Discover page  (Task 13 ← API: `/api/search/basic`, `/api/jobs/*`, `/api/suggestions`)
Recommendation-first discovery flow:
- **"Roles that fit you"** loads on entry (`POST /api/suggestions`): cards with role, one-line
  rationale, and key-skill chips. Clicking a card explores real openings for that role's phrase.
  Suggestions are **phrase-based** (`{role, rationale, phrase, skills}`); the page runs
  `POST /api/search/basic` with the phrase. LLM failure → friendly inline message (502, not a crash).
- **Clean search bar**: phrase + location + radius, with a collapsible **Filters** (role type,
  working time). Submits to `POST /api/search/basic`.
- **Results** (left) + **posting detail** (right, `GET /api/jobs/{uuid}`; handle `410 job_expired`)
  with a **Bookmark** action (`POST /api/applications`) that lands the job on the Board and links
  to its Workspace.
- (Advanced HR4U passthrough `/api/search/advanced` and saved presets remain available in the API
  but are no longer surfaced in this streamlined UI.)

## 3. Application Workspace  (Task 14 ← API: `/api/applications/{id}*`, `.../brief`, `.../fit`)
The centerpiece. Sections, top to bottom:
- **Job snapshot** header (title, company, location, link).
- **Guided brief builder**: selectable **target-angle** suggestions + free text; **emphasize**
  chips drawn from matched evidence + free text; **avoid**; **tone**; **language**; **"Why this
  company?" (company_motivation)** field; user notes. Saves via `PUT .../brief`.
- **Missing-info prompts** before running fit/generation (why this company, which experience,
  constraint, language, tone) — pre-fill the brief.
- **Fit analysis** panel (`POST .../fit`): summary, strong / weak / unknowns, suggested angle,
  **risks to address honestly**, **do-not-claim**.
- **Requirements checklist**: have / partial / missing rows with cited evidence; user can override
  a status (`PATCH .../requirements/{rid}`).
- **Matched evidence** list (skills/experiences/projects relevant to this job).
- Links to the **Artifacts panel** and the **Package checklist**.

## 4. Artifacts panel  (Task 15 ← API: `.../generate`, `/api/artifacts/*`)
- Tabs/kinds: **Cover letter**, **CV bullet suggestions**, **Portal answers**.
- **Generate** button per kind; for **Portal answers**, a question input (→ `portal_question`).
- **Citations rendering**: factual claims show their evidence; **UNSUPPORTED** spans are visibly
  flagged ("not backed by your profile — verify or remove").
- **CV bullets** render as a **before/after diff** (original vs suggested).
- **Regenerate with instruction** box ("make it shorter", "use German B2 wording") → new version.
- **Version switcher** per kind (newest = current).
- **Export** (Markdown / copy to clipboard / PDF) via `/api/artifacts/{id}/export`.

## 5. Kanban board  (Task 16 ← API: `/api/applications`, `.../comms`, `.../checklist`)
- Columns: Saved → Applied → Interview → Offer → Rejected/Closed; drag-drop (dnd-kit) persists
  `status` + `board_order` (`PATCH /api/applications/{id}`).
- **Card**: title/company, **next action + follow-up date**, needs-follow-up flag, quick link to
  Workspace, compact checklist progress.
- **Card detail / Workspace tab — Comms log**: timeline (paste email / log call / note) via
  `.../comms`.
- **Germany package checklist** (Task 16 surface, model in TECHNICAL §4): salary, start date,
  language level (required vs user, gap highlighted from fit), work-permit status, certificates,
  cover-letter-required, portal-answers, submitted, follow-up — `GET/PUT .../checklist`.

## 6. Settings / privacy  (Task 11 ← API: `/api/settings`)
- Active LLM provider (read-only), single-user notice, and the GDPR/privacy explanation. No
  secret values shown.

---

## Screen → task → endpoints (quick check)
| Screen | Frontend task | Primary endpoints |
|---|---|---|
| Profile | 12 | `/api/profile*` |
| Search | 13 | `/api/search*`, `/api/jobs/*`, `/api/suggestions` |
| Workspace | 14 | `/api/applications/{id}*`, `.../brief`, `.../fit`, `.../requirements/*` |
| Artifacts | 15 | `.../generate`, `/api/artifacts/*` |
| Kanban | 16 | `/api/applications`, `.../comms`, `.../checklist` |
| Settings | 11 | `/api/settings` |
