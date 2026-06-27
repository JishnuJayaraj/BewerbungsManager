from __future__ import annotations

from collections.abc import Generator

from fastapi.testclient import TestClient
from sqlmodel import Session, SQLModel

from app.config import Settings
from app.db import create_db_engine, get_session
from app.main import create_app
from app.routers.profile import get_improve_service
from app.schemas.improve import ImproveInputs, ImproveResult


class FakeImproveService:
    async def run(self, inputs: ImproveInputs) -> ImproveResult:
        if inputs.target == "summary":
            return ImproveResult(summary="Senior data analyst with measurable BI impact.", note="Led with role + impact.")
        return ImproveResult(bullets=["Cut report time 50% with Python ETL."], note="Quantified the impact.")


def make_client(tmp_path) -> TestClient:
    database_url = f"sqlite:///{tmp_path / 'improve.db'}"
    engine = create_db_engine(Settings(DATABASE_URL=database_url))
    SQLModel.metadata.create_all(engine)
    app = create_app(Settings(DATABASE_URL=database_url, LLM_DEFAULT_PROVIDER="mistral"))

    def override_session() -> Generator[Session, None, None]:
        with Session(engine) as session:
            yield session

    app.dependency_overrides[get_session] = override_session
    app.dependency_overrides[get_improve_service] = lambda: FakeImproveService()
    return TestClient(app)


def test_improve_summary(tmp_path) -> None:
    client = make_client(tmp_path)
    client.put("/api/profile", json={"summary": "i do data stuff"})

    response = client.post("/api/profile/improve", json={"target": "summary"})

    assert response.status_code == 200
    assert "measurable" in response.json()["summary"]


def test_improve_experience_bullets(tmp_path) -> None:
    client = make_client(tmp_path)
    client.put("/api/profile", json={"full_name": "Ada"})
    exp = client.post("/api/profile/experiences", json={"title": "Analyst", "bullets": ["did reports"]}).json()

    response = client.post("/api/profile/improve", json={"target": "experience_bullets", "experience_id": exp["id"]})

    assert response.status_code == 200
    assert response.json()["bullets"][0].startswith("Cut report time")


def test_improve_experience_requires_id(tmp_path) -> None:
    client = make_client(tmp_path)
    client.put("/api/profile", json={"full_name": "Ada"})

    response = client.post("/api/profile/improve", json={"target": "experience_bullets"})

    assert response.status_code == 422
