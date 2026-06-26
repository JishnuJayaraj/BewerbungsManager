from collections.abc import Generator
from typing import Any

from fastapi.testclient import TestClient
from sqlmodel import Session, SQLModel

from app.config import Settings
from app.db import create_db_engine, get_session
from app.main import create_app
from app.routers.search import get_hr4u_client
from app.schemas.hr4u import Hr4uJob, Hr4uJobDetailResult, Hr4uSearchResponse


def sample_job(uuid: str, *, link: str = "https://example.test/job") -> Hr4uJob:
    return Hr4uJob.model_validate(
        {
            "uuid": uuid,
            "link": link,
            "company": "Example GmbH",
            "companyCleaned": "Example GmbH",
            "text": {
                "title": "Python Engineer",
                "fulltext": "<p>Python APIs</p>",
                "requirements": ["Python"],
            },
            "period": {"dateFrom": "2026-02-01", "dateTo": None},
            "addresses": [{"place": "Berlin", "country": "DE", "county": "Berlin", "zipCode": "10115"}],
            "classifications": {
                "employmentTypes": ["FULL_TIME"],
                "jobTypes": ["OCCUPATION"],
                "occupationAreas": ["IT"],
            },
            "score": 0.8,
            "highlights": {"text.title": ["Python"]},
        }
    )


class FakeHr4uClient:
    def __init__(self) -> None:
        self.search_bodies: list[dict[str, Any]] = []

    async def autocomplete(self, phrase: str, *, size: int = 10) -> list[Hr4uJob]:
        assert phrase == "Python"
        assert size == 2
        return [sample_job("job-a")]

    async def search(self, body: dict[str, Any]) -> Hr4uSearchResponse:
        self.search_bodies.append(body)
        return Hr4uSearchResponse(
            hits=2,
            page=body.get("page", 1),
            aggregations={"employmentTypes": []},
            jobs=[
                sample_job("job-a", link="https://example.test/a"),
                sample_job("job-a", link="https://example.test/a-duplicate"),
            ],
        )

    async def job_detail(self, uuid: str) -> Hr4uJobDetailResult:
        if uuid == "expired":
            return Hr4uJobDetailResult.expired(uuid)
        return Hr4uJobDetailResult.found(sample_job(uuid))


def make_client(tmp_path) -> tuple[TestClient, FakeHr4uClient]:
    fake_hr4u = FakeHr4uClient()
    database_url = f"sqlite:///{tmp_path / 'search-routes.db'}"
    engine = create_db_engine(Settings(DATABASE_URL=database_url))
    SQLModel.metadata.create_all(engine)
    app = create_app(Settings(DATABASE_URL=database_url, LLM_DEFAULT_PROVIDER="mistral"))

    def override_session() -> Generator[Session, None, None]:
        with Session(engine) as session:
            yield session

    app.dependency_overrides[get_session] = override_session
    app.dependency_overrides[get_hr4u_client] = lambda: fake_hr4u
    return TestClient(app), fake_hr4u


def test_basic_search_builds_must_title_query_filters_and_dedupes(tmp_path) -> None:
    client, fake_hr4u = make_client(tmp_path)

    response = client.post(
        "/api/search/basic",
        json={
            "phrase": "Python",
            "location": {"lat": 52.52, "lon": 13.405, "radius_km": 30},
            "job_types": ["OCCUPATION"],
            "employment_types": ["FULL_TIME"],
            "page": 1,
            "size": 20,
        },
    )

    assert response.status_code == 200
    body = response.json()
    assert body["deduped"] == 1
    assert len(body["jobs"]) == 1
    assert body["jobs"][0]["title"] == "Python Engineer"
    sent = fake_hr4u.search_bodies[0]
    assert sent["queries"][0] == {
        "autocomplete": False,
        "fields": ["text.title", "company"],
        "phrase": "Python",
        "queryType": "must",
        "type": "single",
    }
    assert {"type": "distance", "lat": 52.52, "lon": 13.405, "distance": 30.0} in sent["filters"]
    assert {"type": "text", "field": "classifications.jobTypes", "in": ["OCCUPATION"]} in sent["filters"]
    assert {
        "type": "text",
        "field": "classifications.employmentTypes",
        "in": ["FULL_TIME"],
    } in sent["filters"]


def test_advanced_search_replays_body_verbatim_to_hr4u_and_dedupes(tmp_path) -> None:
    client, fake_hr4u = make_client(tmp_path)
    advanced_body = {
        "queries": [{"type": "semantic", "phrase": "backend python", "queryType": "must"}],
        "filters": [{"type": "isSet", "field": "period.dateFrom"}],
        "page": 3,
        "size": 5,
    }

    response = client.post("/api/search/advanced", json=advanced_body)

    assert response.status_code == 200
    assert fake_hr4u.search_bodies[0] == advanced_body
    assert response.json()["page"] == 3
    assert response.json()["deduped"] == 1


def test_autocomplete_and_job_detail_routes(tmp_path) -> None:
    client, _ = make_client(tmp_path)

    autocomplete = client.get("/api/search/autocomplete", params={"phrase": "Python", "size": 2})
    detail = client.get("/api/jobs/job-a")
    expired = client.get("/api/jobs/expired")

    assert autocomplete.status_code == 200
    assert autocomplete.json() == [{"uuid": "job-a", "title": "Python Engineer", "company": "Example GmbH"}]
    assert detail.status_code == 200
    assert detail.json()["text"]["fulltext"] == "Python APIs"
    assert expired.status_code == 410
    assert expired.json()["error"]["code"] == "job_expired"


def test_search_presets_crud_preserves_query_json(tmp_path) -> None:
    client, _ = make_client(tmp_path)
    query_json = {"queries": [{"type": "single", "phrase": "Python"}], "size": 7}

    created = client.post("/api/search/presets", json={"name": "Python jobs", "query_json": query_json})
    assert created.status_code == 201
    preset = created.json()
    assert preset["query_json"] == query_json

    listed = client.get("/api/search/presets")
    assert listed.status_code == 200
    assert listed.json()["total"] == 1
    assert listed.json()["items"][0]["query_json"] == query_json

    fetched = client.get(f"/api/search/presets/{preset['id']}")
    assert fetched.status_code == 200
    assert fetched.json()["query_json"] == query_json

    deleted = client.delete(f"/api/search/presets/{preset['id']}")
    assert deleted.status_code == 204
    assert client.get(f"/api/search/presets/{preset['id']}").status_code == 404
