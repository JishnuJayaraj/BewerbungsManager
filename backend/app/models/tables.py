from __future__ import annotations

import uuid
from datetime import date, datetime, timezone
from enum import StrEnum
from typing import Any

from sqlalchemy import Column, UniqueConstraint
from sqlalchemy import Enum as SAEnum
from sqlalchemy import JSON
from sqlmodel import Field, SQLModel

LOCAL_USER_ID = uuid.UUID("00000000-0000-4000-8000-000000000001")
LOCAL_USER_EMAIL = "local@jobcraft.local"


def utc_now() -> datetime:
    return datetime.now(timezone.utc)


def default_package_items() -> dict[str, bool]:
    return {
        "cv_reviewed": False,
        "cover_letter": False,
        "requirements_checked": False,
        "salary_set": False,
        "start_date_set": False,
        "language_ok": False,
        "work_permit_ok": False,
        "certificates": False,
        "portal_answers": False,
        "submitted": False,
        "followup_set": False,
    }


class SkillKind(StrEnum):
    IT_SKILL = "IT_SKILL"
    SOFT_SKILL = "SOFT_SKILL"
    LANGUAGE = "LANGUAGE"
    CERT = "CERT"


class ProfileEntrySource(StrEnum):
    CV = "CV"
    MANUAL = "MANUAL"


class ApplicationStatus(StrEnum):
    SAVED = "SAVED"
    APPLIED = "APPLIED"
    INTERVIEW = "INTERVIEW"
    OFFER = "OFFER"
    REJECTED = "REJECTED"
    GHOSTED = "GHOSTED"
    CLOSED = "CLOSED"


class BriefLanguage(StrEnum):
    DE = "DE"
    EN = "EN"


class ArtifactKind(StrEnum):
    COVER_LETTER = "COVER_LETTER"
    CV_BULLET_SUGGESTIONS = "CV_BULLET_SUGGESTIONS"
    FIT_ANALYSIS = "FIT_ANALYSIS"
    PORTAL_ANSWER = "PORTAL_ANSWER"
    ANSWER_DRAFT = "ANSWER_DRAFT"


class RequirementStatus(StrEnum):
    HAVE = "HAVE"
    PARTIAL = "PARTIAL"
    MISSING = "MISSING"


class WorkPermitStatus(StrEnum):
    NOT_RELEVANT = "NOT_RELEVANT"
    EU_CITIZEN = "EU_CITIZEN"
    HAVE_PERMIT = "HAVE_PERMIT"
    NEED_SPONSORSHIP = "NEED_SPONSORSHIP"
    UNKNOWN = "UNKNOWN"


class CommsKind(StrEnum):
    EMAIL = "EMAIL"
    CALL = "CALL"
    NOTE = "NOTE"
    EVENT = "EVENT"


class CommsDirection(StrEnum):
    INBOUND = "INBOUND"
    OUTBOUND = "OUTBOUND"
    NONE = "NONE"


class User(SQLModel, table=True):
    __tablename__ = "users"

    id: uuid.UUID = Field(default_factory=uuid.uuid4, primary_key=True)
    email: str | None = Field(default=None, index=True)
    created_at: datetime = Field(default_factory=utc_now)


class Profile(SQLModel, table=True):
    __tablename__ = "profiles"
    __table_args__ = (UniqueConstraint("user_id", name="uq_profiles_user_id"),)

    id: uuid.UUID = Field(default_factory=uuid.uuid4, primary_key=True)
    user_id: uuid.UUID = Field(foreign_key="users.id", index=True)
    full_name: str | None = None
    headline: str | None = None
    seniority: str | None = None
    years_exp: int | None = None
    summary: str | None = None
    locations: list[dict[str, Any]] = Field(
        default_factory=list,
        sa_column=Column(JSON, nullable=False),
    )
    preferences: dict[str, Any] = Field(
        default_factory=dict,
        sa_column=Column(JSON, nullable=False),
    )
    brief_defaults: dict[str, Any] = Field(
        default_factory=dict,
        sa_column=Column(JSON, nullable=False),
    )
    links: list[dict[str, Any]] = Field(
        default_factory=list,
        sa_column=Column(JSON, nullable=False),
    )
    raw_cv_text: str | None = None
    updated_at: datetime = Field(default_factory=utc_now)


class Skill(SQLModel, table=True):
    __tablename__ = "skills"

    id: uuid.UUID = Field(default_factory=uuid.uuid4, primary_key=True)
    user_id: uuid.UUID = Field(foreign_key="users.id", index=True)
    profile_id: uuid.UUID = Field(foreign_key="profiles.id", index=True)
    name: str = Field(index=True)
    kind: SkillKind = Field(sa_column=Column(SAEnum(SkillKind), nullable=False))
    level: str | None = None
    source: ProfileEntrySource = Field(
        default=ProfileEntrySource.MANUAL,
        sa_column=Column(SAEnum(ProfileEntrySource), nullable=False),
    )


class Experience(SQLModel, table=True):
    __tablename__ = "experiences"

    id: uuid.UUID = Field(default_factory=uuid.uuid4, primary_key=True)
    user_id: uuid.UUID = Field(foreign_key="users.id", index=True)
    profile_id: uuid.UUID = Field(foreign_key="profiles.id", index=True)
    title: str
    company: str | None = None
    start: date | None = None
    end: date | None = None
    is_current: bool = False
    summary: str | None = None
    bullets: list[str] = Field(default_factory=list, sa_column=Column(JSON, nullable=False))
    tech: list[str] = Field(default_factory=list, sa_column=Column(JSON, nullable=False))


class Project(SQLModel, table=True):
    __tablename__ = "projects"

    id: uuid.UUID = Field(default_factory=uuid.uuid4, primary_key=True)
    user_id: uuid.UUID = Field(foreign_key="users.id", index=True)
    profile_id: uuid.UUID = Field(foreign_key="profiles.id", index=True)
    name: str
    role: str | None = None
    summary: str | None = None
    tech: list[str] = Field(default_factory=list, sa_column=Column(JSON, nullable=False))
    links: list[str] = Field(default_factory=list, sa_column=Column(JSON, nullable=False))


class Education(SQLModel, table=True):
    __tablename__ = "education"

    id: uuid.UUID = Field(default_factory=uuid.uuid4, primary_key=True)
    user_id: uuid.UUID = Field(foreign_key="users.id", index=True)
    profile_id: uuid.UUID = Field(foreign_key="profiles.id", index=True)
    degree: str
    institution: str | None = None
    field_of_study: str | None = None
    start: date | None = None
    end: date | None = None
    grade: str | None = None
    summary: str | None = None


class Application(SQLModel, table=True):
    __tablename__ = "applications"
    __table_args__ = (UniqueConstraint("user_id", "job_uuid", name="uq_applications_user_job"),)

    id: uuid.UUID = Field(default_factory=uuid.uuid4, primary_key=True)
    user_id: uuid.UUID = Field(foreign_key="users.id", index=True)
    job_uuid: str = Field(index=True)
    job_snapshot: dict[str, Any] = Field(default_factory=dict, sa_column=Column(JSON, nullable=False))
    job_title: str
    company: str | None = None
    status: ApplicationStatus = Field(
        default=ApplicationStatus.SAVED,
        sa_column=Column(SAEnum(ApplicationStatus), nullable=False),
    )
    board_order: int = 0
    contact: dict[str, Any] = Field(default_factory=dict, sa_column=Column(JSON, nullable=False))
    next_action: str | None = None
    followup_date: date | None = None
    needs_followup: bool = False
    applied_at: datetime | None = None
    created_at: datetime = Field(default_factory=utc_now)
    updated_at: datetime = Field(default_factory=utc_now)


class ApplicationBrief(SQLModel, table=True):
    __tablename__ = "application_briefs"
    __table_args__ = (
        UniqueConstraint("application_id", name="uq_application_briefs_application_id"),
    )

    id: uuid.UUID = Field(default_factory=uuid.uuid4, primary_key=True)
    user_id: uuid.UUID = Field(foreign_key="users.id", index=True)
    application_id: uuid.UUID = Field(foreign_key="applications.id", index=True)
    target_angle: str | None = None
    emphasize: dict[str, Any] = Field(default_factory=dict, sa_column=Column(JSON, nullable=False))
    avoid: str | None = None
    tone: str | None = None
    language: BriefLanguage = Field(
        default=BriefLanguage.EN,
        sa_column=Column(SAEnum(BriefLanguage), nullable=False),
    )
    company_motivation: str | None = None
    user_notes: str | None = None
    created_at: datetime = Field(default_factory=utc_now)
    updated_at: datetime = Field(default_factory=utc_now)


class GeneratedArtifact(SQLModel, table=True):
    __tablename__ = "generated_artifacts"

    id: uuid.UUID = Field(default_factory=uuid.uuid4, primary_key=True)
    user_id: uuid.UUID = Field(foreign_key="users.id", index=True)
    application_id: uuid.UUID = Field(foreign_key="applications.id", index=True)
    kind: ArtifactKind = Field(sa_column=Column(SAEnum(ArtifactKind), nullable=False))
    content: Any = Field(default=None, sa_column=Column(JSON, nullable=True))
    citations: Any = Field(default_factory=list, sa_column=Column(JSON, nullable=False))
    has_unsupported: bool = False
    inputs_snapshot: dict[str, Any] = Field(
        default_factory=dict,
        sa_column=Column(JSON, nullable=False),
    )
    model_used: str | None = None
    is_current: bool = True
    created_at: datetime = Field(default_factory=utc_now)


class RequirementCheck(SQLModel, table=True):
    __tablename__ = "requirement_checks"

    id: uuid.UUID = Field(default_factory=uuid.uuid4, primary_key=True)
    user_id: uuid.UUID = Field(foreign_key="users.id", index=True)
    application_id: uuid.UUID = Field(foreign_key="applications.id", index=True)
    requirement: str
    status: RequirementStatus = Field(sa_column=Column(SAEnum(RequirementStatus), nullable=False))
    evidence: list[str] = Field(default_factory=list, sa_column=Column(JSON, nullable=False))
    user_override: RequirementStatus | None = Field(
        default=None,
        sa_column=Column(SAEnum(RequirementStatus), nullable=True),
    )


class PackageChecklist(SQLModel, table=True):
    __tablename__ = "package_checklists"
    __table_args__ = (
        UniqueConstraint("application_id", name="uq_package_checklists_application_id"),
    )

    id: uuid.UUID = Field(default_factory=uuid.uuid4, primary_key=True)
    user_id: uuid.UUID = Field(foreign_key="users.id", index=True)
    application_id: uuid.UUID = Field(foreign_key="applications.id", index=True)
    salary_expectation: str | None = None
    earliest_start_date: date | None = None
    language_level_required: str | None = None
    language_level_user: str | None = None
    work_permit_status: WorkPermitStatus = Field(
        default=WorkPermitStatus.UNKNOWN,
        sa_column=Column(SAEnum(WorkPermitStatus), nullable=False),
    )
    certificates_ready: bool = False
    cover_letter_required: bool = False
    items: dict[str, bool] = Field(
        default_factory=default_package_items,
        sa_column=Column(JSON, nullable=False),
    )
    notes: str | None = None


class CommsLogEntry(SQLModel, table=True):
    __tablename__ = "comms_log_entries"

    id: uuid.UUID = Field(default_factory=uuid.uuid4, primary_key=True)
    user_id: uuid.UUID = Field(foreign_key="users.id", index=True)
    application_id: uuid.UUID = Field(foreign_key="applications.id", index=True)
    kind: CommsKind = Field(sa_column=Column(SAEnum(CommsKind), nullable=False))
    occurred_at: datetime = Field(default_factory=utc_now)
    subject: str | None = None
    body: str
    direction: CommsDirection = Field(
        default=CommsDirection.NONE,
        sa_column=Column(SAEnum(CommsDirection), nullable=False),
    )
    created_at: datetime = Field(default_factory=utc_now)


class SearchPreset(SQLModel, table=True):
    __tablename__ = "search_presets"

    id: uuid.UUID = Field(default_factory=uuid.uuid4, primary_key=True)
    user_id: uuid.UUID = Field(foreign_key="users.id", index=True)
    name: str
    query_json: dict[str, Any] = Field(default_factory=dict, sa_column=Column(JSON, nullable=False))
    created_at: datetime = Field(default_factory=utc_now)
