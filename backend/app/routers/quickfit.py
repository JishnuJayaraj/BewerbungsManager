from __future__ import annotations

import uuid

from fastapi import APIRouter, Depends, HTTPException
from sqlmodel import Session, select

from app.db import get_session, seed_local_user
from app.models import Experience, Profile, Project, Skill
from app.routers.search import get_hr4u_client
from app.schemas.quickfit import QuickFitInputs, QuickFitRequest, QuickFitResult
from app.services.hr4u import Hr4uClient, Hr4uClientError
from app.services.quickfit import QuickFitService

router = APIRouter(prefix="/api", tags=["quickfit"])


def get_quickfit_service() -> QuickFitService:
    return QuickFitService()


@router.post("/quickfit", response_model=QuickFitResult)
async def quickfit(
    request: QuickFitRequest,
    session: Session = Depends(get_session),
    client: Hr4uClient = Depends(get_hr4u_client),
    service: QuickFitService = Depends(get_quickfit_service),
) -> QuickFitResult:
    user = seed_local_user(session)

    try:
        detail = await client.job_detail(request.job_uuid)
    except Hr4uClientError as exc:
        raise HTTPException(
            status_code=502,
            detail={"code": "upstream_hr4u_error", "message": "HR4U request failed"},
        ) from exc
    if detail.status == "expired" or detail.job is None:
        raise HTTPException(
            status_code=410,
            detail={"code": "job_expired", "message": "Job posting is expired or no longer available"},
        )

    inputs = QuickFitInputs(profile=_profile_inputs(session, user.id), job=detail.job.model_dump(mode="json"))
    try:
        return await service.run(inputs)
    except Exception as exc:  # noqa: BLE001 — clean 502 instead of a 500
        raise HTTPException(
            status_code=502,
            detail={"code": "upstream_llm_error", "message": "Could not run the quick fit check."},
        ) from exc


def _profile_inputs(session: Session, user_id: uuid.UUID) -> dict:
    profile = session.exec(select(Profile).where(Profile.user_id == user_id)).first()
    skills = session.exec(select(Skill).where(Skill.user_id == user_id)).all()
    experiences = session.exec(select(Experience).where(Experience.user_id == user_id)).all()
    projects = session.exec(select(Project).where(Project.user_id == user_id)).all()
    return {
        "profile": profile.model_dump(mode="json") if profile else None,
        "skills": [skill.model_dump(mode="json") for skill in skills],
        "experiences": [experience.model_dump(mode="json") for experience in experiences],
        "projects": [project.model_dump(mode="json") for project in projects],
    }
