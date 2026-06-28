"""Regression net for loose LLM output shapes.

Every model that parses LLM JSON must tolerate the real-world variations smaller
models produce: aliased keys, lists where we expect strings (and vice-versa),
enum casing/synonyms, inline citation markers, and JSON wrapped in fences/prose.
If a new tolerance is added, pin it here so it never regresses.
"""

from __future__ import annotations

import pytest

from app.schemas.lenient import as_language, as_str_list, as_text, pick, strip_refs


# ── helpers ──────────────────────────────────────────────────────────────
def test_strip_refs_removes_inline_markers() -> None:
    assert strip_refs("Built ETL. [evidence_ref:experience:abc][skill:def] Shipped.") == "Built ETL. Shipped."
    assert strip_refs("Clean text.") == "Clean text."


def test_as_text_joins_lists_and_strips_refs() -> None:
    assert as_text(["Para one.", "Para two."]) == "Para one.\n\nPara two."
    assert as_text(None) == ""
    assert as_text("Hi [skill:x] there") == "Hi there"


def test_as_str_list_handles_string_and_list() -> None:
    assert as_str_list("Python") == ["Python"]
    assert as_str_list(["Python", "", None, "SQL"]) == ["Python", "SQL"]
    assert as_str_list(42) == []


def test_pick_first_present() -> None:
    assert pick({"text": "a"}, "claim", "text") == "a"
    assert pick({}, "claim", "text", default="x") == "x"


def test_as_language_normalises() -> None:
    assert as_language("German") == "DE"
    assert as_language("english") == "EN"


# ── citation claim (the bug that 502'd cover letters) ────────────────────
def test_citation_claim_text_alias() -> None:
    from app.services.citations import CitationClaim

    assert CitationClaim.model_validate({"text": "x", "evidence_ref": "skill:y"}).claim == "x"
    assert CitationClaim.model_validate({"statement": "z"}).claim == "z"
    assert CitationClaim.model_validate("bare string").claim == "bare string"


# ── generate content models ──────────────────────────────────────────────
def test_cover_letter_loose_shape() -> None:
    from app.schemas.generate import CoverLetterContent

    c = CoverLetterContent.model_validate(
        {
            "language": "German",
            "format": "cover_letter",
            "body": ["Dear team,", "I built ETL pipelines. [evidence_ref:experience:abc]"],
            "claims": [{"text": "I built ETL.", "evidence_ref": "skill:py"}],
        }
    )
    assert c.language == "DE"
    assert c.format == "plain"
    assert "[" not in c.body and "evidence_ref" not in c.body
    assert c.claims[0].claim == "I built ETL."


def test_tailored_cv_loose_shape() -> None:
    from app.schemas.generate import TailoredCvContent

    cv = TailoredCvContent.model_validate(
        {
            "full_name": "Ada",
            "summary": ["line one", "line two"],
            "skills": "Python",
            "languages": ["German", "English"],
            "experiences": [{"title": "Analyst", "bullets": "Did reports [skill:x]"}],
        }
    )
    assert cv.summary == "line one\n\nline two"
    assert cv.skills == ["Python"]
    assert cv.experiences[0].bullets == ["Did reports"]


def test_portal_answer_loose_shape() -> None:
    from app.schemas.generate import PortalAnswerContent

    a = PortalAnswerContent.model_validate({"question": ["Why us?"], "language": "EN", "answer": ["Because [skill:x] reasons."]})
    assert a.answer == "Because reasons."
    assert a.language == "EN"


# ── parse / analysis models ──────────────────────────────────────────────
def test_cv_parse_loose_shape() -> None:
    from app.schemas.profile import CvParseResult

    r = CvParseResult.model_validate(
        {"years_exp": "2+", "locations": ["Berlin"], "skills": ["Python", "German B2"], "education": ["B.Sc."], "links": ["x.com"]}
    )
    assert r.years_exp == 2
    assert r.locations[0] == {"place": "Berlin"}
    assert {s.kind.value for s in r.skills} >= {"IT_SKILL", "LANGUAGE"}


def test_fit_loose_shape() -> None:
    from app.schemas.fit import FitLlmResult

    r = FitLlmResult.model_validate(
        {
            "fit": {"summary": "ok", "strong_matches": [{"item": "Python"}], "risks_to_address": [{"item": "German"}]},
            "requirements": [{"item": "SQL", "status": "yes"}, {"item": "C1", "status": "no"}],
        }
    )
    assert r.fit.strong_matches[0].point == "Python"
    assert [req.status.value for req in r.requirements] == ["HAVE", "MISSING"]


def test_suggest_loose_shape() -> None:
    from app.schemas.suggest import JobSuggestion

    s = JobSuggestion.model_validate({"title": "MLOps Engineer", "query": "MLOps", "key_skills": "Python"})
    assert s.role == "MLOps Engineer"
    assert s.phrase == "MLOps"
    assert s.skills == ["Python"]


def test_quickfit_loose_shape() -> None:
    from app.schemas.quickfit import QuickFitResult

    q = QuickFitResult.model_validate({"rating": "good", "summary": "Clear match.", "gaps": "German C1"})
    assert q.verdict == "STRONG"
    assert q.headline == "Clear match."
    assert q.top_gaps == ["German C1"]


def test_job_parse_loose_shape() -> None:
    from app.schemas.jobimport import JobParseResult

    j = JobParseResult.model_validate({"title": "Engineer", "requirements": "Python", "tasks": ["Build"], "fulltext": ["a", "b"]})
    assert j.requirements == ["Python"]
    assert j.tasks == ["Build"]


# ── LLM JSON extraction (fences / prose) ─────────────────────────────────
@pytest.mark.parametrize(
    "raw",
    [
        '{"answer": "x"}',
        '```json\n{"answer": "x"}\n```',
        '```\n{"answer": "x"}\n```',
        'Sure! Here is the JSON:\n{"answer": "x"}\nHope that helps.',
    ],
)
def test_llm_json_extraction_tolerates_fences_and_prose(raw: str) -> None:
    from app.services.llm import _loads_lenient

    assert _loads_lenient(raw) == {"answer": "x"}
