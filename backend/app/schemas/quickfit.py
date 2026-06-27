"""Quick fit gate: a fast strong/stretch/weak verdict before committing to tailoring."""

from __future__ import annotations

from typing import Any, Literal

from pydantic import BaseModel, Field, model_validator

QuickFitVerdict = Literal["STRONG", "STRETCH", "WEAK"]


class QuickFitRequest(BaseModel):
    job_uuid: str = Field(min_length=1)


class QuickFitInputs(BaseModel):
    profile: dict[str, Any]
    job: dict[str, Any]


class QuickFitResult(BaseModel):
    verdict: QuickFitVerdict = "STRETCH"
    headline: str = ""
    top_gaps: list[str] = Field(default_factory=list, max_length=4)

    @model_validator(mode="before")
    @classmethod
    def _coerce(cls, data: Any) -> Any:
        if not isinstance(data, dict):
            return data
        out = dict(data)
        verdict = str(out.get("verdict") or out.get("rating") or "").strip().upper()
        if verdict in {"STRONG", "GREAT", "GOOD", "HIGH"}:
            verdict = "STRONG"
        elif verdict in {"WEAK", "LOW", "POOR", "NO"}:
            verdict = "WEAK"
        else:
            verdict = "STRETCH"
        out["verdict"] = verdict
        out["headline"] = str(out.get("headline") or out.get("summary") or out.get("reason") or "")
        gaps = out.get("top_gaps") or out.get("gaps") or out.get("missing") or []
        if isinstance(gaps, str):
            gaps = [gaps]
        out["top_gaps"] = [str(g) for g in gaps][:4] if isinstance(gaps, list) else []
        return out
