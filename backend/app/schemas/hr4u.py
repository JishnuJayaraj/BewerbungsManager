from __future__ import annotations

import re
from html import unescape
from typing import Any, Literal

from pydantic import BaseModel, ConfigDict, Field, field_validator

TAG_RE = re.compile(r"<[^>]+>")
WHITESPACE_RE = re.compile(r"\s+")


def strip_html(value: Any) -> Any:
    if not isinstance(value, str):
        return value
    without_tags = TAG_RE.sub(" ", value)
    return WHITESPACE_RE.sub(" ", unescape(without_tags)).strip()


class Hr4uBaseModel(BaseModel):
    model_config = ConfigDict(extra="allow")


class Hr4uCoordinates(Hr4uBaseModel):
    lat: float | None = None
    lon: float | None = None


class Hr4uAddress(Hr4uBaseModel):
    place: str | None = None
    country: str | None = None
    county: str | None = None
    zipCode: str | None = None
    street: str | None = None
    streetNumber: str | None = None
    coordinates: Hr4uCoordinates | None = None


class Hr4uCounterpart(Hr4uBaseModel):
    firstName: str | None = None
    lastName: str | None = None
    role: str | None = None
    department: str | None = None
    phone: str | None = None
    fax: str | None = None
    email: str | None = None
    address: Hr4uAddress | None = None


class Hr4uText(Hr4uBaseModel):
    title: str | None = None
    titleCleaned: str | None = None
    fulltext: str | None = None
    company: str | None = None
    tasks: list[str] = Field(default_factory=list)
    requirements: list[str] = Field(default_factory=list)
    benefits: list[str] = Field(default_factory=list)
    closing: str | None = None

    @field_validator("fulltext", mode="before")
    @classmethod
    def clean_fulltext(cls, value: Any) -> Any:
        return strip_html(value)


class Hr4uPeriod(Hr4uBaseModel):
    dateFrom: str | None = None
    dateTo: str | None = None


class Hr4uTag(Hr4uBaseModel):
    text: str | None = None
    label: str | None = None
    category: str | None = None


class Hr4uTaxonomyJobTitle(Hr4uBaseModel):
    text: str | None = None
    label: str | None = None
    category: str | None = None


class Hr4uClassifications(Hr4uBaseModel):
    companyType: str | None = None
    contractTypes: list[str] = Field(default_factory=list)
    employmentTypes: list[str] = Field(default_factory=list)
    jobTypes: list[str] = Field(default_factory=list)
    occupationAreas: list[str] = Field(default_factory=list)
    werNERTags: list[Hr4uTag] = Field(default_factory=list)
    experienceLevel: str | None = None
    taxonomyJobTitle: Hr4uTaxonomyJobTitle | None = None
    itSkills: list[Hr4uTag] = Field(default_factory=list)
    softSkills: list[Hr4uTag] = Field(default_factory=list)


class Hr4uJob(Hr4uBaseModel):
    uuid: str
    link: str | None = None
    company: str | None = None
    companyCleaned: str | None = None
    text: Hr4uText = Field(default_factory=Hr4uText)
    period: Hr4uPeriod | None = None
    addresses: list[Hr4uAddress] = Field(default_factory=list)
    counterpart: Hr4uCounterpart | None = None
    classifications: Hr4uClassifications = Field(default_factory=Hr4uClassifications)
    skillTags: list[Hr4uTag] = Field(default_factory=list)
    score: float | None = None
    highlights: dict[str, Any] = Field(default_factory=dict)


class Hr4uSearchResponse(Hr4uBaseModel):
    aggregations: dict[str, Any] = Field(default_factory=dict)
    hits: int = 0
    jobs: list[Hr4uJob] = Field(default_factory=list)
    page: int | None = None


class Hr4uJobDetailResult(BaseModel):
    status: Literal["found", "expired"]
    uuid: str
    job: Hr4uJob | None = None

    @classmethod
    def found(cls, job: Hr4uJob) -> "Hr4uJobDetailResult":
        return cls(status="found", uuid=job.uuid, job=job)

    @classmethod
    def expired(cls, uuid: str) -> "Hr4uJobDetailResult":
        return cls(status="expired", uuid=uuid, job=None)


SearchBody = dict[str, Any]
