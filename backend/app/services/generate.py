from __future__ import annotations

from dataclasses import dataclass
from typing import TypeAlias

from app.config import Settings, get_settings
from app.models import ArtifactKind
from app.schemas.generate import (
    ArtifactContent,
    CoverLetterContent,
    CvBulletSuggestionsContent,
    GenerateInputs,
    PortalAnswerContent,
)
from app.services.llm import LlmService

ContentModel: TypeAlias = type[CoverLetterContent] | type[CvBulletSuggestionsContent] | type[PortalAnswerContent]


@dataclass(frozen=True)
class GenerateResult:
    content: ArtifactContent
    model_used: str | None


class GenerateService:
    def __init__(self, llm: LlmService | None = None, settings: Settings | None = None) -> None:
        self.settings = settings or get_settings()
        self.llm = llm or LlmService(self.settings)

    async def run(self, kind: ArtifactKind, inputs: GenerateInputs) -> GenerateResult:
        content = await self.llm.complete(
            [
                {"role": "system", "content": _system_prompt(kind)},
                {"role": "user", "content": inputs.model_dump_json()},
            ],
            task="generate",
            response_model=_content_model(kind),
        )
        if isinstance(content, CvBulletSuggestionsContent) and not content.do_not_pretend:
            content.do_not_pretend = inputs.do_not_claim
        return GenerateResult(content=content, model_used=_model_label(self.settings))


def _content_model(kind: ArtifactKind) -> ContentModel:
    match kind:
        case ArtifactKind.COVER_LETTER:
            return CoverLetterContent
        case ArtifactKind.CV_BULLET_SUGGESTIONS:
            return CvBulletSuggestionsContent
        case ArtifactKind.PORTAL_ANSWER:
            return PortalAnswerContent
        case _:
            raise ValueError(f"Unsupported generation artifact kind: {kind}")


def _system_prompt(kind: ArtifactKind) -> str:
    common = (
        "Return only JSON matching the requested artifact schema. Use profile, job, brief, and "
        "company_motivation from the input. Every factual candidate claim must cite a real "
        "skill:, experience:, project:, or job: evidence_ref, or use UNSUPPORTED. Never assert "
        "anything listed in do_not_claim. If instruction and previous_artifact are present, "
        "regenerate a new version that follows the instruction while preserving citation rules."
    )
    match kind:
        case ArtifactKind.COVER_LETTER:
            return (
                f"{common} Generate a cover letter. When language is DE, set format=anschreiben "
                'and use German Anschreiben conventions: Betreff/subject, Sie-form, "Sehr '
                'geehrte ...", and "Mit freundlichen Grüßen".'
            )
        case ArtifactKind.CV_BULLET_SUGGESTIONS:
            return (
                f"{common} Generate 2 to 4 CV bullet tailoring suggestions only. This is not a "
                "Lebenslauf rewrite. Each suggestion must include original, suggested, reason, "
                "experience_ref, and evidence_ref for a before/after diff."
            )
        case ArtifactKind.PORTAL_ANSWER:
            return f"{common} Draft an answer to portal_question. Keep the answer specific and honest."
        case _:
            return common


def _model_label(settings: Settings) -> str | None:
    model = settings.llm_generate_model or settings.llm_default_model
    if not model:
        return None
    if "/" in model:
        return model
    return f"{settings.llm_default_provider}/{model}"
