from __future__ import annotations

import uuid
from datetime import datetime
from typing import Any, Literal

from pydantic import BaseModel, Field, field_validator, model_validator

from app.models import ArtifactKind, BriefLanguage
from app.services.citations import CitationClaim, VerifiedCitation

ExportFormat = Literal["markdown", "pdf"]


def _as_text(value: Any) -> str:
    """LLMs sometimes return a body/answer as a list of paragraphs — join to a string."""
    if isinstance(value, list):
        return "\n\n".join(str(part).strip() for part in value if part)
    return value if isinstance(value, str) else ("" if value is None else str(value))


def _as_language(value: Any) -> Any:
    text = str(value or "").strip().lower()
    if text in {"de", "german", "deutsch"}:
        return "DE"
    if text in {"en", "english", "englisch"}:
        return "EN"
    return value
GENERATABLE_ARTIFACT_KINDS = {
    ArtifactKind.COVER_LETTER,
    ArtifactKind.CV_BULLET_SUGGESTIONS,
    ArtifactKind.TAILORED_CV,
    ArtifactKind.PORTAL_ANSWER,
}


class CoverLetterContent(BaseModel):
    language: BriefLanguage = BriefLanguage.EN
    format: Literal["anschreiben", "plain"] = "plain"
    subject: str | None = None
    body: str = ""
    claims: list[CitationClaim] = Field(default_factory=list)

    @field_validator("language", mode="before")
    @classmethod
    def _lang(cls, value: Any) -> Any:
        return _as_language(value)

    @field_validator("format", mode="before")
    @classmethod
    def _fmt(cls, value: Any) -> Any:
        return value if value in ("anschreiben", "plain") else "plain"

    @field_validator("body", mode="before")
    @classmethod
    def _body(cls, value: Any) -> Any:
        return _as_text(value)


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
    question: str = ""
    language: BriefLanguage = BriefLanguage.EN
    answer: str = ""
    claims: list[CitationClaim] = Field(default_factory=list)

    @field_validator("language", mode="before")
    @classmethod
    def _lang(cls, value: Any) -> Any:
        return _as_language(value)

    @field_validator("question", "answer", mode="before")
    @classmethod
    def _text(cls, value: Any) -> Any:
        return _as_text(value)


class CvExperienceBlock(BaseModel):
    title: str = ""
    company: str | None = None
    dates: str | None = None
    bullets: list[str] = Field(default_factory=list)

    @field_validator("bullets", mode="before")
    @classmethod
    def _bullets(cls, value: Any) -> Any:
        if isinstance(value, str):
            return [value]
        if isinstance(value, list):
            return [str(item) for item in value if item]
        return []


class CvEducationBlock(BaseModel):
    degree: str = ""
    institution: str | None = None
    dates: str | None = None


class TailoredCvContent(BaseModel):
    full_name: str = ""
    headline: str | None = None
    contact: str | None = None
    summary: str = ""
    experiences: list[CvExperienceBlock] = Field(default_factory=list)
    skills: list[str] = Field(default_factory=list)
    education: list[CvEducationBlock] = Field(default_factory=list)
    languages: list[str] = Field(default_factory=list)
    claims: list[CitationClaim] = Field(default_factory=list)

    @field_validator("full_name", "summary", mode="before")
    @classmethod
    def _text(cls, value: Any) -> Any:
        return _as_text(value)

    @field_validator("skills", "languages", mode="before")
    @classmethod
    def _strlist(cls, value: Any) -> Any:
        if isinstance(value, str):
            return [value]
        if isinstance(value, list):
            return [str(item) for item in value if item]
        return []


ArtifactContent = CoverLetterContent | CvBulletSuggestionsContent | PortalAnswerContent | TailoredCvContent


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
            raise ValueError("kind must be COVER_LETTER, CV_BULLET_SUGGESTIONS, TAILORED_CV, or PORTAL_ANSWER")
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
