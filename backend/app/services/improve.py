from __future__ import annotations

from app.schemas.improve import ImproveInputs, ImproveResult
from app.services.llm import LlmService

_SUMMARY_SYSTEM = (
    "You polish a tech/IT job seeker's professional summary for the German market. Using the full "
    "profile for context, rewrite the summary to be sharp, specific, and impact-led — lead with "
    "role + years + strongest stack, weave in concrete strengths, keep it 2-4 sentences. Never "
    "invent facts not supported by the profile. Return ONLY JSON: "
    '{"summary": str, "note": one short sentence on what you improved}.'
)

_BULLETS_SYSTEM = (
    "You rewrite the CV bullet points for one experience to maximise impact for a tech/IT job "
    "seeker. Use the full profile for context. Make each bullet start with a strong action verb, "
    "quantify impact where the profile supports it, and cut fluff. Keep 3-5 bullets. Never invent "
    "facts. Return ONLY JSON: {\"bullets\": [str], \"note\": one short sentence on what you improved}."
)


class ImproveService:
    def __init__(self, llm: LlmService | None = None) -> None:
        self.llm = llm or LlmService()

    async def run(self, inputs: ImproveInputs) -> ImproveResult:
        system = _SUMMARY_SYSTEM if inputs.target == "summary" else _BULLETS_SYSTEM
        return await self.llm.complete(
            [
                {"role": "system", "content": system},
                {"role": "user", "content": inputs.model_dump_json()},
            ],
            task="improve",
            response_model=ImproveResult,
        )
