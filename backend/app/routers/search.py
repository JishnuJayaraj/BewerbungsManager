from __future__ import annotations

import uuid
from collections.abc import Iterable
from typing import Any

from fastapi import APIRouter, Depends, HTTPException, Query, Response, status
from sqlmodel import Session, func, select

from app.db import get_session, seed_local_user
from app.models import SearchPreset
from app.schemas.hr4u import Hr4uJob, Hr4uSearchResponse, SearchBody
from app.schemas.search import (
    AutocompleteSuggestion,
    BasicSearchRequest,
    SearchPresetCreate,
    SearchPresetListResponse,
    SearchPresetResponse,
    SearchResponse,
    JobSummary,
)
from app.services.hr4u import Hr4uClient, Hr4uClientError, build_search_body

router = APIRouter(prefix="/api/search", tags=["search"])

BASIC_SEARCH_FIELDS = ["text.title", "company"]
DEFAULT_AGGREGATIONS = ["employmentTypes", "jobTypes", "occupationAreas", "sources"]


async def get_hr4u_client() -> Hr4uClient:
    async with Hr4uClient() as client:
        yield client


@router.get("/autocomplete", response_model=list[AutocompleteSuggestion])
async def autocomplete(
    phrase: str = Query(min_length=1),
    size: int = Query(default=10, ge=1, le=50),
    client: Hr4uClient = Depends(get_hr4u_client),
) -> list[AutocompleteSuggestion]:
    try:
        jobs = await client.autocomplete(phrase, size=size)
    except Hr4uClientError as exc:
        raise _upstream_error(exc) from exc
    return [AutocompleteSuggestion.from_hr4u(job) for job in jobs]


@router.post("/basic", response_model=SearchResponse)
async def basic_search(
    request: BasicSearchRequest,
    client: Hr4uClient = Depends(get_hr4u_client),
) -> SearchResponse:
    body = build_basic_search_body(request)
    return await _search(client, body)


@router.post("/advanced", response_model=SearchResponse)
async def advanced_search(
    body: SearchBody,
    client: Hr4uClient = Depends(get_hr4u_client),
) -> SearchResponse:
    return await _search(client, body)


@router.get("/presets", response_model=SearchPresetListResponse)
def list_presets(
    session: Session = Depends(get_session),
    page: int = Query(default=1, ge=1),
    size: int = Query(default=50, ge=1, le=100),
) -> SearchPresetListResponse:
    user = seed_local_user(session)
    total_statement = select(func.count()).select_from(SearchPreset).where(SearchPreset.user_id == user.id)
    total = session.exec(total_statement).one()
    statement = (
        select(SearchPreset)
        .where(SearchPreset.user_id == user.id)
        .order_by(SearchPreset.created_at.desc())
        .offset((page - 1) * size)
        .limit(size)
    )
    presets = session.exec(statement).all()
    return SearchPresetListResponse(
        items=[_preset_response(preset) for preset in presets],
        page=page,
        total=total,
    )


@router.post("/presets", response_model=SearchPresetResponse, status_code=status.HTTP_201_CREATED)
def create_preset(
    request: SearchPresetCreate,
    session: Session = Depends(get_session),
) -> SearchPresetResponse:
    user = seed_local_user(session)
    preset = SearchPreset(user_id=user.id, name=request.name, query_json=request.query_json)
    session.add(preset)
    session.commit()
    session.refresh(preset)
    return _preset_response(preset)


@router.get("/presets/{preset_id}", response_model=SearchPresetResponse)
def get_preset(
    preset_id: uuid.UUID,
    session: Session = Depends(get_session),
) -> SearchPresetResponse:
    user = seed_local_user(session)
    preset = _get_user_preset(session, user.id, preset_id)
    return _preset_response(preset)


@router.delete("/presets/{preset_id}", status_code=status.HTTP_204_NO_CONTENT, response_class=Response)
def delete_preset(
    preset_id: uuid.UUID,
    session: Session = Depends(get_session),
) -> Response:
    user = seed_local_user(session)
    preset = _get_user_preset(session, user.id, preset_id)
    session.delete(preset)
    session.commit()
    return Response(status_code=status.HTTP_204_NO_CONTENT)


def build_basic_search_body(request: BasicSearchRequest) -> SearchBody:
    queries: list[dict[str, Any]] = []
    phrase = request.phrase.strip() if request.phrase else ""
    if phrase:
        queries.append(
            {
                "autocomplete": False,
                "fields": BASIC_SEARCH_FIELDS,
                "phrase": phrase,
                "queryType": "must",
                "type": "single",
            }
        )

    filters: list[dict[str, Any]] = []
    if request.location is not None:
        filters.append(
            {
                "type": "distance",
                "lat": request.location.lat,
                "lon": request.location.lon,
                "distance": request.location.radius_km,
            }
        )
    if request.job_types:
        filters.append(
            {
                "type": "text",
                "field": "classifications.jobTypes",
                "in": request.job_types,
            }
        )
    if request.employment_types:
        filters.append(
            {
                "type": "text",
                "field": "classifications.employmentTypes",
                "in": request.employment_types,
            }
        )

    return build_search_body(
        queries=queries,
        filters=filters,
        aggregations=DEFAULT_AGGREGATIONS,
        page=request.page,
        size=request.size,
    )


async def _search(client: Hr4uClient, body: SearchBody) -> SearchResponse:
    try:
        upstream = await client.search(body)
    except Hr4uClientError as exc:
        raise _upstream_error(exc) from exc
    deduped_jobs, deduped_count = dedupe_jobs(upstream.jobs)
    return _search_response(upstream, deduped_jobs, deduped_count)


def dedupe_jobs(jobs: Iterable[Hr4uJob]) -> tuple[list[Hr4uJob], int]:
    seen: set[str] = set()
    deduped: list[Hr4uJob] = []
    dropped = 0
    for job in jobs:
        key = job.uuid or job.link
        if key in seen:
            dropped += 1
            continue
        seen.add(key)
        deduped.append(job)
    return deduped, dropped


def _search_response(
    upstream: Hr4uSearchResponse,
    jobs: list[Hr4uJob],
    deduped_count: int,
) -> SearchResponse:
    return SearchResponse(
        hits=upstream.hits,
        page=upstream.page or 1,
        jobs=[JobSummary.from_hr4u(job) for job in jobs],
        aggregations=upstream.aggregations,
        deduped=deduped_count,
    )


def _preset_response(preset: SearchPreset) -> SearchPresetResponse:
    return SearchPresetResponse(
        id=preset.id,
        name=preset.name,
        query_json=preset.query_json,
        created_at=preset.created_at,
    )


def _get_user_preset(session: Session, user_id: uuid.UUID, preset_id: uuid.UUID) -> SearchPreset:
    statement = select(SearchPreset).where(SearchPreset.user_id == user_id, SearchPreset.id == preset_id)
    preset = session.exec(statement).first()
    if preset is None:
        raise HTTPException(status_code=404, detail="Search preset not found")
    return preset


def _upstream_error(exc: Hr4uClientError) -> HTTPException:
    return HTTPException(
        status_code=502,
        detail={
            "code": "upstream_hr4u_error",
            "message": "HR4U request failed",
            "details": {"status_code": exc.status_code},
        },
    )
