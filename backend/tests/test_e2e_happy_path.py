"""End-to-end happy path (Task 17): search -> save -> brief -> fit -> generate -> board.

Exercises the whole API surface wired together with the real routers, persistence,
citation verification, and versioning. Only the external boundaries are faked: the HR4U
client and the four LLM-backed services (cv_parse / fit / generate / suggest).
"""

from __future__ import annotations

from collections.abc import Generator

from fastapi.testclient import TestClient
from sqlmodel import Session, SQLModel

from app.config import Settings
from app.db import create_db_engine, get_session
from app.main import create_app
from app.models import ArtifactKind, RequirementStatus
from app.routers.fit import get_fit_service
from app.routers.generate import get_generate_service
from app.routers.profile import get_cv_parser
from app.routers.search import get_hr4u_client
from app.routers.suggestions import get_suggest_service
from app.schemas.fit import FitAnalysis, FitInputs, FitLlmResult, FitRequirement
from app.schemas.generate import CoverLetterContent, GenerateInputs
from app.schemas.hr4u import Hr4uJob, Hr4uJobDetailResult, Hr4uSearchResponse
from app.schemas.profile import (
    CvParsedExperience,
    CvParsedProject,
    CvParsedSkill,
    CvParseResult,
)
from app.schemas.suggest import JobSuggestion, SuggestInputs, SuggestResponse
from app.services.citations import CitationClaim
from app.services.generate import GenerateResult

JOB_UUID = "e2e-python-job"


def _job(uuid: str = JOB_UUID) -> Hr4uJob:
    return Hr4uJob.model_validate(
        {
            "uuid": uuid,
            "company": "Example GmbH",
            "companyCleaned": "Example GmbH",
            "text": {
                "title": "Senior Python Engineer",
                "fulltext": "We need Python, distributed systems and German C1.",
                "requirements": ["Python", "German C1"],
            },
            "addresses": [{"place": "Berlin", "country": "DE"}],
            "classifications": {"employmentTypes": ["FULL_TIME"], "jobTypes": ["OCCUPATION"]},
        }
    )


class FakeHr4uClient:
    async def autocomplete(self, phrase: str, *, size: int = 10):
        return [_job()]

    async def search(self, body):
        return Hr4uSearchResponse(hits=1, jobs=[_job()], page=1, aggregations={})

    async def job_detail(self, uuid: str) -> Hr4uJobDetailResult:
        return Hr4uJobDetailResult.found(_job(uuid))


class FakeCvParser:
    async def parse(self, cv_text: str) -> CvParseResult:
        return CvParseResult(
            full_name="Ada Lovelace",
            headline="Backend Engineer",
            seniority="senior",
            years_exp=8,
            summary="Backend engineer focused on Python platforms.",
            skills=[CvParsedSkill(name="Python", kind="IT_SKILL", level="expert")],
            experiences=[
                CvParsedExperience(
                    title="Backend Engineer",
                    company="ACME",
                    is_current=True,
                    bullets=["Built APIs."],
                    tech=["Python"],
                )
            ],
            projects=[CvParsedProject(name="JobCraft", summary="Hiring tooling", tech=["Python"])],
        )


class FakeFitService:
    async def run(self, inputs: FitInputs) -> FitLlmResult:
        skill_id = inputs.profile["skills"][0]["id"]
        return FitLlmResult(
            fit=FitAnalysis(
                summary="Strong Python fit; German level is the main gap.",
                suggested_angle="Present as a backend/platform engineer.",
                do_not_claim=["Native German"],
            ),
            requirements=[
                FitRequirement(requirement="Python", status=RequirementStatus.HAVE, evidence_ref=f"skill:{skill_id}"),
                FitRequirement(requirement="German C1", status=RequirementStatus.MISSING, evidence_ref=None),
            ],
        )


class FakeGenerateService:
    async def run(self, kind: ArtifactKind, inputs: GenerateInputs) -> GenerateResult:
        skill_id = inputs.profile["skills"][0]["id"]
        assert kind is ArtifactKind.COVER_LETTER
        return GenerateResult(
            content=CoverLetterContent(
                language="DE",
                format="anschreiben",
                subject="Bewerbung als Senior Python Engineer",
                body="Sehr geehrte Damen und Herren,\n\nIch arbeite mit Python.\n\nMit freundlichen Gruessen",
                claims=[
                    CitationClaim(claim="Ich arbeite mit Python.", evidence_ref=f"skill:{skill_id}"),
                    CitationClaim(claim="Ich spreche fliessend Deutsch.", evidence_ref="UNSUPPORTED"),
                ],
            ),
            model_used="mistral/e2e",
        )


class FakeSuggestService:
    async def run(self, inputs: SuggestInputs) -> SuggestResponse:
        return SuggestResponse(
            suggestions=[
                JobSuggestion(role="Backend Engineer", rationale="Python depth", phrase="Python", skills=["Python"]),
                JobSuggestion(role="Platform Engineer", rationale="Distributed systems", phrase="Platform Engineer", skills=["Kubernetes"]),
                JobSuggestion(role="Data Engineer", rationale="Python + pipelines", phrase="Data Engineer", skills=["SQL"]),
            ]
        )


def make_client(tmp_path) -> TestClient:
    database_url = f"sqlite:///{tmp_path / 'e2e.db'}"
    engine = create_db_engine(Settings(DATABASE_URL=database_url))
    SQLModel.metadata.create_all(engine)
    app = create_app(Settings(DATABASE_URL=database_url, LLM_DEFAULT_PROVIDER="mistral"))

    def override_session() -> Generator[Session, None, None]:
        with Session(engine) as session:
            yield session

    app.dependency_overrides[get_session] = override_session
    app.dependency_overrides[get_hr4u_client] = lambda: FakeHr4uClient()
    app.dependency_overrides[get_cv_parser] = lambda: FakeCvParser()
    app.dependency_overrides[get_fit_service] = lambda: FakeFitService()
    app.dependency_overrides[get_generate_service] = lambda: FakeGenerateService()
    app.dependency_overrides[get_suggest_service] = lambda: FakeSuggestService()
    return TestClient(app)


def test_full_application_happy_path(tmp_path) -> None:
    client = make_client(tmp_path)

    # 0. Health + settings (EU/Mistral default, no secrets leaked).
    assert client.get("/health").json() == {"status": "ok"}
    settings = client.get("/api/settings").json()
    assert settings["llm_provider"] == "mistral"
    assert "Mistral" in settings["gdpr_notice"]

    # 1. Profile from pasted CV -> structured + editable.
    parsed = client.post("/api/profile/parse", json={"cv_text": "Ada Lovelace, Python backend engineer."})
    assert parsed.status_code == 200
    profile = parsed.json()
    assert profile["full_name"] == "Ada Lovelace"
    assert [s["name"] for s in profile["skills"]] == ["Python"]
    assert profile["experiences"] and profile["projects"]

    # 2. Search the live-shaped corpus and pick a job.
    results = client.post("/api/search/basic", json={"phrase": "Python"})
    assert results.status_code == 200
    jobs = results.json()["jobs"]
    assert jobs and jobs[0]["uuid"] == JOB_UUID

    # 3. Save the job -> creates an application with a snapshot; idempotent.
    saved = client.post("/api/applications", json={"job_uuid": JOB_UUID})
    assert saved.status_code == 201
    app_id = saved.json()["id"]
    assert saved.json()["job_title"] == "Senior Python Engineer"
    assert client.post("/api/applications", json={"job_uuid": JOB_UUID}).status_code == 409

    # 4. Steer intent via the guided brief.
    brief = client.put(
        f"/api/applications/{app_id}/brief",
        json={
            "language": "DE",
            "tone": "direct",
            "target_angle": "Backend/platform engineer",
            "company_motivation": "Product helps people find work",
            "emphasize": ["Python", "distributed systems"],
        },
    )
    assert brief.status_code == 200
    assert brief.json()["company_motivation"] == "Product helps people find work"

    # 5. Fit analysis + LLM requirements checklist (one call).
    fit = client.post(f"/api/applications/{app_id}/fit")
    assert fit.status_code == 200
    fit_body = fit.json()
    statuses = {r["requirement"]: r["status"] for r in fit_body["requirements"]}
    assert statuses["Python"] == "HAVE"
    assert statuses["German C1"] == "MISSING"
    python_req = next(r for r in fit_body["requirements"] if r["requirement"] == "Python")
    assert python_req["evidence"], "HAVE requirement should cite a real profile skill"

    # 6. Generate a cover letter; unsupported claims are flagged, not hidden.
    cover = client.post(f"/api/applications/{app_id}/generate", json={"kind": "COVER_LETTER"})
    assert cover.status_code == 201
    cover_body = cover.json()
    assert cover_body["content"]["format"] == "anschreiben"
    assert cover_body["has_unsupported"] is True
    assert sorted(c["status"] for c in cover_body["citations"]) == ["SUPPORTED", "UNSUPPORTED"]

    # 6b. Export the artifact (Markdown + PDF).
    artifact_id = cover_body["id"]
    md = client.get(f"/api/artifacts/{artifact_id}/export?format=markdown")
    pdf = client.get(f"/api/artifacts/{artifact_id}/export?format=pdf")
    assert md.status_code == 200 and "Bewerbung als Senior Python Engineer" in md.text
    assert pdf.status_code == 200 and pdf.content.startswith(b"%PDF")

    # 7. Germany package checklist captures the language gap honestly.
    checklist = client.put(
        f"/api/applications/{app_id}/checklist",
        json={
            "salary_expectation": "75000 EUR",
            "language_level_required": "C1",
            "language_level_user": "B2",
            "work_permit_status": "EU_CITIZEN",
            "cover_letter_required": True,
        },
    )
    assert checklist.status_code == 200
    assert checklist.json()["language_level_required"] == "C1"

    # 8. Move it across the board + record the next action.
    moved = client.patch(
        f"/api/applications/{app_id}",
        json={"status": "APPLIED", "next_action": "Follow up with hiring manager", "followup_date": "2026-07-10"},
    )
    assert moved.status_code == 200
    assert moved.json()["status"] == "APPLIED"

    # 9. Log a manual comms entry on the timeline.
    comms = client.post(
        f"/api/applications/{app_id}/comms",
        json={"kind": "EMAIL", "occurred_at": "2026-07-01T09:00:00Z", "subject": "Application sent", "body": "Sent CV", "direction": "OUTBOUND"},
    )
    assert comms.status_code == 201
    assert client.get(f"/api/applications/{app_id}/comms").json()["items"][0]["subject"] == "Application sent"

    # 10. Board list reflects the moved card + next action.
    board = client.get("/api/applications").json()["items"]
    card = next(c for c in board if c["id"] == app_id)
    assert card["status"] == "APPLIED"
    assert card["next_action"] == "Follow up with hiring manager"

    # 11. Suggestions are runnable: feed one's phrase straight into basic search.
    suggestions = client.post("/api/suggestions").json()["suggestions"]
    assert len(suggestions) >= 3
    replay = client.post("/api/search/basic", json={"phrase": suggestions[0]["phrase"]})
    assert replay.status_code == 200 and replay.json()["jobs"][0]["uuid"] == JOB_UUID
