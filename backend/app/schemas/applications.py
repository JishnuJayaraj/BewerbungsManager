from __future__ import annotations

import uuid
from datetime import date, datetime
from typing import Any

from pydantic import BaseModel, Field

from app.models import ApplicationStatus, BriefLanguage, CommsDirection, CommsKind


class ApplicationSaveRequest(BaseModel):
    job_uuid: str = Field(min_length=1)


class ApplicationPatch(BaseModel):
    status: ApplicationStatus | None = None
    board_order: int | None = None
    next_action: str | None = None
    followup_date: date | None = None
    applied_at: datetime | None = None
    needs_followup: bool | None = None
    contact: dict[str, Any] | None = None


class ApplicationResponse(BaseModel):
    id: uuid.UUID
    job_uuid: str
    job_snapshot: dict[str, Any]
    job_title: str
    company: str | None
    status: ApplicationStatus
    board_order: int
    contact: dict[str, Any]
    next_action: str | None
    followup_date: date | None
    needs_followup: bool
    applied_at: datetime | None
    created_at: datetime
    updated_at: datetime
    # Derived funnel signals
    days_since_applied: int | None = None
    gone_quiet: bool = False
    is_active: bool = True  # in the live pipeline (Saved/Applied/Interview/Offer)


class ApplicationListResponse(BaseModel):
    items: list[ApplicationResponse]
    page: int
    total: int


class ApplicationBriefRequest(BaseModel):
    target_angle: str | None = None
    emphasize: list[str] | None = None
    avoid: str | None = None
    tone: str | None = None
    language: BriefLanguage | None = None
    company_motivation: str | None = None
    user_notes: str | None = None


class ApplicationBriefResponse(BaseModel):
    id: uuid.UUID
    application_id: uuid.UUID
    target_angle: str | None
    emphasize: list[str]
    avoid: str | None
    tone: str | None
    language: BriefLanguage
    company_motivation: str | None
    user_notes: str | None
    created_at: datetime
    updated_at: datetime


class CommsLogCreate(BaseModel):
    kind: CommsKind
    occurred_at: datetime | None = None
    subject: str | None = None
    body: str
    direction: CommsDirection = CommsDirection.NONE


class CommsLogResponse(BaseModel):
    id: uuid.UUID
    application_id: uuid.UUID
    kind: CommsKind
    occurred_at: datetime
    subject: str | None
    body: str
    direction: CommsDirection
    created_at: datetime


class CommsLogListResponse(BaseModel):
    items: list[CommsLogResponse]
    page: int
    total: int
