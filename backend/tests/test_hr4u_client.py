import asyncio
import os
from typing import Any

import httpx
import pytest

from app.config import Settings
from app.schemas.hr4u import Hr4uJob
from app.services.hr4u import Hr4uClient, build_search_body


SAMPLE_JOB: dict[str, Any] = {
    "uuid": "708784a9-01df-4d08-b28e-fc4a34825478",
    "link": "https://example.test/job",
    "company": "CAS Software AG",
    "companyCleaned": "CAS Software AG",
    "text": {
        "title": "Senior Python Engineer",
        "fulltext": "<div><p>Build <strong>Python</strong> services.</p></div>",
        "tasks": ["Build APIs"],
        "requirements": ["Python", "Distributed systems"],
        "closing": "",
    },
    "period": {"dateFrom": "2026-01-01", "dateTo": None},
    "addresses": [
        {
            "place": "Berlin",
            "country": "DE",
            "county": "Berlin",
            "zipCode": "10115",
            "coordinates": {"lat": 52.52, "lon": 13.405},
        }
    ],
    "counterpart": {"email": "", "phone": ""},
    "classifications": {
        "companyType": "COMPANY",
        "contractTypes": ["PERMANENT"],
        "employmentTypes": ["FULL_TIME"],
        "jobTypes": ["OCCUPATION"],
        "occupationAreas": ["IT"],
        "itSkills": [{"text": "Python", "label": "Python", "category": "Programming"}],
        "softSkills": [],
    },
    "skillTags": [{"text": "Python", "label": "requirement_IT Skill", "category": None}],
    "score": 0.91,
    "highlights": {},
}


def test_hr4u_job_schema_strips_fulltext_html_and_tolerates_sparse_fields() -> None:
    job = Hr4uJob.model_validate(SAMPLE_JOB)

    assert job.text.title == "Senior Python Engineer"
    assert job.text.fulltext == "Build Python services."
    assert job.text.benefits == []
    assert job.counterpart is not None
    assert job.counterpart.email == ""
    assert job.addresses[0].place == "Berlin"
    assert job.classifications.itSkills[0].text == "Python"


def test_build_search_body_includes_supported_sections() -> None:
    body = build_search_body(
        queries=[
            {
                "type": "single",
                "phrase": "Python",
                "fields": ["text.title", "text.fulltext"],
                "queryType": "must",
            }
        ],
        filters=[{"type": "text", "field": "classifications.employmentTypes", "is": "FULL_TIME"}],
        aggregations=["employmentTypes", "sources"],
        highlighting={"fields": ["text.title"], "preTag": "<mark>", "postTag": "</mark>"},
        sort={"field": "text.title", "order": "ASC"},
        page=1,
        size=5,
    )

    assert body["queries"][0]["phrase"] == "Python"
    assert body["filters"][0]["type"] == "text"
    assert body["aggregations"] == ["employmentTypes", "sources"]
    assert body["page"] == 1
    assert body["size"] == 5


def test_hr4u_client_parses_mocked_endpoints_and_maps_404_to_expired() -> None:
    requests: list[httpx.Request] = []

    def handler(request: httpx.Request) -> httpx.Response:
        requests.append(request)
        assert request.headers["Authorization"] == "raw-token"

        if request.url.path == "/autocomplete":
            return httpx.Response(200, json=[SAMPLE_JOB])
        if request.url.path == "/search":
            return httpx.Response(
                200,
                json={"aggregations": {"employmentTypes": []}, "hits": 1, "jobs": [SAMPLE_JOB], "page": 1},
            )
        if request.url.path == f"/jobs/{SAMPLE_JOB['uuid']}":
            return httpx.Response(200, json=SAMPLE_JOB)
        if request.url.path == "/jobs/expired":
            return httpx.Response(404, json={"error": "not found"})
        return httpx.Response(500)

    async def run_client() -> None:
        async with httpx.AsyncClient(transport=httpx.MockTransport(handler)) as mock_http:
            client = Hr4uClient(
                Settings(HR4U_BASE_URL="https://hr4u.test", HR4U_TOKEN="raw-token"),
                client=mock_http,
            )
            autocomplete = await client.autocomplete("Python", size=1)
            search = await client.search(build_search_body(queries=[{"type": "single", "phrase": "Python"}], size=1))
            detail = await client.job_detail(SAMPLE_JOB["uuid"])
            expired = await client.job_detail("expired")

        assert autocomplete[0].text.fulltext == "Build Python services."
        assert search.hits == 1
        assert search.jobs[0].text.requirements == ["Python", "Distributed systems"]
        assert detail.status == "found"
        assert detail.job is not None
        assert expired.status == "expired"
        assert expired.job is None

    asyncio.run(run_client())
    assert [request.url.path for request in requests] == [
        "/autocomplete",
        "/search",
        f"/jobs/{SAMPLE_JOB['uuid']}",
        "/jobs/expired",
    ]


@pytest.mark.skipif(
    os.environ.get("RUN_LIVE_HR4U_TESTS") != "1",
    reason="Set RUN_LIVE_HR4U_TESTS=1 to call the live HR4U API.",
)
def test_live_hr4u_client_smoke() -> None:
    settings = Settings()
    if not settings.hr4u_base_url or not settings.hr4u_token:
        pytest.skip("HR4U_BASE_URL and HR4U_TOKEN are required for the live smoke test.")

    async def run_client() -> None:
        async with Hr4uClient(settings) as client:
            autocomplete = await client.autocomplete("Python", size=1)
            search = await client.search(
                build_search_body(
                    queries=[
                        {
                            "autocomplete": False,
                            "fields": ["text.title", "text.fulltext", "company"],
                            "phrase": "Python",
                            "queryType": "must",
                            "type": "single",
                        }
                    ],
                    aggregations=["employmentTypes"],
                    page=1,
                    size=1,
                )
            )
            if search.jobs:
                detail = await client.job_detail(search.jobs[0].uuid)
                assert detail.status == "found"

        assert autocomplete
        assert search.hits >= 0

    asyncio.run(run_client())
