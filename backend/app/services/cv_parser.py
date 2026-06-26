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
                        "locations (array), links (array), skills (array), experiences (array), "
                        "projects (array), education (array). "
                        "years_exp MUST be an integer (e.g. for '2+ years' return 2). "
                        "Each location MUST be an object {\"place\": str}. Each link MUST be an "
                        "object {\"label\": str, \"url\": str} (LinkedIn, GitHub, portfolio). "
                        "Each skill MUST be an object: {\"name\": str, \"kind\": one of "
                        "\"IT_SKILL\"|\"SOFT_SKILL\"|\"LANGUAGE\"|\"CERT\", \"level\": str|null} — "
                        "put spoken languages as LANGUAGE and certifications as CERT. "
                        "Never return skills as plain strings. Each experience MUST be an object "
                        "{\"title\": str, \"company\": str|null, \"start\": \"YYYY-MM\"|null, "
                        "\"end\": \"YYYY-MM\"|null, \"is_current\": bool, \"summary\": str|null, "
                        "\"bullets\": array of str, \"tech\": array of str}. Put each role's "
                        "achievement lines into bullets. Each project MUST be an object "
                        "{\"name\": str, \"role\": str|null, \"summary\": str|null, \"tech\": "
                        "array of str, \"links\": array of str}. ALWAYS extract every education "
                        "entry into education: each is an object {\"degree\": str, "
                        "\"institution\": str|null, \"field_of_study\": str|null, "
                        "\"start\": \"YYYY-MM\"|null, \"end\": \"YYYY-MM\"|null, \"grade\": "
                        "str|null, \"summary\": str|null}. Use null or [] for unknown values. "
                        "Do not invent facts."
                    ),
                },
                {"role": "user", "content": cv_text},
            ],
            task="cv_parse",
            response_model=CvParseResult,
        )
