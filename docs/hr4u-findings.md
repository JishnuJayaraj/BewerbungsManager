# HR4U API — Validation Findings (Task 00)

_Probed 2026-06-26 against the live API. Source of truth for HR4U behavior; supersedes
assumptions in docs.md where they differ._

## Go / No-Go: **GO** ✅

Auth works, IT/tech coverage is strong, English-language roles are well represented, and the
semantic query returns high-quality matches. Two important behavior caveats below (query
semantics + HTML) must shape Task 03/04 but are not blockers.

## Environment
- **Host (`HR4U_BASE_URL`):** `https://job-search-api.hr4you.org`
- **Auth:** raw token in `Authorization` header works; missing token → `401`. Latencies 160–210 ms.
- All three endpoints verified: `/autocomplete`, `POST /search`, `GET /jobs/{uuid}`.

## Coverage (hits, `should`, title+fulltext)
| Phrase | Hits | | Phrase | Hits |
|---|---|---|---|---|
| Python | 14,534 | | Data Scientist | 30,603 |
| Java | 8,004 | | Kubernetes | 5,393 |
| DevOps | 6,761 | | React | 2,915 |
| Machine Learning | 15,557 | | Softwareentwickler | 5,623 |

**Tech/IT coverage is more than sufficient** for the v1 target user. (Non-tech is huge too —
Pflege 440k, Lager 106k — confirming the broad corpus, but we target IT.)

## English-language roles: present and taggable ✅ (key de-risk for emigrants)
Title-only hits: `Software Engineer` 25,210 · `Backend Developer` 4,846 · `Backend Entwickler`
10,870 · `Softwareentwickler` 3,803. English IT roles are abundant and searchable by English
title — the emigrant-facing premise holds.

## Semantic query: works well ✅ (validates the "smart layer")
A profile-like text ("Experienced Python backend engineer with distributed systems and AWS")
returned tightly relevant roles with high scores:
- _Backend Entwickler Python (m/w/d) – Data Engineer Python_ — 0.888
- _Senior Software Engineer – Backend / Python (m/f/x)_ — 0.868

Only 12 hits (high precision). Good for SPEC §5.2 "API semantic matching" and §5.2 suggestions.

## ⚠️ CRITICAL: query semantics — `should` does NOT filter when a filter is present
- For a **single phrase with no filter**, `should` and `must` return the same hit set
  (Python = 14,534 both); the difference is ranking only.
- **When any `filter` is combined with a `should` query, the phrase stops restricting results.**
  Measured:
  - `Python` **should** + Berlin/50km → **100,696** (= all jobs in radius; phrase ignored)
  - `Python` **must** + Berlin/50km → **1,306** (phrase ∧ location, as expected)
  - `"a"` should + Berlin/50km → 100,696 (confirms: should+filter = everything in the filter)

**Implication for Task 04:** the basic-search builder **must set `queryType: must` for the user's
phrase whenever any filter (location/radius/job type/employment type) is applied** — otherwise
"Python near Berlin" returns 100k unrelated jobs. Safest default: use `must` for the user's
primary phrase in basic search. Expose `should`/`must_not` only in advanced.

Also note: multi-word phrases on `text.fulltext` match loosely (broad recall); `text.title`
fields are far tighter (Software Engineer: 140k fulltext vs 25k title). Basic search should
default to title-weighted fields for precision.

## Duplication: not an issue in practice
The `duplicates` aggregation returned **0** for a broad IT search (`Entwickler`, 31,643 hits).
De-dup appears handled upstream / not surfaced as duplicates here. **Soften Task 04's de-dup
emphasis** to a light client-side guard (e.g. drop identical `link`/`uuid`), not a core feature.

## Aggregations & distribution (broad IT search `Entwickler`, 31,643 hits)
- **sources:** jobdigger 15,745 · bap44 3,184 · ba-jobs-scrape 2,876 · zyte 2,508 · stepstone
  2,425 · firmenHomepages 1,518. _(Divergent from docs.md's example sources — docs are
  illustrative, not authoritative for this deployment.)_
- **employmentTypes:** FULL_TIME 28,151 · PART_TIME 7,325 · MINI_JOB 935.
- **occupationAreas:** "Nicht zugeordnet" 11,951 · **IT 11,477** · Ingenieure 1,563 · …
- **jobTypes:** OCCUPATION 29,904 · STUDENT_EMPLOYEE 786 · APPRENTICESHIP 432 · INTERNSHIP 321.
- **companyTypes:** COMPANY 28,031 · PERSONNEL_SERVICES 2,136 · RECRUITMENT_AGENCY 1,476.

All aggregations used by the app (employment/job/occupation/company types, sources) return as
documented. `topWorkPlaces`/`topEmployers` available per docs.md (untested here, low risk).

## ⚠️ Job text carries HTML
`text.fulltext` is raw HTML (~3,161 chars, contains tags). **Implication:** strip/sanitize HTML
before sending job text to the LLM (Tasks 08/09 — fit & generate) and before display, or the
model wastes tokens on markup and citations get noisy. Add an HTML-strip step in
`services/hr4u.py` schema mapping (Task 03) so downstream consumers get clean text.

## Job detail field reality (vs app needs)
- `text.title` / `tasks` / `requirements` present; **`benefits` can be empty** — handle missing
  sub-fields gracefully.
- `classifications` includes `itSkills` (11 on the sample), `softSkills`, `werNERTags`,
  `experienceLevel` (often `UNDEFINED`), `taxonomyJobTitle` — useful raw material for matched
  evidence and the requirements checklist.
- **`counterpart` is often sparse** (name/phone empty, email sometimes set). Contact auto-fill
  from `counterpart` is partial → the user-editable contact (already designed) is necessary, not
  optional.

## Action items folded back into the plan
1. **Task 03** — strip HTML from `text.fulltext` in the schema mapping; tolerate missing
   `benefits`/sparse `counterpart`.
2. **Task 04** — basic search uses `queryType: must` for the phrase when any filter is applied
   (default to `must` + title-weighted fields); de-dup is a light client guard, not a feature.
3. **Tasks 08/09** — consume the cleaned text; rely on `itSkills`/`requirements` for grounding.
4. **SPEC §5.2 / TECHNICAL §5** — semantic layer validated; keep it for suggestions + smart match.
