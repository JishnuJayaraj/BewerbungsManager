from __future__ import annotations

from typing import Any

from pydantic import BaseModel, Field, model_validator


class SuggestInputs(BaseModel):
    profile: dict[str, Any]


class JobSuggestion(BaseModel):
    """A role the profile fits — used as a discovery card the user can explore."""

    role: str = ""
    rationale: str = ""
    phrase: str = ""  # search keywords to explore this role on the job boards
    skills: list[str] = Field(default_factory=list)

    @model_validator(mode="before")
    @classmethod
    def _coerce(cls, data: Any) -> Any:
        if not isinstance(data, dict):
            return data
        out = dict(data)
        out["role"] = out.get("role") or out.get("title") or out.get("name") or ""
        out["rationale"] = out.get("rationale") or out.get("reason") or out.get("why") or ""

        phrase: Any = out.get("phrase") or out.get("query") or out.get("keywords")
        if not phrase:
            # Fall back to a possibly-nested search body, then the role title.
            search = out.get("search")
            if isinstance(search, dict):
                phrase = search.get("phrase") or search.get("query")
            phrase = phrase or out.get("role") or out.get("title") or ""
        if isinstance(phrase, list):
            phrase = " ".join(str(p) for p in phrase)
        out["phrase"] = str(phrase or "")

        skills: Any = out.get("skills") or out.get("key_skills") or out.get("required_skills") or []
        if isinstance(skills, str):
            skills = [skills]
        out["skills"] = [str(s) for s in skills] if isinstance(skills, list) else []
        return out


class SuggestResponse(BaseModel):
    suggestions: list[JobSuggestion] = Field(default_factory=list, max_length=12)
