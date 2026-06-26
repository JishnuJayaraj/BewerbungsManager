from __future__ import annotations

import uuid
from datetime import date
from typing import Any

from pydantic import BaseModel, Field

from app.models import ProfileEntrySource, SkillKind


class CvParseRequest(BaseModel):
    cv_text: str = Field(min_length=1)


class SkillInput(BaseModel):
    name: str = Field(min_length=1)
    kind: SkillKind
    level: str | None = None
    source: ProfileEntrySource = ProfileEntrySource.MANUAL


class SkillUpdate(BaseModel):
    name: str | None = None
    kind: SkillKind | None = None
    level: str | None = None
    source: ProfileEntrySource | None = None


class SkillResponse(BaseModel):
    id: uuid.UUID
    name: str
    kind: SkillKind
    level: str | None
    source: ProfileEntrySource


class ExperienceInput(BaseModel):
    title: str = Field(min_length=1)
    company: str | None = None
    start: str | None = None
    end: str | None = None
    is_current: bool = False
    summary: str | None = None
    bullets: list[str] = Field(default_factory=list)
    tech: list[str] = Field(default_factory=list)


class ExperienceUpdate(BaseModel):
    title: str | None = None
    company: str | None = None
    start: str | None = None
    end: str | None = None
    is_current: bool | None = None
    summary: str | None = None
    bullets: list[str] | None = None
    tech: list[str] | None = None


class ExperienceResponse(BaseModel):
    id: uuid.UUID
    title: str
    company: str | None
    start: str | None
    end: str | None
    is_current: bool
    summary: str | None
    bullets: list[str]
    tech: list[str]


class ProjectInput(BaseModel):
    name: str = Field(min_length=1)
    role: str | None = None
    summary: str | None = None
    tech: list[str] = Field(default_factory=list)
    links: list[str] = Field(default_factory=list)


class ProjectUpdate(BaseModel):
    name: str | None = None
    role: str | None = None
    summary: str | None = None
    tech: list[str] | None = None
    links: list[str] | None = None


class ProjectResponse(BaseModel):
    id: uuid.UUID
    name: str
    role: str | None
    summary: str | None
    tech: list[str]
    links: list[str]


class ProfileUpdate(BaseModel):
    full_name: str | None = None
    headline: str | None = None
    seniority: str | None = None
    years_exp: int | None = None
    summary: str | None = None
    locations: list[dict[str, Any]] | None = None
    preferences: dict[str, Any] | None = None
    brief_defaults: dict[str, Any] | None = None


class ProfileResponse(BaseModel):
    id: uuid.UUID
    full_name: str | None
    headline: str | None
    seniority: str | None
    years_exp: int | None
    summary: str | None
    locations: list[dict[str, Any]]
    preferences: dict[str, Any]
    brief_defaults: dict[str, Any]
    skills: list[SkillResponse]
    experiences: list[ExperienceResponse]
    projects: list[ProjectResponse]
    parse_warning: str | None = None


class CvParsedSkill(BaseModel):
    name: str
    kind: SkillKind
    level: str | None = None


class CvParsedExperience(BaseModel):
    title: str
    company: str | None = None
    start: str | None = None
    end: str | None = None
    is_current: bool = False
    summary: str | None = None
    bullets: list[str] = Field(default_factory=list)
    tech: list[str] = Field(default_factory=list)


class CvParsedProject(BaseModel):
    name: str
    role: str | None = None
    summary: str | None = None
    tech: list[str] = Field(default_factory=list)
    links: list[str] = Field(default_factory=list)


class CvParseResult(BaseModel):
    full_name: str | None = None
    headline: str | None = None
    seniority: str | None = None
    years_exp: int | None = None
    summary: str | None = None
    locations: list[dict[str, Any]] = Field(default_factory=list)
    skills: list[CvParsedSkill] = Field(default_factory=list)
    experiences: list[CvParsedExperience] = Field(default_factory=list)
    projects: list[CvParsedProject] = Field(default_factory=list)


def parse_profile_date(value: str | None) -> date | None:
    if not value:
        return None
    parts = value.split("-")
    if len(parts) == 2:
        return date(int(parts[0]), int(parts[1]), 1)
    return date.fromisoformat(value)


def format_profile_date(value: date | None) -> str | None:
    if value is None:
        return None
    return value.strftime("%Y-%m")
