from collections.abc import Generator

from fastapi.testclient import TestClient
from sqlmodel import Session, SQLModel

from app.config import Settings
from app.db import create_db_engine, get_session
from app.main import create_app
from app.routers.search import get_hr4u_client
from app.schemas.hr4u import Hr4uJob, Hr4uJobDetailResult


def job_detail(uuid: str = "job-1") -> Hr4uJob:
    return Hr4uJob.model_validate(
        {
            "uuid": uuid,
            "link": "https://example.test/job-1",
            "company": "Example GmbH",
            "companyCleaned": "Example GmbH",
            "text": {
                "title": "Platform Engineer",
                "fulltext": "<p>Build platforms</p>",
                "requirements": ["Python"],
            },
            "counterpart": {"email": "jobs@example.test", "phone": "123"},
            "classifications": {"employmentTypes": ["FULL_TIME"], "jobTypes": ["OCCUPATION"]},
        }
    )


class FakeHr4uClient:
    async def job_detail(self, uuid: str) -> Hr4uJobDetailResult:
        if uuid == "expired":
            return Hr4uJobDetailResult.expired(uuid)
        return Hr4uJobDetailResult.found(job_detail(uuid))


def make_client(tmp_path) -> TestClient:
    database_url = f"sqlite:///{tmp_path / 'applications-routes.db'}"
    engine = create_db_engine(Settings(DATABASE_URL=database_url))
    SQLModel.metadata.create_all(engine)
    app = create_app(Settings(DATABASE_URL=database_url, LLM_DEFAULT_PROVIDER="mistral"))

    def override_session() -> Generator[Session, None, None]:
        with Session(engine) as session:
            yield session

    app.dependency_overrides[get_session] = override_session
    app.dependency_overrides[get_hr4u_client] = lambda: FakeHr4uClient()
    return TestClient(app)


def test_save_application_snapshots_job_and_is_idempotent(tmp_path) -> None:
    client = make_client(tmp_path)

    created = client.post("/api/applications", json={"job_uuid": "job-1"})
    duplicate = client.post("/api/applications", json={"job_uuid": "job-1"})
    listed = client.get("/api/applications")

    assert created.status_code == 201
    body = created.json()
    assert body["job_uuid"] == "job-1"
    assert body["job_title"] == "Platform Engineer"
    assert body["company"] == "Example GmbH"
    assert body["job_snapshot"]["text"]["fulltext"] == "Build platforms"
    assert body["contact"]["email"] == "jobs@example.test"
    assert duplicate.status_code == 409
    assert listed.json()["total"] == 1
    assert listed.json()["items"][0]["id"] == body["id"]


def test_patch_get_and_delete_application(tmp_path) -> None:
    client = make_client(tmp_path)
    app_id = client.post("/api/applications", json={"job_uuid": "job-1"}).json()["id"]

    patched = client.patch(
        f"/api/applications/{app_id}",
        json={
            "status": "APPLIED",
            "board_order": 4,
            "next_action": "Follow up",
            "followup_date": "2026-07-01",
            "needs_followup": True,
            "contact": {"email": "owner@example.test"},
        },
    )
    fetched = client.get(f"/api/applications/{app_id}")
    deleted = client.delete(f"/api/applications/{app_id}")
    missing = client.get(f"/api/applications/{app_id}")

    assert patched.status_code == 200
    assert fetched.json()["status"] == "APPLIED"
    assert fetched.json()["board_order"] == 4
    assert fetched.json()["next_action"] == "Follow up"
    assert fetched.json()["needs_followup"] is True
    assert fetched.json()["contact"]["email"] == "owner@example.test"
    assert fetched.json()["applied_at"] is not None
    assert deleted.status_code == 204
    assert missing.status_code == 404


def test_brief_prefills_from_profile_defaults_and_updates(tmp_path) -> None:
    client = make_client(tmp_path)
    client.put(
        "/api/profile",
        json={"brief_defaults": {"tone": "direct", "language": "DE", "target_angle": "backend"}},
    )
    app_id = client.post("/api/applications", json={"job_uuid": "job-1"}).json()["id"]

    brief = client.get(f"/api/applications/{app_id}/brief")
    updated = client.put(
        f"/api/applications/{app_id}/brief",
        json={
            "target_angle": "platform",
            "emphasize": ["skill:python"],
            "avoid": "Do not overstate Kubernetes",
            "tone": "confident",
            "language": "EN",
            "company_motivation": "Product and engineering culture",
            "user_notes": "Remote-friendly",
        },
    )

    assert brief.status_code == 200
    assert brief.json()["target_angle"] == "backend"
    assert brief.json()["tone"] == "direct"
    assert brief.json()["language"] == "DE"
    assert updated.json()["target_angle"] == "platform"
    assert updated.json()["emphasize"] == ["skill:python"]
    assert updated.json()["company_motivation"] == "Product and engineering culture"


def test_comms_log_create_list_delete(tmp_path) -> None:
    client = make_client(tmp_path)
    app_id = client.post("/api/applications", json={"job_uuid": "job-1"}).json()["id"]

    created = client.post(
        f"/api/applications/{app_id}/comms",
        json={
            "kind": "EMAIL",
            "occurred_at": "2026-06-26T10:00:00Z",
            "subject": "Applied",
            "body": "Sent application",
            "direction": "OUTBOUND",
        },
    )
    listed = client.get(f"/api/applications/{app_id}/comms")
    entry_id = created.json()["id"]
    deleted = client.delete(f"/api/applications/{app_id}/comms/{entry_id}")
    empty = client.get(f"/api/applications/{app_id}/comms")

    assert created.status_code == 201
    assert listed.json()["total"] == 1
    assert listed.json()["items"][0]["subject"] == "Applied"
    assert deleted.status_code == 204
    assert empty.json()["items"] == []


def test_funnel_signals_gone_quiet_and_active(tmp_path) -> None:
    from datetime import datetime, timedelta, timezone
    from sqlmodel import Session, select
    from app.models import Application

    database_url = f"sqlite:///{tmp_path / 'funnel.db'}"
    engine = create_db_engine(Settings(DATABASE_URL=database_url))
    SQLModel.metadata.create_all(engine)
    app = create_app(Settings(DATABASE_URL=database_url, LLM_DEFAULT_PROVIDER="mistral"))

    def override_session() -> Generator[Session, None, None]:
        with Session(engine) as session:
            yield session

    app.dependency_overrides[get_session] = override_session
    app.dependency_overrides[get_hr4u_client] = lambda: FakeHr4uClient()
    client = TestClient(app)

    client.post("/api/applications", json={"job_uuid": "ghost-job"})
    app_id = client.get("/api/applications").json()["items"][0]["id"]

    # move to APPLIED, then backdate applied_at well past the threshold
    client.patch(f"/api/applications/{app_id}", json={"status": "APPLIED"})
    with Session(engine) as session:
        row = session.exec(select(Application)).one()
        row.applied_at = datetime.now(timezone.utc) - timedelta(days=40)
        session.add(row)
        session.commit()

    card = client.get("/api/applications").json()["items"][0]
    assert card["status"] == "APPLIED"
    assert card["gone_quiet"] is True
    assert card["days_since_applied"] >= 40
    assert card["is_active"] is True

    # ghosted archive state is not active
    client.patch(f"/api/applications/{app_id}", json={"status": "GHOSTED"})
    card = client.get("/api/applications").json()["items"][0]
    assert card["status"] == "GHOSTED"
    assert card["is_active"] is False
    assert card["gone_quiet"] is False


def test_mark_applied_auto_arms_followup(tmp_path) -> None:
    client = make_client(tmp_path)
    client.post("/api/applications", json={"job_uuid": "auto-followup"})
    app_id = client.get("/api/applications").json()["items"][0]["id"]

    applied = client.patch(f"/api/applications/{app_id}", json={"status": "APPLIED"}).json()
    assert applied["applied_at"] is not None
    assert applied["followup_date"] is not None  # auto-armed (+14d by default)
