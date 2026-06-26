from __future__ import annotations

import uuid
from collections.abc import Generator
from typing import Any

from fastapi.testclient import TestClient
from sqlmodel import Session, SQLModel

from app.config import Settings
from app.db import create_db_engine, get_session
from app.main import create_app
from app.models import LOCAL_USER_ID, RequirementCheck, RequirementStatus
from app.routers.search import get_hr4u_client
from app.routers.suggestions import get_suggest_service
from app.schemas.hr4u import Hr4uJob, Hr4uJobDetailResult, Hr4uSearchResponse
from app.schemas.suggest import JobSuggestion, SuggestInputs, SuggestResponse


class FakeHr4uClient:
    def __init__(self) -> None:
        self.search_bodies: list[dict[str, Any]] = []

    async def search(self, body: dict[str, Any]) -> Hr4uSearchResponse:
        self.search_bodies.append(body)
        return Hr4uSearchResponse(hits=0, page=body.get("page", 1), jobs=[])

    async def job_detail(self, uuid: str) -> Hr4uJobDetailResult:
        return Hr4uJobDetailResult.found(
            Hr4uJob.model_validate(
                {
                    "uuid": uuid,
                    "company": "Example GmbH",
                    "text": {"title": "Python Engineer", "fulltext": "Needs Python and German C1"},
                    "classifications": {"employmentTypes": ["FULL_TIME"], "jobTypes": ["OCCUPATION"]},
                }
            )
        )


class FakeSuggestService:
    def __init__(self) -> None:
        self.inputs: list[SuggestInputs] = []

    async def run(self, inputs: SuggestInputs) -> SuggestResponse:
        self.inputs.append(inputs)
        return SuggestResponse(
            suggestions=[
                JobSuggestion(role="Backend Engineer", rationale="Python API background.", phrase="Python backend", skills=["Python", "FastAPI"]),
                JobSuggestion(role="Platform Engineer", rationale="Infrastructure experience.", phrase="Platform Engineer", skills=["Kubernetes"]),
                JobSuggestion(role="Data Engineer", rationale="Python data skills.", phrase="Data Engineer Python", skills=["SQL"]),
            ]
        )


def make_client(tmp_path) -> tuple[TestClient, FakeHr4uClient, FakeSuggestService, Any]:
    database_url = f"sqlite:///{tmp_path / 'checklist-suggestions.db'}"
    engine = create_db_engine(Settings(DATABASE_URL=database_url))
    SQLModel.metadata.create_all(engine)
    app = create_app(Settings(DATABASE_URL=database_url, LLM_DEFAULT_PROVIDER="mistral"))
    hr4u_client = FakeHr4uClient()
    suggest_service = FakeSuggestService()

    def override_session() -> Generator[Session, None, None]:
        with Session(engine) as session:
            yield session

    app.dependency_overrides[get_session] = override_session
    app.dependency_overrides[get_hr4u_client] = lambda: hr4u_client
    app.dependency_overrides[get_suggest_service] = lambda: suggest_service
    return TestClient(app), hr4u_client, suggest_service, engine


def seed_application(client: TestClient) -> str:
    client.put("/api/profile", json={"full_name": "Ada", "headline": "Backend engineer"})
    client.post("/api/profile/skills", json={"name": "Python", "kind": "IT_SKILL"})
    client.post("/api/profile/skills", json={"name": "German", "kind": "LANGUAGE", "level": "B2"})
    return client.post("/api/applications", json={"job_uuid": "job-checklist"}).json()["id"]


def test_checklist_auto_creates_prefills_language_gap_and_persists(tmp_path) -> None:
    client, _, _, engine = make_client(tmp_path)
    app_id = seed_application(client)
    application_id = uuid.UUID(app_id)
    with Session(engine) as session:
        session.add(
                RequirementCheck(
                    user_id=LOCAL_USER_ID,
                    application_id=application_id,
                requirement="German C1",
                status=RequirementStatus.MISSING,
                evidence=[],
            )
        )
        session.commit()

    fetched = client.get(f"/api/applications/{app_id}/checklist")
    body = fetched.json()
    updated = client.put(
        f"/api/applications/{app_id}/checklist",
        json={
            "salary_expectation": "75000 EUR",
            "earliest_start_date": "2026-09-01",
            "language_level_required": body["language_level_required"],
            "language_level_user": body["language_level_user"],
            "work_permit_status": "HAVE_PERMIT",
            "certificates_ready": True,
            "cover_letter_required": True,
            "items": {**body["items"], "salary_set": True, "portal_answers": True},
            "notes": "Need Zeugnisse.",
        },
    )

    assert fetched.status_code == 200
    assert body["language_level_required"] == "C1"
    assert body["language_level_user"] == "B2"
    assert body["items"]["language_ok"] is False
    assert updated.status_code == 200
    assert updated.json()["salary_expectation"] == "75000 EUR"
    assert updated.json()["work_permit_status"] == "HAVE_PERMIT"
    assert updated.json()["items"]["salary_set"] is True
    assert updated.json()["items"]["portal_answers"] is True
    assert updated.json()["notes"] == "Need Zeugnisse."


def test_suggestions_return_runnable_phrases(tmp_path) -> None:
    client, hr4u_client, suggest_service, _ = make_client(tmp_path)
    seed_application(client)

    suggestions = client.post("/api/suggestions")
    cards = suggestions.json()["suggestions"]
    first = cards[0]
    replayed = client.post("/api/search/basic", json={"phrase": first["phrase"]})

    assert suggestions.status_code == 200
    assert len(cards) == 3
    assert first["role"] == "Backend Engineer" and first["phrase"] == "Python backend"
    assert first["skills"] == ["Python", "FastAPI"]
    assert suggest_service.inputs[0].profile["skills"][0]["name"] == "Python"
    assert replayed.status_code == 200
