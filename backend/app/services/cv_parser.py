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
                        "Extract only facts present in the pasted CV text. Return ONLY a JSON "
                        "object with these keys: full_name (str|null), headline (str|null), "
                        "seniority (str|null), years_exp (int|null), summary (str|null), "
                        "locations (array), skills (array), experiences (array), projects (array). "
                        "Each skill MUST be an object: {\"name\": str, \"kind\": one of "
                        "\"IT_SKILL\"|\"SOFT_SKILL\"|\"LANGUAGE\"|\"CERT\", \"level\": str|null}. "
                        "Never return skills as plain strings. Each experience MUST be an object "
                        "{\"title\": str, \"company\": str|null, \"start\": \"YYYY-MM\"|null, "
                        "\"end\": \"YYYY-MM\"|null, \"is_current\": bool, \"summary\": str|null, "
                        "\"bullets\": array of str, \"tech\": array of str}. Each project MUST be an "
                        "object {\"name\": str, \"role\": str|null, \"summary\": str|null, "
                        "\"tech\": array of str, \"links\": array of str}. Use null or [] for "
                        "unknown values. Do not invent facts."
                    ),
                },
                {"role": "user", "content": cv_text},
            ],
            task="cv_parse",
            response_model=CvParseResult,
        )
