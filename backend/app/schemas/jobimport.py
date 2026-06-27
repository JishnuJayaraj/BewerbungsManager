"""Import a job from anywhere: paste a job description (and optional URL) -> structured job."""

from __future__ import annotations

from typing import Any

from pydantic import BaseModel, Field, field_validator


class JobImportRequest(BaseModel):
    text: str = Field(min_length=1)
    url: str | None = None


class JobImportInputs(BaseModel):
    text: str
    url: str | None = None


class ContactParse(BaseModel):
    name: str | None = None
    email: str | None = None
    phone: str | None = None


class JobParseResult(BaseModel):
    title: str = ""
    company: str | None = None
    place: str | None = None
    country: str | None = None
    requirements: list[str] = Field(default_factory=list)
    tasks: list[str] = Field(default_factory=list)
    benefits: list[str] = Field(default_factory=list)
    fulltext: str = ""
    contact: ContactParse = Field(default_factory=ContactParse)

    @field_validator("requirements", "tasks", "benefits", mode="before")
    @classmethod
    def _coerce_list(cls, value: Any) -> Any:
        if isinstance(value, str):
            return [value]
        if isinstance(value, list):
            return [str(item) for item in value if item]
        return []

    @field_validator("title", "fulltext", mode="before")
    @classmethod
    def _coerce_str(cls, value: Any) -> Any:
        return value if isinstance(value, str) else ""
