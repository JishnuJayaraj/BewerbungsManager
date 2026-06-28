from __future__ import annotations

import uuid
from typing import Any, Literal

from pydantic import BaseModel, Field, model_validator

CitationStatus = Literal["SUPPORTED", "UNSUPPORTED"]


class CitationClaim(BaseModel):
    claim: str = ""
    evidence_ref: str | None = None

    @model_validator(mode="before")
    @classmethod
    def _coerce(cls, data: Any) -> Any:
        if isinstance(data, str):
            return {"claim": data}
        if isinstance(data, dict) and not data.get("claim"):
            # models often use "text"/"statement"/"content" instead of "claim"
            return {**data, "claim": data.get("text") or data.get("statement") or data.get("content") or ""}
        return data


class CitationEvidence(BaseModel):
    skill_ids: set[uuid.UUID] = Field(default_factory=set)
    experience_ids: set[uuid.UUID] = Field(default_factory=set)
    project_ids: set[uuid.UUID] = Field(default_factory=set)
    job_fields: set[str] = Field(default_factory=set)


class VerifiedCitation(BaseModel):
    claim: str
    evidence_ref: str | None
    status: CitationStatus


class CitationVerificationResult(BaseModel):
    citations: list[VerifiedCitation]
    has_unsupported: bool


def verify_citations(
    claims: list[CitationClaim] | list[dict[str, str | None]],
    evidence: CitationEvidence,
) -> CitationVerificationResult:
    verified = [
        VerifiedCitation(
            claim=claim.claim,
            evidence_ref=claim.evidence_ref,
            status="SUPPORTED" if is_supported_ref(claim.evidence_ref, evidence) else "UNSUPPORTED",
        )
        for claim in [CitationClaim.model_validate(item) for item in claims]
    ]
    return CitationVerificationResult(
        citations=verified,
        has_unsupported=any(citation.status == "UNSUPPORTED" for citation in verified),
    )


def is_supported_ref(evidence_ref: str | None, evidence: CitationEvidence) -> bool:
    if not evidence_ref or evidence_ref == "UNSUPPORTED" or ":" not in evidence_ref:
        return False

    source_type, raw_id = evidence_ref.split(":", 1)
    if not raw_id:
        return False

    match source_type:
        case "skill":
            return _uuid_in(raw_id, evidence.skill_ids)
        case "experience":
            return _uuid_in(raw_id, evidence.experience_ids)
        case "project":
            return _uuid_in(raw_id, evidence.project_ids)
        case "job":
            return raw_id in evidence.job_fields
        case _:
            return False


def _uuid_in(raw_value: str, values: set[uuid.UUID]) -> bool:
    try:
        parsed = uuid.UUID(raw_value)
    except ValueError:
        return False
    return parsed in values
