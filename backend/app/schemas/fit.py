from __future__ import annotations

import uuid
from typing import Any, Literal

from pydantic import BaseModel, Field

from app.models import RequirementStatus


class EvidencePoint(BaseModel):
    point: str
    evidence_ref: str | None = None


class UnknownPoint(BaseModel):
    point: str


class RiskPoint(BaseModel):
    risk: str
    honest_framing: str


class FitAnalysis(BaseModel):
    summary: str
    strong_matches: list[EvidencePoint] = Field(default_factory=list)
    weak_matches: list[EvidencePoint] = Field(default_factory=list)
    unknowns: list[UnknownPoint] = Field(default_factory=list)
    suggested_angle: str | None = None
    risks_to_address: list[RiskPoint] = Field(default_factory=list)
    do_not_claim: list[str] = Field(default_factory=list)


class FitRequirement(BaseModel):
    requirement: str
    status: RequirementStatus
    evidence_ref: str | None = None


class FitLlmResult(BaseModel):
    fit: FitAnalysis
    requirements: list[FitRequirement] = Field(default_factory=list)


class RequirementCheckResponse(BaseModel):
    id: uuid.UUID
    requirement: str
    status: RequirementStatus
    evidence: list[str]
    user_override: RequirementStatus | None


class FitResponse(BaseModel):
    artifact_id: uuid.UUID
    fit: FitAnalysis
    requirements: list[RequirementCheckResponse]


class RequirementOverrideRequest(BaseModel):
    user_override: RequirementStatus | None


class FitArtifactContent(BaseModel):
    fit: FitAnalysis
    requirements: list[FitRequirement]


ClaimSource = Literal["skill", "experience", "project"]


class FitInputs(BaseModel):
    profile: dict[str, Any]
    job: dict[str, Any]
    brief: dict[str, Any] | None
