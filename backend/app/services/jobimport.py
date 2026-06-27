from __future__ import annotations

from app.schemas.jobimport import JobImportInputs, JobParseResult
from app.services.llm import LlmService

_SYSTEM = (
    "You extract a structured job posting from pasted text (copied from LinkedIn, StepStone, Xing, "
    "a company careers page, etc.). Extract only what is present. Return ONLY JSON: "
    '{"title": str, "company": str|null, "place": str|null, "country": str|null, '
    '"requirements": [str], "tasks": [str], "benefits": [str], "fulltext": str, '
    '"contact": {"name": str|null, "email": str|null, "phone": str|null}}. '
    "requirements = the must-have/should-have lines; tasks = responsibilities; fulltext = a "
    "cleaned plain-text version of the whole posting (no HTML). Do not invent facts."
)


class JobImportService:
    def __init__(self, llm: LlmService | None = None) -> None:
        self.llm = llm or LlmService()

    async def run(self, inputs: JobImportInputs) -> JobParseResult:
        return await self.llm.complete(
            [
                {"role": "system", "content": _SYSTEM},
                {"role": "user", "content": inputs.text},
            ],
            task="job_parse",
            response_model=JobParseResult,
        )
