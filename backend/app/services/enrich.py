"""LLM-driven profile enrichment (questions + apply)."""

from __future__ import annotations

from app.schemas.enrich import (
    EnrichApplyInputs,
    EnrichInputs,
    EnrichQuestionsResult,
    ProfileEnrichment,
)
from app.services.llm import LlmService

_QUESTIONS_SYSTEM = (
    "You help a tech/IT job seeker in Germany strengthen their profile. Given the profile JSON, "
    "identify the most valuable GAPS and ask 3 to 6 specific, answerable questions to fill them. "
    "Prioritise: missing seniority or years of experience, quantified impact for vague "
    "experience bullets, target roles, in-demand skills implied but not listed, German language "
    "level, and work authorization. Do NOT ask about facts already present in the profile. "
    'Return ONLY JSON: {"questions": [{"key": snake_case_id, "question": str, "purpose": short '
    'reason shown to the user, "field": one of "summary"|"seniority"|"years_exp"|"target_roles"|'
    '"skills"|"impact"|"language"|"other"}]}.'
)

_APPLY_SYSTEM = (
    "You enrich a tech/IT job seeker's profile from their answers. Given the profile JSON (which "
    "includes each experience's id) and the user's answers, return a JSON patch. Only include "
    "fields the answers clearly support; never invent facts. Write an improved professional "
    "summary that incorporates the answers. When an answer adds measurable impact or detail to an "
    "existing experience, add strong, quantified CV bullet points to that experience via "
    "experience_updates (reference it by its exact id from the input). Capture any education the "
    "answers reveal. "
    'Return ONLY JSON: {"headline": str|null, "seniority": str|null, "years_exp": int|null, '
    '"summary": str|null, "target_roles": [str], "add_skills": [{"name": str, "kind": '
    '"IT_SKILL"|"SOFT_SKILL"|"LANGUAGE"|"CERT", "level": str|null}], '
    '"add_education": [{"degree": str, "institution": str|null, "field_of_study": str|null, '
    '"start": "YYYY-MM"|null, "end": "YYYY-MM"|null, "grade": str|null, "summary": str|null}], '
    '"experience_updates": [{"experience_id": str, "add_bullets": [str], "summary": str|null}], '
    '"change_summary": [str]}. change_summary is a short human-readable list of what you changed.'
)


class EnrichService:
    def __init__(self, llm: LlmService | None = None) -> None:
        self.llm = llm or LlmService()

    async def questions(self, inputs: EnrichInputs) -> EnrichQuestionsResult:
        return await self.llm.complete(
            [
                {"role": "system", "content": _QUESTIONS_SYSTEM},
                {"role": "user", "content": inputs.model_dump_json()},
            ],
            task="enrich",
            response_model=EnrichQuestionsResult,
        )

    async def apply(self, inputs: EnrichApplyInputs) -> ProfileEnrichment:
        return await self.llm.complete(
            [
                {"role": "system", "content": _APPLY_SYSTEM},
                {"role": "user", "content": inputs.model_dump_json()},
            ],
            task="enrich",
            response_model=ProfileEnrichment,
        )
