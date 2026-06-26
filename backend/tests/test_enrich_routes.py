from __future__ import annotations

from collections.abc import Generator

from fastapi.testclient import TestClient
from sqlmodel import Session, SQLModel

from app.config import Settings
from app.db import create_db_engine, get_session
from app.main import create_app
from app.routers.profile import get_enrich_service
from app.schemas.enrich import (
    EnrichApplyInputs,
    EnrichInputs,
    EnrichQuestion,
    EnrichQuestionsResult,
    ExperienceBulletPatch,
    ProfileEnrichment,
)
from app.schemas.profile import CvParsedEducation, CvParsedSkill


class FakeEnrichService:
    async def questions(self, inputs: EnrichInputs) -> EnrichQuestionsResult:
        return EnrichQuestionsResult(
            questions=[
                EnrichQuestion(key="years", question="How many years of Python?", purpose="Gauge seniority", field="years_exp"),
                EnrichQuestion(key="impact", question="Biggest measurable impact?", purpose="Quantify", field="impact"),
                EnrichQuestion(key="german", question="German level?", purpose="Filter", field="language"),
            ]
        )

    async def apply(self, inputs: EnrichApplyInputs) -> ProfileEnrichment:
        experiences = inputs.profile.get("experiences", [])
        experience_updates = []
        if experiences:
            experience_updates.append(
                ExperienceBulletPatch(
                    experience_id=experiences[0]["id"],
                    add_bullets=["Cut p95 latency by 40% across the platform."],
                )
            )
        return ProfileEnrichment(
            seniority="senior",
            years_exp=8,
            summary="Senior backend engineer with measurable platform impact.",
            target_roles=["Backend Engineer", "Platform Engineer"],
            add_skills=[CvParsedSkill(name="Kubernetes", kind="IT_SKILL"), CvParsedSkill(name="German", kind="LANGUAGE", level="B2")],
            add_education=[CvParsedEducation(degree="M.Sc. Computer Science", institution="TU Berlin", end="2018-09")],
            experience_updates=experience_updates,
            change_summary=["Set seniority to senior", "Added 2 skills"],
        )


def make_client(tmp_path) -> TestClient:
    database_url = f"sqlite:///{tmp_path / 'enrich.db'}"
    engine = create_db_engine(Settings(DATABASE_URL=database_url))
    SQLModel.metadata.create_all(engine)
    app = create_app(Settings(DATABASE_URL=database_url, LLM_DEFAULT_PROVIDER="mistral"))

    def override_session() -> Generator[Session, None, None]:
        with Session(engine) as session:
            yield session

    app.dependency_overrides[get_session] = override_session
    app.dependency_overrides[get_enrich_service] = lambda: FakeEnrichService()
    return TestClient(app)


def test_enrich_questions_returns_targeted_questions(tmp_path) -> None:
    client = make_client(tmp_path)
    client.put("/api/profile", json={"full_name": "Ada"})

    response = client.post("/api/profile/enrich/questions")

    assert response.status_code == 200
    questions = response.json()["questions"]
    assert len(questions) == 3
    assert {q["field"] for q in questions} == {"years_exp", "impact", "language"}


def test_enrich_apply_folds_answers_into_profile(tmp_path) -> None:
    client = make_client(tmp_path)
    client.put("/api/profile", json={"full_name": "Ada"})
    client.post("/api/profile/skills", json={"name": "Python", "kind": "IT_SKILL"})

    response = client.post(
        "/api/profile/enrich/apply",
        json={"answers": [{"key": "years", "question": "How many years?", "answer": "8 years"}]},
    )

    assert response.status_code == 200
    body = response.json()
    profile = body["profile"]
    assert profile["seniority"] == "senior"
    assert profile["years_exp"] == 8
    assert "platform impact" in profile["summary"]
    assert profile["preferences"]["target_roles"] == ["Backend Engineer", "Platform Engineer"]
    skill_names = {s["name"] for s in profile["skills"]}
    assert {"Python", "Kubernetes", "German"} <= skill_names
    assert sorted(body["added_skills"]) == ["German", "Kubernetes"]
    assert body["changes"]


def test_enrich_apply_does_not_duplicate_existing_skill(tmp_path) -> None:
    client = make_client(tmp_path)
    client.put("/api/profile", json={"full_name": "Ada"})
    client.post("/api/profile/skills", json={"name": "kubernetes", "kind": "IT_SKILL"})  # lower-case

    body = client.post(
        "/api/profile/enrich/apply",
        json={"answers": [{"key": "x", "question": "q", "answer": "a"}]},
    ).json()

    kube = [s for s in body["profile"]["skills"] if s["name"].casefold() == "kubernetes"]
    assert len(kube) == 1  # not duplicated despite the LLM proposing "Kubernetes"
    assert "Kubernetes" not in body["added_skills"]


def test_enrich_apply_adds_experience_bullets_and_education(tmp_path) -> None:
    client = make_client(tmp_path)
    client.put("/api/profile", json={"full_name": "Ada"})
    exp = client.post(
        "/api/profile/experiences",
        json={"title": "Backend Engineer", "company": "ACME", "bullets": ["Built APIs."]},
    ).json()

    body = client.post(
        "/api/profile/enrich/apply",
        json={"answers": [{"key": "impact", "question": "Impact?", "answer": "Cut latency 40%"}]},
    ).json()

    updated_exp = next(e for e in body["profile"]["experiences"] if e["id"] == exp["id"])
    assert "Cut p95 latency by 40% across the platform." in updated_exp["bullets"]
    assert "Built APIs." in updated_exp["bullets"]  # original kept
    degrees = {e["degree"] for e in body["profile"]["education"]}
    assert "M.Sc. Computer Science" in degrees
