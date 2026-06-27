from __future__ import annotations

import json
import textwrap
import uuid
from typing import Any

from fastapi import APIRouter, Depends, HTTPException, Query, Response, status
from sqlmodel import Session, select

from app.db import get_session, seed_local_user
from app.models import (
    Application,
    ApplicationBrief,
    ArtifactKind,
    Experience,
    GeneratedArtifact,
    Profile,
    Project,
    Skill,
)
from app.schemas.fit import FitArtifactContent
from app.schemas.generate import (
    ArtifactContent,
    CoverLetterContent,
    CvBulletSuggestionsContent,
    ExportFormat,
    GenerateInputs,
    GenerateRequest,
    GeneratedArtifactListResponse,
    GeneratedArtifactResponse,
    PortalAnswerContent,
    TailoredCvContent,
)
from app.services.citations import CitationClaim, CitationEvidence, VerifiedCitation, verify_citations
from app.services.generate import GenerateResult, GenerateService

router = APIRouter(tags=["generation"])


def get_generate_service() -> GenerateService:
    return GenerateService()


@router.post(
    "/api/applications/{application_id}/generate",
    response_model=GeneratedArtifactResponse,
    status_code=status.HTTP_201_CREATED,
)
async def generate_artifact(
    application_id: uuid.UUID,
    request: GenerateRequest,
    session: Session = Depends(get_session),
    service: GenerateService = Depends(get_generate_service),
) -> GeneratedArtifactResponse:
    user = seed_local_user(session)
    application = _get_application(session, user.id, application_id)
    previous = _current_artifact(session, application.id, request.kind)
    inputs = _generate_inputs(session, user.id, application, request, previous)
    try:
        result = await service.run(request.kind, inputs)
    except Exception as exc:  # noqa: BLE001 — clean 502 instead of a 500
        raise HTTPException(
            status_code=502,
            detail={"code": "upstream_llm_error", "message": "Could not generate this — please try again."},
        ) from exc
    verification = verify_citations(_claims_for_content(request.kind, result.content), _citation_evidence(session, user.id, application))

    for artifact in session.exec(
        select(GeneratedArtifact).where(
            GeneratedArtifact.application_id == application.id,
            GeneratedArtifact.kind == request.kind,
            GeneratedArtifact.is_current == True,  # noqa: E712
        )
    ).all():
        artifact.is_current = False
        session.add(artifact)

    artifact = GeneratedArtifact(
        user_id=user.id,
        application_id=application.id,
        kind=request.kind,
        content=result.content.model_dump(mode="json"),
        citations=[citation.model_dump(mode="json") for citation in verification.citations],
        has_unsupported=verification.has_unsupported,
        inputs_snapshot=inputs.model_dump(mode="json"),
        model_used=result.model_used,
        is_current=True,
    )
    session.add(artifact)
    session.commit()
    session.refresh(artifact)
    return _artifact_response(artifact)


@router.get("/api/applications/{application_id}/artifacts", response_model=GeneratedArtifactListResponse)
def list_artifacts(
    application_id: uuid.UUID,
    session: Session = Depends(get_session),
    kind: ArtifactKind | None = Query(default=None),
) -> GeneratedArtifactListResponse:
    user = seed_local_user(session)
    application = _get_application(session, user.id, application_id)
    statement = select(GeneratedArtifact).where(GeneratedArtifact.application_id == application.id)
    if kind is not None:
        statement = statement.where(GeneratedArtifact.kind == kind)
    artifacts = session.exec(statement.order_by(GeneratedArtifact.created_at.desc())).all()
    return GeneratedArtifactListResponse(items=[_artifact_response(artifact) for artifact in artifacts])


@router.get("/api/artifacts/{artifact_id}", response_model=GeneratedArtifactResponse)
def get_artifact(artifact_id: uuid.UUID, session: Session = Depends(get_session)) -> GeneratedArtifactResponse:
    user = seed_local_user(session)
    return _artifact_response(_get_artifact(session, user.id, artifact_id))


@router.get("/api/artifacts/{artifact_id}/export")
def export_artifact(
    artifact_id: uuid.UUID,
    session: Session = Depends(get_session),
    format: ExportFormat = Query(default="markdown"),
) -> Response:
    user = seed_local_user(session)
    artifact = _get_artifact(session, user.id, artifact_id)
    markdown = _artifact_markdown(artifact)
    filename = f"jobcraft-{artifact.kind.value.lower()}-{artifact.id}"
    if format == "markdown":
        return Response(
            content=markdown,
            media_type="text/markdown; charset=utf-8",
            headers={"Content-Disposition": f'attachment; filename="{filename}.md"'},
        )
    return Response(
        content=_pdf_from_text(markdown),
        media_type="application/pdf",
        headers={"Content-Disposition": f'attachment; filename="{filename}.pdf"'},
    )


def _generate_inputs(
    session: Session,
    user_id: uuid.UUID,
    application: Application,
    request: GenerateRequest,
    previous: GeneratedArtifact | None,
) -> GenerateInputs:
    profile = session.exec(select(Profile).where(Profile.user_id == user_id)).first()
    skills = session.exec(select(Skill).where(Skill.user_id == user_id)).all()
    experiences = session.exec(select(Experience).where(Experience.user_id == user_id)).all()
    projects = session.exec(select(Project).where(Project.user_id == user_id)).all()
    brief = session.exec(select(ApplicationBrief).where(ApplicationBrief.application_id == application.id)).first()
    return GenerateInputs(
        profile={
            "profile": profile.model_dump(mode="json") if profile else None,
            "skills": [skill.model_dump(mode="json") for skill in skills],
            "experiences": [experience.model_dump(mode="json") for experience in experiences],
            "projects": [project.model_dump(mode="json") for project in projects],
        },
        job=application.job_snapshot,
        brief=brief.model_dump(mode="json") if brief else None,
        do_not_claim=_latest_do_not_claim(session, application.id),
        portal_question=request.portal_question,
        instruction=request.instruction,
        previous_artifact=previous.content if previous is not None else None,
    )


def _latest_do_not_claim(session: Session, application_id: uuid.UUID) -> list[str]:
    artifact = session.exec(
        select(GeneratedArtifact).where(
            GeneratedArtifact.application_id == application_id,
            GeneratedArtifact.kind == ArtifactKind.FIT_ANALYSIS,
            GeneratedArtifact.is_current == True,  # noqa: E712
        )
    ).first()
    if artifact is None:
        return []
    try:
        content = FitArtifactContent.model_validate(artifact.content)
    except ValueError:
        return []
    return content.fit.do_not_claim


def _claims_for_content(kind: ArtifactKind, content: ArtifactContent) -> list[CitationClaim]:
    match kind:
        case ArtifactKind.COVER_LETTER:
            cover = CoverLetterContent.model_validate(content)
            return cover.claims
        case ArtifactKind.CV_BULLET_SUGGESTIONS:
            cv = CvBulletSuggestionsContent.model_validate(content)
            return [
                CitationClaim(claim=suggestion.suggested, evidence_ref=suggestion.evidence_ref)
                for suggestion in cv.suggestions
            ]
        case ArtifactKind.PORTAL_ANSWER:
            answer = PortalAnswerContent.model_validate(content)
            return answer.claims
        case ArtifactKind.TAILORED_CV:
            cv = TailoredCvContent.model_validate(content)
            return cv.claims
        case _:
            return []


def _citation_evidence(session: Session, user_id: uuid.UUID, application: Application) -> CitationEvidence:
    return CitationEvidence(
        skill_ids={skill.id for skill in session.exec(select(Skill).where(Skill.user_id == user_id)).all()},
        experience_ids={
            experience.id for experience in session.exec(select(Experience).where(Experience.user_id == user_id)).all()
        },
        project_ids={project.id for project in session.exec(select(Project).where(Project.user_id == user_id)).all()},
        job_fields=_job_fields(application.job_snapshot),
    )


def _job_fields(value: Any, prefix: str = "") -> set[str]:
    fields: set[str] = set()
    if isinstance(value, dict):
        for key, nested in value.items():
            path = f"{prefix}.{key}" if prefix else str(key)
            fields.add(path)
            if prefix == "text":
                fields.add(str(key))
            fields.update(_job_fields(nested, path))
    return fields


def _current_artifact(session: Session, application_id: uuid.UUID, kind: ArtifactKind) -> GeneratedArtifact | None:
    return session.exec(
        select(GeneratedArtifact).where(
            GeneratedArtifact.application_id == application_id,
            GeneratedArtifact.kind == kind,
            GeneratedArtifact.is_current == True,  # noqa: E712
        )
    ).first()


def _get_application(session: Session, user_id: uuid.UUID, application_id: uuid.UUID) -> Application:
    application = session.exec(
        select(Application).where(Application.user_id == user_id, Application.id == application_id)
    ).first()
    if application is None:
        raise HTTPException(status_code=404, detail="Application not found")
    return application


def _get_artifact(session: Session, user_id: uuid.UUID, artifact_id: uuid.UUID) -> GeneratedArtifact:
    artifact = session.exec(
        select(GeneratedArtifact).where(GeneratedArtifact.user_id == user_id, GeneratedArtifact.id == artifact_id)
    ).first()
    if artifact is None:
        raise HTTPException(status_code=404, detail="Artifact not found")
    return artifact


def _artifact_response(artifact: GeneratedArtifact) -> GeneratedArtifactResponse:
    return GeneratedArtifactResponse(
        id=artifact.id,
        application_id=artifact.application_id,
        kind=artifact.kind,
        content=artifact.content,
        citations=[VerifiedCitation.model_validate(citation) for citation in artifact.citations],
        has_unsupported=artifact.has_unsupported,
        model_used=artifact.model_used,
        is_current=artifact.is_current,
        created_at=artifact.created_at,
    )


def _artifact_markdown(artifact: GeneratedArtifact) -> str:
    lines = [f"# {artifact.kind.value.replace('_', ' ').title()}", ""]
    match artifact.kind:
        case ArtifactKind.COVER_LETTER:
            content = CoverLetterContent.model_validate(artifact.content)
            if content.subject:
                lines.extend([f"**Betreff:** {content.subject}", ""])
            lines.extend([content.body, ""])
        case ArtifactKind.CV_BULLET_SUGGESTIONS:
            content = CvBulletSuggestionsContent.model_validate(artifact.content)
            for suggestion in content.suggestions:
                lines.extend(
                    [
                        f"## {suggestion.experience_ref}",
                        f"- Original: {suggestion.original or ''}",
                        f"- Suggested: {suggestion.suggested}",
                        f"- Reason: {suggestion.reason}",
                        "",
                    ]
                )
            if content.do_not_pretend:
                lines.extend(["## Do Not Pretend", *[f"- {item}" for item in content.do_not_pretend], ""])
        case ArtifactKind.PORTAL_ANSWER:
            content = PortalAnswerContent.model_validate(artifact.content)
            lines.extend([f"**Question:** {content.question}", "", content.answer, ""])
        case ArtifactKind.TAILORED_CV:
            cv = TailoredCvContent.model_validate(artifact.content)
            lines = [f"# {cv.full_name}".rstrip(), ""]
            if cv.headline:
                lines.extend([f"_{cv.headline}_", ""])
            if cv.contact:
                lines.extend([cv.contact, ""])
            if cv.summary:
                lines.extend(["## Summary", cv.summary, ""])
            if cv.experiences:
                lines.append("## Experience")
                for exp in cv.experiences:
                    head = " — ".join(filter(None, [exp.title, exp.company]))
                    lines.append(f"### {head}{f' ({exp.dates})' if exp.dates else ''}")
                    lines.extend([f"- {bullet}" for bullet in exp.bullets])
                    lines.append("")
            if cv.skills:
                lines.extend(["## Skills", ", ".join(cv.skills), ""])
            if cv.education:
                lines.append("## Education")
                for edu in cv.education:
                    head = " — ".join(filter(None, [edu.degree, edu.institution]))
                    lines.append(f"- {head}{f' ({edu.dates})' if edu.dates else ''}")
                lines.append("")
            if cv.languages:
                lines.extend(["## Languages", ", ".join(cv.languages), ""])
        case _:
            lines.extend(["```json", json.dumps(artifact.content, indent=2, ensure_ascii=False), "```", ""])

    citations = [VerifiedCitation.model_validate(citation) for citation in artifact.citations]
    if citations:
        lines.append("## Citations")
        for citation in citations:
            lines.append(f"- {citation.status}: {citation.claim} ({citation.evidence_ref or 'none'})")
    return "\n".join(lines).strip() + "\n"


def _pdf_from_text(text: str) -> bytes:
    lines: list[str] = []
    for raw_line in text.splitlines():
        wrapped = textwrap.wrap(raw_line, width=86) or [""]
        lines.extend(wrapped)

    content_lines = ["BT", "/F1 10 Tf", "50 780 Td", "14 TL"]
    first = True
    for line in lines[:52]:
        if not first:
            content_lines.append("T*")
        first = False
        content_lines.append(f"({_pdf_escape(line)}) Tj")
    content_lines.append("ET")
    stream = "\n".join(content_lines).encode("latin-1", errors="replace")

    objects = [
        b"<< /Type /Catalog /Pages 2 0 R >>",
        b"<< /Type /Pages /Kids [3 0 R] /Count 1 >>",
        b"<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Resources << /Font << /F1 4 0 R >> >> /Contents 5 0 R >>",
        b"<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>",
        b"<< /Length " + str(len(stream)).encode("ascii") + b" >>\nstream\n" + stream + b"\nendstream",
    ]
    body = bytearray(b"%PDF-1.4\n")
    offsets = [0]
    for index, obj in enumerate(objects, start=1):
        offsets.append(len(body))
        body.extend(f"{index} 0 obj\n".encode("ascii"))
        body.extend(obj)
        body.extend(b"\nendobj\n")
    xref_offset = len(body)
    body.extend(f"xref\n0 {len(objects) + 1}\n".encode("ascii"))
    body.extend(b"0000000000 65535 f \n")
    for offset in offsets[1:]:
        body.extend(f"{offset:010d} 00000 n \n".encode("ascii"))
    body.extend(
        f"trailer\n<< /Size {len(objects) + 1} /Root 1 0 R >>\nstartxref\n{xref_offset}\n%%EOF\n".encode(
            "ascii"
        )
    )
    return bytes(body)


def _pdf_escape(value: str) -> str:
    return value.replace("\\", "\\\\").replace("(", "\\(").replace(")", "\\)")
