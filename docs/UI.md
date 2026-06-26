# JobCraft — UI Screen Inventory (v1)

Lightweight, stable targets for frontend tasks — **not** a visual design spec. Defines which
screens exist, what each contains, and which API endpoints (see [API.md](./API.md)) it calls.
Routing and layout decisions here are authoritative; styling is the implementer's discretion
(see the `frontend-design` skill for polish).

Global: top nav between **Profile · Search · Board**; a **Workspace** opens per application.
A persistent **privacy/GDPR notice** (CV + job text are sent to the configured LLM provider; EU
provider is the default) is shown on first use and in Settings (SPEC §9).

---

## 1. Profile page  (Task 12 ← API: `/api/profile*`)
- Paste-CV textarea → "Parse" (`POST /api/profile/parse`); shows parsed result to review/edit.
- Editable sections: identity/headline/seniority/summary, **Skills**, **Experiences** (with
  editable bullets), **Projects**. Each section supports manual add/edit/delete (no parse needed).
- **Brief defaults** editor (tone / language / target angle).
- Save persists via profile + sub-entity endpoints.

## 2. Search page  (Task 13 ← API: `/api/search*`, `/api/jobs/*`, `/api/suggestions`)
- **Basic search bar** (default): phrase (with autocomplete), location + radius, job type,
  employment type → `POST /api/search/basic`. No API jargon visible.
- **Advanced filters** panel (collapsed): contract type, occupation area, date range, company
  type, must/should/must_not, semantic → `POST /api/search/advanced`.
- **Aggregation facets** sidebar (employment/job/contract types, occupation areas, top employers/
  places) to refine.
- **Results list** (deduped) → result → **Job detail** drawer/page (`GET /api/jobs/{uuid}`;
  handle `410 job_expired`).
- **Save to board** action (`POST /api/applications`) → opens/links the Workspace.
- **Suggestions** strip: "Roles that fit you" from `POST /api/suggestions`; each suggestion runs
  its prebuilt search.
- **Saved presets**: list, replay, delete (`/api/search/presets`).

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
