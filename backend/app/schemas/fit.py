from __future__ import annotations

import uuid
from typing import Any, Literal

from pydantic import BaseModel, Field, model_validator

from app.models import RequirementStatus


def _first_text(data: dict[str, Any], *keys: str) -> str:
    for key in keys:
        value = data.get(key)
        if isinstance(value, str) and value.strip():
            return value
    return ""


class EvidencePoint(BaseModel):
    point: str = ""
    evidence_ref: str | None = None

    @model_validator(mode="before")
    @classmethod
    def _coerce(cls, data: Any) -> Any:
        if isinstance(data, str):
            return {"point": data}
        if isinstance(data, dict):
            return {**data, "point": _first_text(data, "point", "item", "text", "match", "skill", "title")}
        return data


class UnknownPoint(BaseModel):
    point: str = ""

    @model_validator(mode="before")
    @classmethod
    def _coerce(cls, data: Any) -> Any:
        if isinstance(data, str):
            return {"point": data}
        if isinstance(data, dict):
            return {**data, "point": _first_text(data, "point", "item", "text", "unknown")}
        return data


class RiskPoint(BaseModel):
    risk: str = ""
    honest_framing: str = ""

    @model_validator(mode="before")
    @classmethod
    def _coerce(cls, data: Any) -> Any:
        if isinstance(data, str):
            return {"risk": data}
        if isinstance(data, dict):
            return {
                **data,
                "risk": _first_text(data, "risk", "item", "text", "point"),
                "honest_framing": _first_text(data, "honest_framing", "framing", "how", "mitigation"),
            }
        return data


class FitAnalysis(BaseModel):
    summary: str = ""
    strong_matches: list[EvidencePoint] = Field(default_factory=list)
    weak_matches: list[EvidencePoint] = Field(default_factory=list)
    unknowns: list[UnknownPoint] = Field(default_factory=list)
    suggested_angle: str | None = None
    risks_to_address: list[RiskPoint] = Field(default_factory=list)
    do_not_claim: list[str] = Field(default_factory=list)


def _normalize_status(value: Any) -> RequirementStatus:
    text = str(value or "").strip().upper()
    if text in {"HAVE", "YES", "MATCH", "STRONG", "FULL"}:
        return RequirementStatus.HAVE
    if text in {"MISSING", "NO", "NONE", "GAP", "WEAK"}:
        return RequirementStatus.MISSING
    return RequirementStatus.PARTIAL


class FitRequirement(BaseModel):
    requirement: str = ""
    status: RequirementStatus = RequirementStatus.PARTIAL
    evidence_ref: str | None = None

    @model_validator(mode="before")
    @classmethod
    def _coerce(cls, data: Any) -> Any:
        if isinstance(data, str):
            return {"requirement": data}
        if isinstance(data, dict):
            return {
                **data,
                "requirement": _first_text(data, "requirement", "item", "name", "text", "skill"),
                "status": _normalize_status(data.get("status")),
            }
        return data


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
