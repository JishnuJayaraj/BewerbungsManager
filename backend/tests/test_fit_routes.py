from collections.abc import Generator

from fastapi.testclient import TestClient
from sqlmodel import Session, SQLModel

from app.config import Settings
from app.db import create_db_engine, get_session
from app.main import create_app
from app.routers.fit import get_fit_service
from app.routers.search import get_hr4u_client
from app.schemas.fit import EvidencePoint, FitAnalysis, FitInputs, FitLlmResult, FitRequirement, RiskPoint
from app.schemas.hr4u import Hr4uJob, Hr4uJobDetailResult


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


class FakeFitService:
    def __init__(self) -> None:
        self.calls = 0

    async def run(self, inputs: FitInputs) -> FitLlmResult:
        self.calls += 1
        skill_id = inputs.profile["skills"][0]["id"]
        return FitLlmResult(
            fit=FitAnalysis(
                summary=f"Fit run {self.calls}",
                strong_matches=[EvidencePoint(point="Python backend", evidence_ref=f"skill:{skill_id}")],
                weak_matches=[],
                unknowns=[],
                suggested_angle="Backend platform",
                risks_to_address=[RiskPoint(risk="German C1", honest_framing="State current level honestly")],
                do_not_claim=["German C1"],
            ),
            requirements=[
                FitRequirement(requirement="Python", status="HAVE", evidence_ref=f"skill:{skill_id}"),
                FitRequirement(requirement="German C1", status="MISSING", evidence_ref="skill:not-a-uuid"),
            ],
        )


def make_client(tmp_path) -> tuple[TestClient, FakeFitService]:
    database_url = f"sqlite:///{tmp_path / 'fit-routes.db'}"
    engine = create_db_engine(Settings(DATABASE_URL=database_url))
    SQLModel.metadata.create_all(engine)
    app = create_app(Settings(DATABASE_URL=database_url, LLM_DEFAULT_PROVIDER="mistral"))
    fit_service = FakeFitService()

    def override_session() -> Generator[Session, None, None]:
        with Session(engine) as session:
            yield session

    app.dependency_overrides[get_session] = override_session
    app.dependency_overrides[get_hr4u_client] = lambda: FakeHr4uClient()
    app.dependency_overrides[get_fit_service] = lambda: fit_service
    return TestClient(app), fit_service


def test_run_get_rerun_and_override_fit(tmp_path) -> None:
    client, fit_service = make_client(tmp_path)
    client.put("/api/profile", json={"full_name": "Ada"})
    client.post("/api/profile/skills", json={"name": "Python", "kind": "IT_SKILL"})
    app_id = client.post("/api/applications", json={"job_uuid": "job-fit"}).json()["id"]

    first = client.post(f"/api/applications/{app_id}/fit")
    fetched = client.get(f"/api/applications/{app_id}/fit")
    second = client.post(f"/api/applications/{app_id}/fit")
    requirement_id = second.json()["requirements"][0]["id"]
    patched = client.patch(
        f"/api/applications/{app_id}/requirements/{requirement_id}",
        json={"user_override": "PARTIAL"},
    )

    assert first.status_code == 200
    first_body = first.json()
    assert first_body["fit"]["summary"] == "Fit run 1"
    assert first_body["requirements"][0]["evidence"]
    assert first_body["requirements"][1]["evidence"] == []
    assert fetched.json()["artifact_id"] == first_body["artifact_id"]
    assert second.json()["artifact_id"] != first_body["artifact_id"]
    assert second.json()["fit"]["summary"] == "Fit run 2"
    assert patched.json()["user_override"] == "PARTIAL"
    assert fit_service.calls == 2
