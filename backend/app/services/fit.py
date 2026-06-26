from __future__ import annotations

from app.schemas.fit import FitInputs, FitLlmResult
from app.services.llm import LlmService


class FitService:
    def __init__(self, llm: LlmService | None = None) -> None:
        self.llm = llm or LlmService()

    async def run(self, inputs: FitInputs) -> FitLlmResult:
        return await self.llm.complete(
            [
                {
                    "role": "system",
                    "content": (
                        "Return only JSON matching the fit schema. Produce fit explanation and "
                        "requirements in one call. Do not produce a numeric score. Surface honest "
                        "risks and do_not_claim items for unsupported requirements."
                    ),
                },
                {"role": "user", "content": inputs.model_dump_json()},
            ],
            task="fit",
            response_model=FitLlmResult,
        )
