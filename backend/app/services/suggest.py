from __future__ import annotations

from app.schemas.suggest import SuggestInputs, SuggestResponse
from app.services.llm import LlmService


class SuggestService:
    def __init__(self, llm: LlmService | None = None) -> None:
        self.llm = llm or LlmService()

    async def run(self, inputs: SuggestInputs) -> SuggestResponse:
        result = await self.llm.complete(
            [
                {
                    "role": "system",
                    "content": (
                        "Return only JSON matching the suggest schema. Produce 3 to 8 fitting "
                        "role suggestions from the profile. Each suggestion.search must be a "
                        "valid HR4U /search request body accepted by /api/search/advanced. Do "
                        "not add filters the user did not imply except optional occupation or "
                        "employment hints."
                    ),
                },
                {"role": "user", "content": inputs.model_dump_json()},
            ],
            task="suggest",
            response_model=SuggestResponse,
        )
        for suggestion in result.suggestions:
            suggestion.search.setdefault("page", 1)
            suggestion.search.setdefault("size", 20)
        return result
