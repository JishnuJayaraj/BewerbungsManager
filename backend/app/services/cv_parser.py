from __future__ import annotations

from app.schemas.profile import CvParseResult
from app.services.llm import LlmService


class CvParser:
    def __init__(self, llm: LlmService | None = None) -> None:
        self.llm = llm or LlmService()

    async def parse(self, cv_text: str) -> CvParseResult:
        return await self.llm.complete(
            [
                {
                    "role": "system",
                    "content": (
                        "Extract only facts present in the pasted CV text. Return only JSON "
                        "matching the cv_parse schema. Use null or [] for unknown values."
                    ),
                },
                {"role": "user", "content": cv_text},
            ],
            task="cv_parse",
            response_model=CvParseResult,
        )
