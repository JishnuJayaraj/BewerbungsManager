"""Per-field AI improvement: polish a profile field for job-hunting impact."""

from __future__ import annotations

import uuid
from typing import Any, Literal

from pydantic import BaseModel, Field

ImproveTarget = Literal["summary", "experience_bullets"]


class ImproveRequest(BaseModel):
    target: ImproveTarget
    experience_id: uuid.UUID | None = None


class ImproveInputs(BaseModel):
    target: ImproveTarget
    profile: dict[str, Any]
    current: dict[str, Any]


class ImproveResult(BaseModel):
    summary: str | None = None
    bullets: list[str] = Field(default_factory=list)
    note: str = ""  # one-line explanation of what changed
