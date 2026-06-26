# JobCraft — LLM Output Contracts (v1)

Exact JSON each LLM task must return. **Authoritative.** Every structured task validates against
the schema here with Pydantic and retries once on parse failure (TECHNICAL §6). Outputs that
make factual claims also pass the citation verifier (see last section).

Tasks: `cv_parse`, `suggest`, `fit` (fit + requirements in one call), and `generate`
(`COVER_LETTER`, `CV_BULLET_SUGGESTIONS`, `PORTAL_ANSWER`).

General rules:
- Return **only** the JSON object, no prose, no markdown fences.
- Unknown/empty values: use `null` or `[]`, never invent.
- Language fields use `"DE"` or `"EN"`.
- `evidence_ref` strings are typed ids: `"skill:<uuid>"`, `"experience:<uuid>"`,
  `"project:<uuid>"`, or `"job:<field>"` (e.g. `"job:requirements"`).

---

## 1. `cv_parse` — pasted CV text → structured profile  (Task 06)
Input: raw CV text. Output:
```json
{
  "full_name": "string|null",
  "headline": "string|null",
  "seniority": "junior|mid|senior|lead|null",
  "years_exp": 0,
  "summary": "string|null",
  "locations": [{ "place": "string", "lat": null, "lon": null, "radius_km": null }],
  "skills": [{ "name": "string", "kind": "IT_SKILL|SOFT_SKILL|LANGUAGE|CERT", "level": "string|null" }],
  "experiences": [{
    "title": "string", "company": "string", "start": "YYYY-MM|null", "end": "YYYY-MM|null",
    "is_current": false, "summary": "string", "bullets": ["string"], "tech": ["string"]
  }],
  "projects": [{ "name": "string", "role": "string|null", "summary": "string",
                 "tech": ["string"], "links": ["string"] }]
}
```
Rules: extract only what is present in the text. Do not infer skills not mentioned. `level` only
if explicitly stated (e.g. "German C1").

## 2. `suggest` — profile → fitting roles + searches  (Task 10)
Output:
```json
{
  "suggestions": [{
    "role": "string",
    "rationale": "string",
    "search": { "queries": [ { "type": "single", "fields": ["text.title","text.fulltext"],
                               "phrase": "string", "queryType": "should" } ],
                "filters": [], "size": 20, "page": 1 }
  }]
}
```
`search` must be a valid HR4U `/search` body (docs.md) accepted by `POST /api/search/advanced`.
3–8 suggestions. No filters the user didn't imply except optional occupation/employment hints.

## 3. `fit` — fit analysis + requirements (one call)  (Task 08)
Input: profile + job detail + brief. Output:
```json
{
  "fit": {
    "summary": "string",
    "strong_matches": [{ "point": "string", "evidence_ref": "experience:uuid" }],
    "weak_matches":   [{ "point": "string", "evidence_ref": "skill:uuid|null" }],
    "unknowns":       [{ "point": "string" }],
    "suggested_angle": "string",
    "risks_to_address": [{ "risk": "string", "honest_framing": "string" }],
    "do_not_claim": ["string"]
  },
  "requirements": [{
    "requirement": "string",
    "status": "HAVE|PARTIAL|MISSING",
    "evidence_ref": "skill:uuid|experience:uuid|project:uuid|null"
  }]
}
```
Rules: **explanation, not a numeric score.** `requirement` text extracted from the job. `status`
HAVE only when concrete profile evidence supports it; otherwise PARTIAL/MISSING. Language-level
gaps (job wants C1, profile has B2) go in `risks_to_address` and as a MISSING/PARTIAL requirement.
`do_not_claim` lists things the profile does NOT support — never to be asserted in artifacts.

## 4. `generate` — artifacts  (Task 09)
Shared input: profile + job + brief + `company_motivation`. Each output object includes a
`claims` array used by the citation verifier.

### 4a. `COVER_LETTER`
```json
{
  "language": "DE|EN",
  "format": "anschreiben|plain",
  "subject": "string|null",
  "body": "string",
  "claims": [{ "claim": "string", "evidence_ref": "experience:uuid|project:uuid|skill:uuid|job:field|UNSUPPORTED" }]
}
```
Rules: when `language=DE`, `format=anschreiben` — use German *Anschreiben* conventions (Betreff/
subject, Sie-form, "Sehr geehrte …", formal closing "Mit freundlichen Grüßen"). Do not assert
anything in `do_not_claim`. Every factual sentence about the candidate appears in `claims`.

### 4b. `CV_BULLET_SUGGESTIONS`  (before/after diff)
```json
{
  "suggestions": [{
    "experience_ref": "experience:uuid",
    "original": "string|null",
    "suggested": "string",
    "reason": "string",
    "evidence_ref": "experience:uuid|project:uuid|skill:uuid|UNSUPPORTED"
  }],
  "emphasize": ["skill:uuid"],
  "do_not_pretend": ["string"]
}
```
Rules: 2–4 edits. `original=null` means a net-new bullet (must be evidence-backed). Tailoring,
not rewriting. `do_not_pretend` mirrors fit `do_not_claim`.

### 4c. `PORTAL_ANSWER`
Input also includes `portal_question`. Output:
```json
{
  "question": "string",
  "language": "DE|EN",
  "answer": "string",
  "claims": [{ "claim": "string", "evidence_ref": "...|UNSUPPORTED" }]
}
```

---

## Citation verification (applies to 4a/4b/4c)  (Task 05)
The model self-reports `evidence_ref` per claim. The **deterministic verifier does NOT trust
semantic truth.** v1 rule (intentionally simple, not over-promised):

- A claim is `SUPPORTED` **iff** its `evidence_ref` is a syntactically valid typed id AND that id
  **exists** in this application's profile/job inputs (correct source type + present).
- Any claim with a missing, malformed, non-existent, or `UNSUPPORTED` ref → `UNSUPPORTED`.
- `has_unsupported = true` if any claim is UNSUPPORTED.
- The UI surfaces UNSUPPORTED claims for the user to fix or remove. v1 does **not** verify that the
  cited evidence semantically proves the claim — only that the citation points at real evidence of
  the right kind. (Stronger semantic checking is a later enhancement.)

Stored on the artifact as `citations: [{ claim, evidence_ref, status }]` + `has_unsupported`.
