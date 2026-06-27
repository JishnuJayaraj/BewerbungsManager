from __future__ import annotations

import uuid
from datetime import datetime
from typing import Any

from pydantic import BaseModel, Field

from app.schemas.hr4u import Hr4uJob


class LocationFilter(BaseModel):
    lat: float
    lon: float
    radius_km: float = Field(gt=0)


class BasicSearchRequest(BaseModel):
    phrase: str | None = None
    location: LocationFilter | None = None
    places: list[str] = Field(default_factory=list)  # free-text city names (any of)
    job_types: list[str] = Field(default_factory=list)
    employment_types: list[str] = Field(default_factory=list)
    contract_types: list[str] = Field(default_factory=list)  # PERMANENT / TEMPORARY
    posted_within_days: int | None = Field(default=None, ge=1, le=365)
    page: int = Field(default=1, ge=1)
    size: int = Field(default=20, ge=1, le=100)


class JobSummary(BaseModel):
    uuid: str
    title: str | None = None
    company: str | None = None
    place: str | None = None
    employment_types: list[str] = Field(default_factory=list)
    job_types: list[str] = Field(default_factory=list)
    date_from: str | None = None
    score: float | None = None
    highlights: dict[str, Any] = Field(default_factory=dict)

    @classmethod
    def from_hr4u(cls, job: Hr4uJob) -> "JobSummary":
        first_address = job.addresses[0] if job.addresses else None
        return cls(
            uuid=job.uuid,
            title=job.text.title,
            company=job.companyCleaned or job.company,
            place=first_address.place if first_address else None,
            employment_types=job.classifications.employmentTypes,
            job_types=job.classifications.jobTypes,
            date_from=job.period.dateFrom if job.period else None,
            score=job.score,
            highlights=job.highlights,
        )


class SearchResponse(BaseModel):
    hits: int
    page: int
    jobs: list[JobSummary]
    aggregations: dict[str, Any] = Field(default_factory=dict)
    deduped: int


class AutocompleteSuggestion(BaseModel):
    uuid: str
    title: str | None = None
    company: str | None = None

    @classmethod
    def from_hr4u(cls, job: Hr4uJob) -> "AutocompleteSuggestion":
        return cls(uuid=job.uuid, title=job.text.title, company=job.companyCleaned or job.company)


class SearchPresetCreate(BaseModel):
    name: str = Field(min_length=1)
    query_json: dict[str, Any]


class SearchPresetResponse(BaseModel):
    id: uuid.UUID
    name: str
    query_json: dict[str, Any]
    created_at: datetime


class SearchPresetListResponse(BaseModel):
    items: list[SearchPresetResponse]
    page: int
    total: int
