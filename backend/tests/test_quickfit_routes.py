from __future__ import annotations

from collections.abc import Generator

from fastapi.testclient import TestClient
from sqlmodel import Session, SQLModel

from app.config import Settings
from app.db import create_db_engine, get_session
from app.main import create_app
from app.routers.search import get_hr4u_client
from app.routers.quickfit import get_quickfit_service
from app.schemas.hr4u import Hr4uJob, Hr4uJobDetailResult
from app.schemas.quickfit import QuickFitInputs, QuickFitResult


class FakeHr4uClient:
    async def job_detail(self, uuid: str) -> Hr4uJobDetailResult:
        return Hr4uJobDetailResult.found(
            Hr4uJob.model_validate(
                {"uuid": uuid, "company": "ACME", "text": {"title": "Data Analyst", "requirements": ["SQL"]}}
            )
        )


class FakeQuickFitService:
    async def run(self, inputs: QuickFitInputs) -> QuickFitResult:
        return QuickFitResult(verdict="STRETCH", headline="Worth a shot with framing.", top_gaps=["German C1"])


def make_client(tmp_path) -> TestClient:
    database_url = f"sqlite:///{tmp_path / 'quickfit.db'}"
    engine = create_db_engine(Settings(DATABASE_URL=database_url))
    SQLModel.metadata.create_all(engine)
    app = create_app(Settings(DATABASE_URL=database_url, LLM_DEFAULT_PROVIDER="mistral"))

    def override_session() -> Generator[Session, None, None]:
        with Session(engine) as session:
            yield session

    app.dependency_overrides[get_session] = override_session
    app.dependency_overrides[get_hr4u_client] = lambda: FakeHr4uClient()
    app.dependency_overrides[get_quickfit_service] = lambda: FakeQuickFitService()
    return TestClient(app)


def test_quickfit_returns_verdict(tmp_path) -> None:
    client = make_client(tmp_path)
    client.put("/api/profile", json={"full_name": "Ada"})

    response = client.post("/api/quickfit", json={"job_uuid": "job-1"})

    assert response.status_code == 200
    body = response.json()
    assert body["verdict"] == "STRETCH"
    assert body["top_gaps"] == ["German C1"]


def test_quickfit_result_coerces_loose_shape() -> None:
    result = QuickFitResult.model_validate({"rating": "good", "summary": "Clear match.", "gaps": "German"})
    assert result.verdict == "STRONG"
    assert result.headline == "Clear match."
    assert result.top_gaps == ["German"]
