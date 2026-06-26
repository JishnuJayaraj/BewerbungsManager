from __future__ import annotations

import uuid
from typing import Any

from fastapi import APIRouter, Depends, HTTPException
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
    RequirementCheck,
    Skill,
)
from app.schemas.fit import (
    FitArtifactContent,
    FitInputs,
    FitResponse,
    RequirementCheckResponse,
    RequirementOverrideRequest,
)
from app.services.citations import CitationEvidence, is_supported_ref
from app.services.fit import FitService

router = APIRouter(prefix="/api/applications", tags=["fit"])


def get_fit_service() -> FitService:
    return FitService()


@router.post("/{application_id}/fit", response_model=FitResponse)
async def run_fit(
    application_id: uuid.UUID,
    session: Session = Depends(get_session),
    service: FitService = Depends(get_fit_service),
) -> FitResponse:
    user = seed_local_user(session)
    application = _get_application(session, user.id, application_id)
    inputs = _fit_inputs(session, user.id, application)
    try:
        result = await service.run(inputs)
    except Exception as exc:  # noqa: BLE001 — clean 502 instead of a 500
        raise HTTPException(
            status_code=502,
            detail={"code": "upstream_llm_error", "message": "Could not run the fit analysis. Please try again."},
        ) from exc

    for artifact in session.exec(
        select(GeneratedArtifact).where(
            GeneratedArtifact.application_id == application.id,
            GeneratedArtifact.kind == ArtifactKind.FIT_ANALYSIS,
            GeneratedArtifact.is_current == True,  # noqa: E712
        )
    ).all():
        artifact.is_current = False
        session.add(artifact)

    for row in session.exec(select(RequirementCheck).where(RequirementCheck.application_id == application.id)).all():
        session.delete(row)

    content = FitArtifactContent(fit=result.fit, requirements=result.requirements)
    artifact = GeneratedArtifact(
        user_id=user.id,
        application_id=application.id,
        kind=ArtifactKind.FIT_ANALYSIS,
        content=content.model_dump(mode="json"),
        citations=[],
        has_unsupported=False,
        inputs_snapshot=inputs.model_dump(mode="json"),
        model_used="configured-fit-model",
        is_current=True,
    )
    session.add(artifact)
    session.flush()

    evidence = _citation_evidence(session, user.id)
    checks: list[RequirementCheck] = []
    for requirement in result.requirements:
        refs = [requirement.evidence_ref] if is_supported_ref(requirement.evidence_ref, evidence) else []
        check = RequirementCheck(
            user_id=user.id,
            application_id=application.id,
            requirement=requirement.requirement,
            status=requirement.status,
            evidence=refs,
        )
        session.add(check)
        checks.append(check)

    session.commit()
    session.refresh(artifact)
    for check in checks:
        session.refresh(check)
    return FitResponse(
        artifact_id=artifact.id,
        fit=result.fit,
        requirements=[_requirement_response(check) for check in checks],
    )


@router.get("/{application_id}/fit", response_model=FitResponse)
def get_fit(application_id: uuid.UUID, session: Session = Depends(get_session)) -> FitResponse:
    user = seed_local_user(session)
    application = _get_application(session, user.id, application_id)
    artifact = session.exec(
        select(GeneratedArtifact).where(
            GeneratedArtifact.application_id == application.id,
            GeneratedArtifact.kind == ArtifactKind.FIT_ANALYSIS,
            GeneratedArtifact.is_current == True,  # noqa: E712
        )
    ).first()
    if artifact is None:
        raise HTTPException(status_code=404, detail="Fit analysis not found")
    content = FitArtifactContent.model_validate(artifact.content)
    checks = session.exec(select(RequirementCheck).where(RequirementCheck.application_id == application.id)).all()
    return FitResponse(
        artifact_id=artifact.id,
        fit=content.fit,
        requirements=[_requirement_response(check) for check in checks],
    )


@router.patch("/{application_id}/requirements/{requirement_id}", response_model=RequirementCheckResponse)
def patch_requirement(
    application_id: uuid.UUID,
    requirement_id: uuid.UUID,
    request: RequirementOverrideRequest,
    session: Session = Depends(get_session),
) -> RequirementCheckResponse:
    user = seed_local_user(session)
    application = _get_application(session, user.id, application_id)
    check = session.exec(
        select(RequirementCheck).where(
            RequirementCheck.user_id == user.id,
            RequirementCheck.application_id == application.id,
            RequirementCheck.id == requirement_id,
        )
    ).first()
    if check is None:
        raise HTTPException(status_code=404, detail="Requirement check not found")
    check.user_override = request.user_override
    session.add(check)
    session.commit()
    session.refresh(check)
    return _requirement_response(check)


def _fit_inputs(session: Session, user_id: uuid.UUID, application: Application) -> FitInputs:
    profile = session.exec(select(Profile).where(Profile.user_id == user_id)).first()
    skills = session.exec(select(Skill).where(Skill.user_id == user_id)).all()
    experiences = session.exec(select(Experience).where(Experience.user_id == user_id)).all()
    projects = session.exec(select(Project).where(Project.user_id == user_id)).all()
    brief = session.exec(select(ApplicationBrief).where(ApplicationBrief.application_id == application.id)).first()
    return FitInputs(
        profile={
            "profile": profile.model_dump(mode="json") if profile else None,
            "skills": [skill.model_dump(mode="json") for skill in skills],
            "experiences": [experience.model_dump(mode="json") for experience in experiences],
            "projects": [project.model_dump(mode="json") for project in projects],
        },
        job=application.job_snapshot,
        brief=brief.model_dump(mode="json") if brief else None,
    )


def _citation_evidence(session: Session, user_id: uuid.UUID) -> CitationEvidence:
    return CitationEvidence(
        skill_ids={skill.id for skill in session.exec(select(Skill).where(Skill.user_id == user_id)).all()},
        experience_ids={
            experience.id for experience in session.exec(select(Experience).where(Experience.user_id == user_id)).all()
        },
        project_ids={project.id for project in session.exec(select(Project).where(Project.user_id == user_id)).all()},
        job_fields=set(),
    )


def _get_application(session: Session, user_id: uuid.UUID, application_id: uuid.UUID) -> Application:
    application = session.exec(
        select(Application).where(Application.user_id == user_id, Application.id == application_id)
    ).first()
    if application is None:
        raise HTTPException(status_code=404, detail="Application not found")
    return application


def _requirement_response(check: RequirementCheck) -> RequirementCheckResponse:
    return RequirementCheckResponse(
        id=check.id,
        requirement=check.requirement,
        status=check.status,
        evidence=check.evidence,
        user_override=check.user_override,
    )
