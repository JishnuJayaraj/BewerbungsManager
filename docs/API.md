# JobCraft — Backend API Contract (v1)

Stable interface between frontend and backend. **Authoritative for endpoint names, request and
response shapes, and errors.** If implementation needs to diverge, update this doc first.

Companion to [TECHNICAL.md](./TECHNICAL.md) (data model) and
[LLM_CONTRACTS.md](./LLM_CONTRACTS.md) (LLM output JSON).

## Conventions

- Base path: `/api`. JSON in/out. UTF-8.
- IDs are UUID strings. Timestamps ISO-8601 UTC.
- Single-user mode: no auth header; backend injects the fixed local `user_id`. (Multi-user later
  adds auth; routes unchanged.)
- **Error shape (all non-2xx):**
  ```json
  { "error": { "code": "string_code", "message": "human readable", "details": {} } }
  ```
  Common codes: `not_found` (404), `validation_error` (422), `upstream_hr4u_error` (502),
  `upstream_llm_error` (502), `job_expired` (410), `conflict` (409).
- List endpoints return `{ "items": [...], "page": n, "total": n }` unless noted.

---

## Health
- `GET /health` → `200 { "status": "ok" }`

## Profile  (Task 06 / 12)
- `POST /api/profile/parse` — body `{ "cv_text": "..." }` → `200 Profile` (parsed, persisted,
  editable). Parse failure → `200` with an empty editable profile + `"parse_warning"`.
- `GET /api/profile` → `200 Profile`
- `PUT /api/profile` — body partial Profile (incl. `brief_defaults`) → `200 Profile`
- `POST /api/profile/enrich/questions` → `200 { "questions": [{ "key", "question", "purpose",
  "field" }] }` — LLM proposes targeted gap-filling questions from the current profile.
- `POST /api/profile/enrich/apply` — body `{ "answers": [{ "key", "question", "answer" }] }` →
  `200 { "profile": Profile, "changes": [str], "added_skills": [str] }`. Folds answers into the
  profile (seniority/years/summary/target_roles + non-duplicate skills). LLM error → `502`.
- Skills:    `POST/PUT/DELETE /api/profile/skills[/{id}]`
- Experience:`POST/PUT/DELETE /api/profile/experiences[/{id}]`
- Projects:  `POST/PUT/DELETE /api/profile/projects[/{id}]`

`Profile` response:
```json
{
  "id": "uuid",
  "full_name": "", "headline": "", "seniority": "mid", "years_exp": 5, "summary": "",
  "locations": [{ "place": "", "lat": 0, "lon": 0, "radius_km": 30 }],
  "preferences": { "employment_types": [], "job_types": [], "contract_types": [],
                   "occupation_areas": [], "salary_min": null, "remote": false, "deal_breakers": [] },
  "brief_defaults": { "tone": "direct, professional", "language": "DE", "target_angle": "" },
  "skills": [{ "id": "uuid", "name": "Python", "kind": "IT_SKILL", "level": null, "source": "CV" }],
  "experiences": [{ "id": "uuid", "title": "", "company": "", "start": "2020-01",
                    "end": null, "is_current": true, "summary": "", "bullets": [], "tech": [] }],
  "projects": [{ "id": "uuid", "name": "", "role": "", "summary": "", "tech": [], "links": [] }]
}
```

## Search & jobs  (Task 04 / 13)
- `GET  /api/search/autocomplete?phrase=&size=` → `200 [ { uuid, title, company } ]`
- `POST /api/search/basic` — friendly inputs, backend builds the HR4U body:
  ```json
  { "phrase": "Python", "location": { "lat": 0, "lon": 0, "radius_km": 30 },
    "job_types": ["OCCUPATION"], "employment_types": ["FULL_TIME"], "page": 1, "size": 20 }
  ```
- `POST /api/search/advanced` — body is a full HR4U `/search` request (passthrough; see docs.md).
- Both search responses (deduped, see TECHNICAL §5):
  ```json
  { "hits": 1234, "page": 1, "jobs": [JobSummary], "aggregations": { ... }, "deduped": 12 }
  ```
  `JobSummary`: `{ "uuid", "title", "company", "place", "employment_types", "job_types",
  "date_from", "score", "highlights" }`
- `GET /api/jobs/{uuid}` → `200 JobDetail` (full HR4U detail) or `410 job_expired`.
- Saved searches: `GET/POST/DELETE /api/search/presets[/{id}]`
  preset body: `{ "name": "", "query_json": { ...full HR4U body... } }`

## Applications & workspace  (Task 07 / 14)
- `POST /api/applications` — body `{ "job_uuid": "..." }` → `201 Application`
  (snapshots job detail into `job_snapshot`; idempotent per job_uuid → `409 conflict` if exists).
- `GET  /api/applications` → list of `ApplicationCard`
- `GET  /api/applications/{id}` → `Application` (full, incl. brief, artifacts, checklist refs)
- `PATCH /api/applications/{id}` — `{ status?, board_order?, next_action?, followup_date?,
  needs_followup?, contact? }`
- `DELETE /api/applications/{id}`
- Brief: `GET/PUT /api/applications/{id}/brief`
  ```json
  { "target_angle": "", "emphasize": ["Python", "distributed systems"], "avoid": "",
    "tone": "direct", "language": "DE", "company_motivation": "", "user_notes": "" }
  ```
  On first GET, brief is pre-filled from profile `brief_defaults`.

## Fit analysis & requirements  (Task 08 / 14)
- `POST /api/applications/{id}/fit` → runs the single `fit` LLM call; persists a `FIT_ANALYSIS`
  artifact + `RequirementCheck` rows. Returns:
  ```json
  { "artifact_id": "uuid", "fit": FitAnalysis, "requirements": [RequirementCheck] }
  ```
  (`FitAnalysis` schema in LLM_CONTRACTS.md.)
- `GET  /api/applications/{id}/fit` → latest fit + requirements.
- `PATCH /api/applications/{id}/requirements/{rid}` — `{ "user_override": "HAVE|PARTIAL|MISSING" }`

## Artifact generation  (Task 09 / 15)
- `POST /api/applications/{id}/generate` —
  ```json
  { "kind": "COVER_LETTER | CV_BULLET_SUGGESTIONS | PORTAL_ANSWER",
    "instruction": "make it shorter",            // optional; for regenerate-with-instruction
    "portal_question": "Why do you want to work here?"  // required when kind=PORTAL_ANSWER
  }
  ```
  → `201 GeneratedArtifact` (new version; previous kept; `is_current` updated for that kind).
  Output is run through the citation verifier; response includes `citations` + `has_unsupported`.
- `GET  /api/applications/{id}/artifacts?kind=` → versions (newest first)
- `GET  /api/artifacts/{artifact_id}` → single artifact
- `GET  /api/artifacts/{artifact_id}/export?format=markdown|pdf` → file/stream

`GeneratedArtifact` response:
```json
{ "id": "uuid", "kind": "COVER_LETTER", "content": { ... or "text" },
  "citations": [{ "claim": "led migration to K8s", "evidence_ref": "experience:uuid",
                  "status": "SUPPORTED" }],
  "has_unsupported": false, "model_used": "mistral-...", "is_current": true,
  "created_at": "..." }
```

## Germany package checklist  (Task 10 / 16)
- `GET /api/applications/{id}/checklist` → `PackageChecklist` (auto-created 1:1; language levels
  pre-filled from latest fit when available)
- `PUT /api/applications/{id}/checklist` — full `PackageChecklist` body (see TECHNICAL §4 fields)

## Job suggestions  (Task 10 / 13)
- `POST /api/suggestions` → from profile: `200 { "suggestions": [ { "role": "", "rationale": "",
  "search": { ...HR4U body the /api/search/advanced endpoint accepts... } } ] }`

## Comms log  (Task 16)
- `GET  /api/applications/{id}/comms`
- `POST /api/applications/{id}/comms` — `{ "kind": "EMAIL|CALL|NOTE|EVENT", "occurred_at": "",
  "subject": "", "body": "", "direction": "INBOUND|OUTBOUND|NONE" }`
- `DELETE /api/applications/{id}/comms/{cid}`

## Settings  (Task 11)
- `GET /api/settings` → `{ "llm_provider": "mistral", "single_user": true, "gdpr_notice": "..." }`
  (read-only surface for the privacy notice + active provider; no secrets returned).

---

## Endpoint → task map (quick check for agents)
| Area | Endpoints | Backend task | Frontend task |
|---|---|---|---|
| Profile | `/api/profile*` | 06 | 12 |
| Search | `/api/search*`, `/api/jobs/*` | 04 | 13 |
| Applications/Brief | `/api/applications*`, `.../brief` | 07 | 14 |
| Fit/Requirements | `.../fit`, `.../requirements/*` | 08 | 14 |
| Generation/Export | `.../generate`, `/api/artifacts/*` | 09 | 15 |
| Checklist | `.../checklist` | 10 | 16 |
| Suggestions | `/api/suggestions` | 10 | 13 |
| Comms | `.../comms` | 07 | 16 |
| Settings | `/api/settings` | 01 | 11 |
