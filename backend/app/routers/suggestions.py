from __future__ import annotations

import uuid

from fastapi import APIRouter, Depends
from sqlmodel import Session, select

from app.db import get_session, seed_local_user
from app.models import Experience, Profile, Project, Skill
from app.schemas.suggest import SuggestInputs, SuggestResponse
from app.services.suggest import SuggestService

router = APIRouter(prefix="/api", tags=["suggestions"])


def get_suggest_service() -> SuggestService:
    return SuggestService()


@router.post("/suggestions", response_model=SuggestResponse)
async def suggest_jobs(
    session: Session = Depends(get_session),
    service: SuggestService = Depends(get_suggest_service),
) -> SuggestResponse:
    user = seed_local_user(session)
    return await service.run(_suggest_inputs(session, user.id))


def _suggest_inputs(session: Session, user_id: uuid.UUID) -> SuggestInputs:
    profile = session.exec(select(Profile).where(Profile.user_id == user_id)).first()
    skills = session.exec(select(Skill).where(Skill.user_id == user_id)).all()
    experiences = session.exec(select(Experience).where(Experience.user_id == user_id)).all()
    projects = session.exec(select(Project).where(Project.user_id == user_id)).all()
    return SuggestInputs(
        profile={
            "profile": profile.model_dump(mode="json") if profile else None,
            "skills": [skill.model_dump(mode="json") for skill in skills],
            "experiences": [experience.model_dump(mode="json") for experience in experiences],
            "projects": [project.model_dump(mode="json") for project in projects],
        }
    )
