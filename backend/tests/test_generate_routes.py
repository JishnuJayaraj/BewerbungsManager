from __future__ import annotations

from collections.abc import Generator

from fastapi.testclient import TestClient
from sqlmodel import Session, SQLModel

from app.config import Settings
from app.db import create_db_engine, get_session
from app.main import create_app
from app.models import ArtifactKind
from app.routers.generate import get_generate_service
from app.routers.search import get_hr4u_client
from app.schemas.generate import (
    CoverLetterContent,
    CvBulletSuggestion,
    CvBulletSuggestionsContent,
    GenerateInputs,
    PortalAnswerContent,
)
from app.schemas.hr4u import Hr4uJob, Hr4uJobDetailResult
from app.services.citations import CitationClaim
from app.services.generate import GenerateResult


class FakeHr4uClient:
    async def job_detail(self, uuid: str) -> Hr4uJobDetailResult:
        return Hr4uJobDetailResult.found(
            Hr4uJob.model_validate(
                {
                    "uuid": uuid,
                    "company": "Example GmbH",
                    "text": {
                        "title": "Python Engineer",
                        "fulltext": "Needs Python and German C1",
                        "requirements": ["Python", "German C1"],
                    },
                    "classifications": {"employmentTypes": ["FULL_TIME"], "jobTypes": ["OCCUPATION"]},
                }
            )
        )


class FakeGenerateService:
    def __init__(self) -> None:
        self.calls: list[tuple[ArtifactKind, GenerateInputs]] = []

    async def run(self, kind: ArtifactKind, inputs: GenerateInputs) -> GenerateResult:
        self.calls.append((kind, inputs))
        skill_id = inputs.profile["skills"][0]["id"]
        experience_id = inputs.profile["experiences"][0]["id"]
        match kind:
            case ArtifactKind.COVER_LETTER:
                body = "Sehr geehrte Damen und Herren,\n\nIch arbeite mit Python.\n\nMit freundlichen Gruessen"
                return GenerateResult(
                    content=CoverLetterContent(
                        language="DE",
                        format="anschreiben",
                        subject="Bewerbung als Python Engineer",
                        body=body,
                        claims=[
                            CitationClaim(claim="Ich arbeite mit Python.", evidence_ref=f"skill:{skill_id}"),
                            CitationClaim(claim="Ich habe German C1.", evidence_ref="UNSUPPORTED"),
                        ],
                    ),
                    model_used="mistral/generate-test",
                )
            case ArtifactKind.CV_BULLET_SUGGESTIONS:
                suggested = "Built Python APIs for internal hiring workflows."
                if inputs.instruction:
                    suggested = "Built concise Python APIs for hiring workflows."
                return GenerateResult(
                    content=CvBulletSuggestionsContent(
                        suggestions=[
                            CvBulletSuggestion(
                                experience_ref=f"experience:{experience_id}",
                                original="Built APIs.",
                                suggested=suggested,
                                reason="Matches the backend role.",
                                evidence_ref=f"experience:{experience_id}",
                            )
                        ],
                        emphasize=[f"skill:{skill_id}"],
                        do_not_pretend=inputs.do_not_claim,
                    ),
                    model_used="mistral/generate-test",
                )
            case ArtifactKind.PORTAL_ANSWER:
                return GenerateResult(
                    content=PortalAnswerContent(
                        question=inputs.portal_question or "",
                        language="DE",
                        answer="Ich moechte an nutzerorientierten Recruiting-Produkten arbeiten.",
                        claims=[CitationClaim(claim="nutzerorientierte Produkte", evidence_ref="job:text.title")],
                    ),
                    model_used="mistral/generate-test",
                )
            case _:
                raise AssertionError(f"Unexpected kind {kind}")


def make_client(tmp_path) -> tuple[TestClient, FakeGenerateService]:
    database_url = f"sqlite:///{tmp_path / 'generate-routes.db'}"
    engine = create_db_engine(Settings(DATABASE_URL=database_url))
    SQLModel.metadata.create_all(engine)
    app = create_app(Settings(DATABASE_URL=database_url, LLM_DEFAULT_PROVIDER="mistral"))
    generate_service = FakeGenerateService()

    def override_session() -> Generator[Session, None, None]:
        with Session(engine) as session:
            yield session

    app.dependency_overrides[get_session] = override_session
    app.dependency_overrides[get_hr4u_client] = lambda: FakeHr4uClient()
    app.dependency_overrides[get_generate_service] = lambda: generate_service
    return TestClient(app), generate_service


def seed_application(client: TestClient) -> str:
    client.put("/api/profile", json={"full_name": "Ada"})
    client.post("/api/profile/skills", json={"name": "Python", "kind": "IT_SKILL"})
    client.post(
        "/api/profile/experiences",
        json={"title": "Backend Engineer", "company": "ACME", "bullets": ["Built APIs."], "tech": ["Python"]},
    )
    app_id = client.post("/api/applications", json={"job_uuid": "job-generate"}).json()["id"]
    client.put(
        f"/api/applications/{app_id}/brief",
        json={"language": "DE", "tone": "formal", "company_motivation": "Useful HR tooling"},
    )
    return app_id


def test_generate_cover_letter_citations_and_exports(tmp_path) -> None:
    client, _ = make_client(tmp_path)
    app_id = seed_application(client)

    response = client.post(f"/api/applications/{app_id}/generate", json={"kind": "COVER_LETTER"})
    body = response.json()
    markdown = client.get(f"/api/artifacts/{body['id']}/export?format=markdown")
    pdf = client.get(f"/api/artifacts/{body['id']}/export?format=pdf")

    assert response.status_code == 201
    assert body["content"]["format"] == "anschreiben"
    assert "Sehr geehrte" in body["content"]["body"]
    assert body["has_unsupported"] is True
    assert [citation["status"] for citation in body["citations"]] == ["SUPPORTED", "UNSUPPORTED"]
    assert markdown.status_code == 200
    assert "Bewerbung als Python Engineer" in markdown.text
    assert pdf.status_code == 200
    assert pdf.content.startswith(b"%PDF")


def test_regenerate_cv_bullets_preserves_history_and_current_version(tmp_path) -> None:
    client, service = make_client(tmp_path)
    app_id = seed_application(client)

    first = client.post(f"/api/applications/{app_id}/generate", json={"kind": "CV_BULLET_SUGGESTIONS"}).json()
    second = client.post(
        f"/api/applications/{app_id}/generate",
        json={"kind": "CV_BULLET_SUGGESTIONS", "instruction": "make it shorter"},
    ).json()
    versions = client.get(f"/api/applications/{app_id}/artifacts?kind=CV_BULLET_SUGGESTIONS").json()["items"]

    assert first["id"] != second["id"]
    assert second["is_current"] is True
    assert versions[0]["id"] == second["id"]
    assert {version["is_current"] for version in versions} == {False, True}
    assert service.calls[1][1].previous_artifact == first["content"]


def test_portal_answer_requires_question_and_can_generate(tmp_path) -> None:
    client, _ = make_client(tmp_path)
    app_id = seed_application(client)

    missing = client.post(f"/api/applications/{app_id}/generate", json={"kind": "PORTAL_ANSWER"})
    generated = client.post(
        f"/api/applications/{app_id}/generate",
        json={"kind": "PORTAL_ANSWER", "portal_question": "Warum dieses Unternehmen?"},
    )

    assert missing.status_code == 422
    assert generated.status_code == 201
    assert generated.json()["content"]["question"] == "Warum dieses Unternehmen?"
    assert generated.json()["has_unsupported"] is False


def test_cover_letter_body_strips_inline_refs() -> None:
    from app.schemas.generate import CoverLetterContent

    content = CoverLetterContent.model_validate(
        {
            "language": "EN",
            "format": "plain",
            "subject": "X",
            "body": "Built ETL pipelines. [evidence_ref:experience:abc][skill:def] Shipped dashboards.",
        }
    )
    assert "[" not in content.body
    assert "evidence_ref" not in content.body
    assert content.body == "Built ETL pipelines. Shipped dashboards."
