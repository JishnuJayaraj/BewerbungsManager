from __future__ import annotations

import uuid
from datetime import date

from pydantic import BaseModel, Field

from app.models import WorkPermitStatus, default_package_items


class PackageChecklistRequest(BaseModel):
    salary_expectation: str | None = None
    earliest_start_date: date | None = None
    language_level_required: str | None = None
    language_level_user: str | None = None
    work_permit_status: WorkPermitStatus = WorkPermitStatus.UNKNOWN
    certificates_ready: bool = False
    cover_letter_required: bool = False
    items: dict[str, bool] = Field(default_factory=default_package_items)
    notes: str | None = None


class PackageChecklistResponse(PackageChecklistRequest):
    id: uuid.UUID
    application_id: uuid.UUID
