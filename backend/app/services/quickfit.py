from __future__ import annotations

from app.schemas.quickfit import QuickFitInputs, QuickFitResult
from app.services.llm import LlmService

_SYSTEM = (
    "You are a fast fit screener for a tech/IT job seeker in Germany. Given the candidate "
    "profile and a single job, return a quick verdict so they can decide whether it's worth "
    "tailoring a full application. Return ONLY JSON: "
    '{"verdict": "STRONG"|"STRETCH"|"WEAK", "headline": str, "top_gaps": [str]}. '
    "STRONG = clearly qualified; STRETCH = worth a shot with framing; WEAK = likely not worth "
    "the effort. headline is one short sentence. top_gaps lists up to 3 key missing things. "
    "Be honest and quick; do not invent skills the profile lacks."
)


class QuickFitService:
    def __init__(self, llm: LlmService | None = None) -> None:
        self.llm = llm or LlmService()

    async def run(self, inputs: QuickFitInputs) -> QuickFitResult:
        return await self.llm.complete(
            [
                {"role": "system", "content": _SYSTEM},
                {"role": "user", "content": inputs.model_dump_json()},
            ],
            task="quickfit",
            response_model=QuickFitResult,
        )
