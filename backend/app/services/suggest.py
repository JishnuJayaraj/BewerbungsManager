from __future__ import annotations

from app.schemas.suggest import SuggestInputs, SuggestResponse
from app.services.llm import LlmService

_SYSTEM = (
    "You recommend job roles a tech/IT job seeker in Germany should explore, based on their "
    "profile. Lead with the strongest fit. Return ONLY JSON: {\"suggestions\": [{\"role\": str, "
    '"rationale": str, "phrase": str, "skills": [str]}]}. role is a concise job title (e.g. '
    '"MLOps Engineer"). rationale is one sentence on why it fits this person. phrase is 1-4 '
    "search keywords to find this role on German job boards (e.g. \"MLOps Engineer\" or "
    '"Machine Learning Python"). skills lists 3-6 key skills expected for the role. Give 5 to 8 '
    "suggestions, most-fitting first. Do not invent skills the profile does not support."
)


class SuggestService:
    def __init__(self, llm: LlmService | None = None) -> None:
        self.llm = llm or LlmService()

    async def run(self, inputs: SuggestInputs) -> SuggestResponse:
        result = await self.llm.complete(
            [
                {"role": "system", "content": _SYSTEM},
                {"role": "user", "content": inputs.model_dump_json()},
            ],
            task="suggest",
            response_model=SuggestResponse,
        )
        # Keep only usable cards (need a role and something to search for).
        result.suggestions = [s for s in result.suggestions if s.role and s.phrase][:8]
        return result
