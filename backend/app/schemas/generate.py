from __future__ import annotations

import uuid
from datetime import datetime
from typing import Any, Literal

from pydantic import BaseModel, Field, model_validator

from app.models import ArtifactKind, BriefLanguage
from app.services.citations import CitationClaim, VerifiedCitation

ExportFormat = Literal["markdown", "pdf"]
GENERATABLE_ARTIFACT_KINDS = {
    ArtifactKind.COVER_LETTER,
    ArtifactKind.CV_BULLET_SUGGESTIONS,
    ArtifactKind.PORTAL_ANSWER,
}


class CoverLetterContent(BaseModel):
    language: BriefLanguage
    format: Literal["anschreiben", "plain"]
    subject: str | None = None
    body: str
    claims: list[CitationClaim] = Field(default_factory=list)


class CvBulletSuggestion(BaseModel):
    experience_ref: str
    original: str | None = None
    suggested: str
    reason: str
    evidence_ref: str | None = None


class CvBulletSuggestionsContent(BaseModel):
    suggestions: list[CvBulletSuggestion] = Field(default_factory=list, min_length=1, max_length=4)
    emphasize: list[str] = Field(default_factory=list)
    do_not_pretend: list[str] = Field(default_factory=list)


class PortalAnswerContent(BaseModel):
    question: str
    language: BriefLanguage
    answer: str
    claims: list[CitationClaim] = Field(default_factory=list)


ArtifactContent = CoverLetterContent | CvBulletSuggestionsContent | PortalAnswerContent


class GenerateInputs(BaseModel):
    profile: dict[str, Any]
    job: dict[str, Any]
    brief: dict[str, Any] | None
    do_not_claim: list[str] = Field(default_factory=list)
    portal_question: str | None = None
    instruction: str | None = None
    previous_artifact: dict[str, Any] | None = None


class GenerateRequest(BaseModel):
    kind: ArtifactKind
    instruction: str | None = None
    portal_question: str | None = None

    @model_validator(mode="after")
    def validate_portal_question(self) -> GenerateRequest:
        if self.kind not in GENERATABLE_ARTIFACT_KINDS:
            raise ValueError("kind must be COVER_LETTER, CV_BULLET_SUGGESTIONS, or PORTAL_ANSWER")
        if self.kind == ArtifactKind.PORTAL_ANSWER and not self.portal_question:
            raise ValueError("portal_question is required when kind=PORTAL_ANSWER")
        return self


class GeneratedArtifactResponse(BaseModel):
    id: uuid.UUID
    application_id: uuid.UUID
    kind: ArtifactKind
    content: Any
    citations: list[VerifiedCitation]
    has_unsupported: bool
    model_used: str | None
    is_current: bool
    created_at: datetime


class GeneratedArtifactListResponse(BaseModel):
    items: list[GeneratedArtifactResponse]
