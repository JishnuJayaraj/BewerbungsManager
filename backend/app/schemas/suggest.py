from __future__ import annotations

from typing import Any

from pydantic import BaseModel, Field, field_validator

from app.schemas.hr4u import SearchBody


class SuggestInputs(BaseModel):
    profile: dict[str, Any]


class JobSuggestion(BaseModel):
    role: str = Field(min_length=1)
    rationale: str = Field(min_length=1)
    search: SearchBody

    @field_validator("search")
    @classmethod
    def validate_search_body(cls, value: SearchBody) -> SearchBody:
        queries = value.get("queries")
        if not isinstance(queries, list) or not queries:
            raise ValueError("search.queries must contain at least one query")
        page = value.get("page", 1)
        size = value.get("size", 20)
        if not isinstance(page, int) or page < 1:
            raise ValueError("search.page must be a positive integer")
        if not isinstance(size, int) or not 1 <= size <= 100:
            raise ValueError("search.size must be between 1 and 100")
        return value


class SuggestResponse(BaseModel):
    suggestions: list[JobSuggestion] = Field(default_factory=list, min_length=3, max_length=8)
