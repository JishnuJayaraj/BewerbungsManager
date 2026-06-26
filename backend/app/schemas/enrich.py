"""Profile enrichment: LLM asks targeted questions, answers fold back into the profile."""

from __future__ import annotations

from typing import Any, Literal

from pydantic import BaseModel, Field

from app.schemas.profile import CvParsedSkill, ProfileResponse

EnrichField = Literal["summary", "seniority", "years_exp", "target_roles", "skills", "impact", "language", "other"]


class EnrichQuestion(BaseModel):
    key: str = Field(min_length=1)
    question: str = Field(min_length=1)
    purpose: str = ""  # why this question — shown to the user as helper text
    field: EnrichField = "other"


class EnrichQuestionsResult(BaseModel):
    questions: list[EnrichQuestion] = Field(default_factory=list, max_length=8)


class EnrichInputs(BaseModel):
    profile: dict[str, Any]


class EnrichAnswer(BaseModel):
    key: str = Field(min_length=1)
    question: str = Field(min_length=1)
    answer: str = Field(min_length=1)


class EnrichApplyRequest(BaseModel):
    answers: list[EnrichAnswer] = Field(min_length=1)


class EnrichApplyInputs(BaseModel):
    profile: dict[str, Any]
    answers: list[EnrichAnswer]


class ProfileEnrichment(BaseModel):
    """The patch the LLM proposes from the user's answers. All optional."""

    headline: str | None = None
    seniority: str | None = None
    years_exp: int | None = None
    summary: str | None = None
    target_roles: list[str] = Field(default_factory=list)
    add_skills: list[CvParsedSkill] = Field(default_factory=list)
    change_summary: list[str] = Field(default_factory=list)  # human-readable bullets of what changed


class EnrichApplyResponse(BaseModel):
    profile: ProfileResponse
    changes: list[str] = Field(default_factory=list)
    added_skills: list[str] = Field(default_factory=list)
