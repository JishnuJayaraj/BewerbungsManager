# JobCraft — Product Spec (v1)

_Last updated: 2026-06-26_

## 1. One-liner

**JobCraft helps you prepare a job-specific _application package_** for the German market: build
a profile once, search live jobs, and for each role that matters, understand your fit and
assemble what you actually need — tailored CV bullets, fit analysis, a cover letter _when the
role asks for one_, portal/application answers, and a Germany-specific readiness checklist —
then track the next action on a kanban board.

> **Framing:** the product is the application _package_, not "cover letter generation." In
> Germany some roles want a cover letter and many don't; many users care more about the CV.
> Cover letter is one artifact among several (CV bullets, fit analysis, portal answers,
> checklist) that may be equally or more useful.

## 2. Core flow

> **Find job → understand fit → steer intent → produce application material → track next action.**

Search is the entry point, not the product. The heart of JobCraft is the **Job Application
Workspace**, where the user shapes a job-specific application and steers the LLM.

## 3. Target user

**Tech / IT professionals** job-hunting in Germany (software, data, IT, engineering-adjacent).
Skills map well to HR4U `itSkills` / `werNERTags` / `softSkills`; DE + EN content throughout.

## 4. Core problem

Job hunting is scattered across boards, documents, and spreadsheets: re-tailoring CVs and
rewriting cover letters from scratch, sifting volumes of postings, and tracking status in a
spreadsheet that goes stale. JobCraft consolidates discovery → **per-job application crafting**
→ lifecycle tracking in one place, and helps the user present themselves _honestly and well_ for
each specific role.

## 5. The pillars

### 5.1 Profile (build the "deep picture" once)
- **v1 input: paste CV text** (lowest implementation pain). PDF/DOCX upload comes later. A
  **manual profile editor is always available**.
- LLM parses pasted text into a structured, editable profile: skills (IT/soft/language/cert),
  **experiences/roles** (with editable bullets), **projects**, seniority, years, locations,
  preferences.
- Experiences and projects are first-class so the workspace can cite **matched evidence** and
  tailor CV bullets from concrete material.
- **Brief defaults** (default tone / language / target angle) live on the profile and pre-fill
  every new application brief, so intent isn't retyped per job.

### 5.2 Search & discovery (entry point — full power, but layered)
Keep full HR4U power, but don't make it feel like an API console. Three tiers:
- **Basic search (default):** phrase, location + radius, job type, employment type. No API jargon.
- **Advanced filters:** everything else (contract type, occupation area, date ranges, company
  type, isSet/isNotSet, must/should/must_not, semantic). Tucked behind an "Advanced" panel.
- **Saved presets:** name and replay complex searches; `must`/`isSet`/`dateFrom` etc. never
  need to be understood on day one.

The LLM **suggests** roles and ready-made searches from the profile (it does not rank results).

### 5.3 Job Application Workspace (the centerpiece — between search and kanban)
Opening/saving a job creates a workspace that is the place the user **steers the LLM**:

- **Job snapshot** (cached details).
- **Application brief — guided builder** (not blank text fields only): the user steers intent
  via **selectable angles and prompts**, with free text as a fallback:
  - _Target angle_ — pick from suggested angles for the role (e.g. "backend/platform engineer,
    not full-stack generalist", "domain expert", "fast-learning generalist") or write your own.
  - _Emphasize_ — selectable chips drawn from the matched-evidence skills/experience, plus free text.
  - _Avoid_ — e.g. "don't overstate Kubernetes experience".
  - _Tone_ and _Language_ (DE/EN), pre-filled from profile `brief_defaults`.
  - _User notes:_ "Why I want this job", "What I want to emphasize", "Concerns / deal-breakers".
- **Company motivation helper** — a dedicated "Why this company?" section. Many cover
  letters/answers go generic without it; the user captures 1–3 concrete reasons (product,
  mission, tech, location, growth) that feed every generated artifact.
- **Fit analysis** (LLM, explanation not score): strong matches, weak matches, unknowns,
  suggested application angle, **risks to address honestly**.
- **Requirements checklist** (LLM-extracted): the job's requirements parsed into a checklist,
  each auto-matched against the profile as **have / partial / missing** with cited evidence.
  Grounds the fit analysis and the "what should I _not_ pretend to have" honesty check, and
  feeds the materials checklist. Produced alongside the fit analysis in one call.
- **Matched evidence** from profile: relevant projects, skills, past roles, surfaced per job.
- **Generated artifacts**, each versioned: **cover letter** (when the role asks for one),
  **CV bullet tailoring** (before/after diff), and **portal/application answers** (free-text
  questions German application portals ask). Generated from `profile + job + brief + company
  motivation`.
- **Evidence citations (hard requirement):** every factual claim in a generated artifact must
  cite the profile or job evidence it rests on, or be **flagged as unsupported**. Unsupported
  claims are surfaced to the user, never silently emitted. This is the core anti-fabrication
  guarantee.
- **Germany application-package checklist** (see 5.6) and **manual notes / status**.
- **Export** application materials to Markdown / clipboard / PDF.

The user builds a brief first, _then_ generates — instead of asking for a generic cover letter.

### 5.4 CV tailoring assistance (not full CV rewriting)
No resume builder. The app answers, for this specific job:
- Which profile skills are most relevant?
- Which existing CV bullets should be emphasized?
- What 2–4 bullet edits would make the CV better for this role?
- What missing requirements should I **not** pretend to have?
- What should the cover letter compensate for?

Honesty is a first-class principle: JobCraft helps present strengths well and flags what _not_
to claim — it never fabricates experience.

### 5.5 Application tracker (kanban + next action)
- Lifecycle columns (Saved → Applied → Interview → Offer → Rejected/Closed), drag-and-drop.
- Each card surfaces a single **next action + due/follow-up date** so the board answers "what
  needs a follow-up / what's gone quiet."
- Per card: linked job snapshot, contact (`counterpart`), brief, generated artifacts, and the
  Germany application-package checklist (5.6).
- **Comms history = manual log entries:** timestamped timeline (paste emails, log calls, notes).
  No inbox integration in v1.

### 5.6 Germany application-package checklist
A Germany-specific readiness checklist per application — the things that actually block or sink
real applications here, beyond "is the cover letter done":
- **Salary expectation** (Gehaltsvorstellung) — frequently required in the application itself.
- **Earliest start date** (frühestmöglicher Eintrittstermin).
- **Certificates / references** (Zeugnisse, Arbeitszeugnisse, degree recognition).
- **Language level** required vs the user's (German level, e.g. B1/B2/C1) — a top real-world filter.
- **Work-permit / visa status** relevance (EU vs non-EU, Blue Card, relocation/visa sponsorship).
- **Portal questions** — free-text questions the application portal asks (drafted as artifacts).

Items are tracked as done/blocked with notes; gaps (e.g. "JD wants C1 German, you have B2")
surface as honest risks in the fit analysis rather than being hidden.

## 6. LLM usage (swappable: Claude / OpenAI / Mistral)

Four modes, each a configurable provider/model call:
1. **CV parsing** → structured profile.
2. **Job suggestions** → shortlist of roles / search queries from the profile.
3. **Application brief / fit analysis** → fit explanation + suggested angle + honest risks,
   plus the **LLM-extracted requirements checklist** (have/partial/missing vs profile),
   produced in the same call. _The most important mode for the stated goal: it lets the user
   steer the application._
4. **Artifact generation** — cover letter, **CV bullet tailoring** (before/after diff), and
   **portal/application answers**. Cover letter is one artifact among several, not the headline.

**Evidence-citation constraint (applies to all generation):** every factual claim must cite the
profile/job evidence it rests on or be flagged **unsupported**. The app shows unsupported spans
to the user; it never silently fabricates experience.

Not in scope: per-job ranking of search results; auto follow-up email drafting (deferred).

**Models are configured per task** — artifact generation can use a higher-quality model; parsing
and suggestions can use cheaper/faster ones. No hardcoded "latest/best model" assumptions.

## 7. Steering & generation UX (where the value lands)

- **Missing-info prompts before generation:** Why this company? Which experience to highlight?
  Any constraint to mention? German or English? Formal or direct tone? (Pre-fills the brief.)
- **Regenerate with instruction:** "make it shorter", "more confident", "mention my Python
  backend work more", "remove relocation details", "use German B2-level wording". This is
  exactly where the user steers the LLM.
- **Germany application-package checklist per application:** CV reviewed · cover letter (if
  required) · key requirements checked · salary expectation set · earliest start date · language
  level OK · work-permit/visa relevance · certificates ready · portal answers drafted ·
  application submitted · follow-up date set. (See 5.6.)

## 8. Non-goals (v1)

- **Auto-apply / auto-submit** — JobCraft prepares materials; the user applies.
- **Per-job ranking of search results** — discovery stays API semantic + filters. (Fit
  _explanation_ on a saved job is in scope; per-result scoring is not.)
- **Full CV rewriting / resume builder** — tailoring suggestions only.
- **Email / calendar integration** — comms manually logged.
- **PDF/DOCX CV upload** in the first cut — paste text first, upload later.
- **Mobile app** — web only.

## 9. Constraints & dependencies

- **HR4U API:** relative paths only — host from `HR4U_BASE_URL`; raw `Authorization` token via
  `HR4U_TOKEN`. All discovery depends on it.
- **LLM providers:** tokens via env; per-task model config; cost-aware.
- **Privacy:** CV, briefs, and application data are personal; local-first in v1. CV + job text
  are sent to the configured LLM provider during generation — surface this to the user.
- **Language:** DE + EN throughout; default brief language from the detected job-posting language.

## 10. Recommended MVP shape (build order)

1. Profile editor, with **paste/import CV text**.
2. HR4U **search and save job** (basic tier first).
3. **Job workspace** with **guided application brief** + **company-motivation** section.
4. **Fit analysis** (+ LLM requirements checklist) for a saved job.
5. **CV bullet tailoring** suggestions (before/after diff) — CV first, since many roles need no letter.
6. **Cover letter** generation (when required) and versioning, with **evidence citations**.
7. **Portal/application answer** drafting.
8. **Germany application-package checklist** on the workspace + card.
9. **Kanban tracker** with next action / follow-up date.

## 11. Accepted: extended features

These are in scope (they extend the same "prepare a job-specific application package" thread):
- **Guided brief builder** with selectable angles/prompts, not blank fields only. (See 5.3.)
- **Company-motivation helper** ("Why this company?") feeding every artifact. (See 5.3.)
- **Evidence citations** on all generated artifacts; unsupported claims flagged. (See 5.3, 6.)
- **Germany application-package checklist** (salary, start date, certificates, language level,
  work permit, portal questions). (See 5.6.)
- **Portal/application answers** as a generated artifact kind. (See 5.3.)
- **Requirements checklist (LLM-extracted):** job requirements auto-matched against the profile
  (have / partial / missing) with cited evidence; grounds the honesty check. (See 5.3.)
- **Before/after diff view** for CV bullet suggestions, so edits are reviewable, not opaque.
- **Export application materials** to Markdown/clipboard/PDF.
- **Reusable brief defaults** on the profile (default tone/language/angle) pre-fill each new
  brief. (See 5.1.)

Later (post-MVP, same plumbing):
- **Interview-question prep** as an artifact kind (`ANSWER_DRAFT`): likely questions + talking
  points from job + brief.

## 12. Open questions / later

- Kanban column configurability.
- Auth provider and hosting choice when multi-user is enabled.
- Follow-up email drafting (deferred LLM feature).

See [TECHNICAL.md](./TECHNICAL.md) for stack, data model, and key decisions.
