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
                        "Compare the candidate profile to the job and return ONLY JSON: "
                        '{"fit": {"summary": str, "strong_matches": [{"point": str, '
                        '"evidence_ref": str|null}], "weak_matches": [{"point": str}], '
                        '"unknowns": [{"point": str}], "suggested_angle": str, '
                        '"risks_to_address": [{"risk": str, "honest_framing": str}], '
                        '"do_not_claim": [str]}, "requirements": [{"requirement": str, '
                        '"status": "HAVE"|"PARTIAL"|"MISSING", "evidence_ref": str|null}]}. '
                        "Extract the role's key requirements into the requirements array, each with "
                        "the field name \"requirement\" (a short requirement) and a status of HAVE, "
                        "PARTIAL, or MISSING based on the profile. Do not produce a numeric score. "
                        "Be honest: list real gaps in weak_matches/risks and never claim unsupported skills."
                    ),
                },
                {"role": "user", "content": inputs.model_dump_json()},
            ],
            task="fit",
            response_model=FitLlmResult,
        )
