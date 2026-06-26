from collections.abc import Generator

from fastapi.testclient import TestClient
from sqlmodel import Session, SQLModel

from app.config import Settings
from app.db import create_db_engine, get_session
from app.main import create_app
from app.routers.profile import get_cv_parser
from app.schemas.profile import CvParseResult, CvParsedExperience, CvParsedProject, CvParsedSkill


class FakeParser:
    def __init__(self, *, should_fail: bool = False) -> None:
        self.should_fail = should_fail

    async def parse(self, cv_text: str) -> CvParseResult:
        if self.should_fail:
            raise RuntimeError("parse failed")
        return CvParseResult(
            full_name="Ada Lovelace",
            headline="Backend Engineer",
            seniority="senior",
            years_exp=7,
            summary="Builds Python systems.",
            locations=[{"place": "Berlin", "lat": 52.52, "lon": 13.405, "radius_km": 30}],
            skills=[CvParsedSkill(name="Python", kind="IT_SKILL", level="advanced")],
            experiences=[
                CvParsedExperience(
                    title="Senior Engineer",
                    company="Example GmbH",
                    start="2020-01",
                    end=None,
                    is_current=True,
                    summary="Platform work",
                    bullets=["Built APIs"],
                    tech=["Python"],
                )
            ],
            projects=[
                CvParsedProject(
                    name="Search Platform",
                    role="Lead",
                    summary="Internal search",
                    tech=["Python", "Postgres"],
                    links=["https://example.test"],
                )
            ],
        )


def make_client(tmp_path, parser: FakeParser | None = None) -> TestClient:
    database_url = f"sqlite:///{tmp_path / 'profile-routes.db'}"
    engine = create_db_engine(Settings(DATABASE_URL=database_url))
    SQLModel.metadata.create_all(engine)
    app = create_app(Settings(DATABASE_URL=database_url, LLM_DEFAULT_PROVIDER="mistral"))

    def override_session() -> Generator[Session, None, None]:
        with Session(engine) as session:
            yield session

    app.dependency_overrides[get_session] = override_session
    if parser is not None:
        app.dependency_overrides[get_cv_parser] = lambda: parser
    return TestClient(app)


def test_parse_cv_persists_structured_editable_profile(tmp_path) -> None:
    client = make_client(tmp_path, FakeParser())

    parsed = client.post("/api/profile/parse", json={"cv_text": "Python backend CV"})
    fetched = client.get("/api/profile")

    assert parsed.status_code == 200
    body = parsed.json()
    assert body["parse_warning"] is None
    assert body["full_name"] == "Ada Lovelace"
    assert body["brief_defaults"] == {}
    assert body["skills"][0]["name"] == "Python"
    assert body["skills"][0]["source"] == "CV"
    assert body["experiences"][0]["start"] == "2020-01"
    assert body["projects"][0]["name"] == "Search Platform"
    assert fetched.json()["skills"][0]["name"] == "Python"


def test_parse_failure_returns_empty_editable_profile_with_warning(tmp_path) -> None:
    client = make_client(tmp_path, FakeParser(should_fail=True))

    response = client.post("/api/profile/parse", json={"cv_text": "bad parse"})

    assert response.status_code == 200
    body = response.json()
    assert body["parse_warning"]
    assert body["full_name"] is None
    assert body["skills"] == []
    assert body["experiences"] == []
    assert body["projects"] == []


def test_manual_profile_skill_experience_project_crud_and_brief_defaults(tmp_path) -> None:
    client = make_client(tmp_path)

    updated_profile = client.put(
        "/api/profile",
        json={
            "full_name": "Grace Hopper",
            "brief_defaults": {"tone": "direct", "language": "EN", "target_angle": "platform"},
        },
    )
    assert updated_profile.status_code == 200
    assert updated_profile.json()["brief_defaults"]["target_angle"] == "platform"

    skill = client.post(
        "/api/profile/skills",
        json={"name": "Postgres", "kind": "IT_SKILL", "level": "strong"},
    )
    assert skill.status_code == 201
    skill_id = skill.json()["id"]
    edited_skill = client.put(f"/api/profile/skills/{skill_id}", json={"level": "expert"})
    assert edited_skill.json()["level"] == "expert"

    experience = client.post(
        "/api/profile/experiences",
        json={
            "title": "Staff Engineer",
            "company": "Systems GmbH",
            "start": "2021-04",
            "is_current": True,
            "bullets": ["Led migration"],
            "tech": ["Python", "Postgres"],
        },
    )
    assert experience.status_code == 201
    experience_id = experience.json()["id"]
    edited_experience = client.put(
        f"/api/profile/experiences/{experience_id}",
        json={"summary": "Data platform", "end": "2023-09"},
    )
    assert edited_experience.json()["end"] == "2023-09"

    project = client.post(
        "/api/profile/projects",
        json={"name": "Analytics", "role": "Lead", "tech": ["Python"], "links": []},
    )
    assert project.status_code == 201
    project_id = project.json()["id"]
    edited_project = client.put(f"/api/profile/projects/{project_id}", json={"summary": "Dashboards"})
    assert edited_project.json()["summary"] == "Dashboards"

    profile = client.get("/api/profile").json()
    assert profile["full_name"] == "Grace Hopper"
    assert profile["brief_defaults"]["language"] == "EN"
    assert profile["skills"][0]["level"] == "expert"
    assert profile["experiences"][0]["summary"] == "Data platform"
    assert profile["projects"][0]["summary"] == "Dashboards"

    assert client.delete(f"/api/profile/skills/{skill_id}").status_code == 204
    assert client.delete(f"/api/profile/experiences/{experience_id}").status_code == 204
    assert client.delete(f"/api/profile/projects/{project_id}").status_code == 204
    empty_profile = client.get("/api/profile").json()
    assert empty_profile["skills"] == []
    assert empty_profile["experiences"] == []
    assert empty_profile["projects"] == []
