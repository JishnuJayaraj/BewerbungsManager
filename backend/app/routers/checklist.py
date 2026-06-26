from __future__ import annotations

import re
import uuid

from fastapi import APIRouter, Depends, HTTPException
from sqlmodel import Session, select

from app.db import get_session, seed_local_user
from app.models import (
    Application,
    PackageChecklist,
    RequirementCheck,
    RequirementStatus,
    Skill,
    SkillKind,
    default_package_items,
)
from app.schemas.checklist import PackageChecklistRequest, PackageChecklistResponse

router = APIRouter(prefix="/api/applications", tags=["checklist"])

LEVEL_ORDER = {"A1": 1, "A2": 2, "B1": 3, "B2": 4, "C1": 5, "C2": 6}
LEVEL_RE = re.compile(r"\b(A1|A2|B1|B2|C1|C2)\b", re.IGNORECASE)
GERMAN_RE = re.compile(r"\b(german|deutsch)\b", re.IGNORECASE)


@router.get("/{application_id}/checklist", response_model=PackageChecklistResponse)
def get_checklist(application_id: uuid.UUID, session: Session = Depends(get_session)) -> PackageChecklistResponse:
    user = seed_local_user(session)
    application = _get_application(session, user.id, application_id)
    checklist = _get_or_create_checklist(session, user.id, application.id)
    _apply_language_gap_prefill(session, user.id, application.id, checklist)
    session.commit()
    session.refresh(checklist)
    return _checklist_response(checklist)


@router.put("/{application_id}/checklist", response_model=PackageChecklistResponse)
def put_checklist(
    application_id: uuid.UUID,
    request: PackageChecklistRequest,
    session: Session = Depends(get_session),
) -> PackageChecklistResponse:
    user = seed_local_user(session)
    application = _get_application(session, user.id, application_id)
    checklist = _get_or_create_checklist(session, user.id, application.id)
    data = request.model_dump()
    data["items"] = _normalized_items(data["items"])
    for field, value in data.items():
        setattr(checklist, field, value)
    session.add(checklist)
    session.commit()
    session.refresh(checklist)
    return _checklist_response(checklist)


def _get_application(session: Session, user_id: uuid.UUID, application_id: uuid.UUID) -> Application:
    application = session.exec(
        select(Application).where(Application.user_id == user_id, Application.id == application_id)
    ).first()
    if application is None:
        raise HTTPException(status_code=404, detail="Application not found")
    return application


def _get_or_create_checklist(session: Session, user_id: uuid.UUID, application_id: uuid.UUID) -> PackageChecklist:
    checklist = session.exec(select(PackageChecklist).where(PackageChecklist.application_id == application_id)).first()
    if checklist is not None:
        checklist.items = _normalized_items(checklist.items)
        return checklist
    checklist = PackageChecklist(user_id=user_id, application_id=application_id, items=default_package_items())
    session.add(checklist)
    session.flush()
    return checklist


def _apply_language_gap_prefill(
    session: Session,
    user_id: uuid.UUID,
    application_id: uuid.UUID,
    checklist: PackageChecklist,
) -> None:
    required = checklist.language_level_required or _required_german_level_from_fit(session, application_id)
    user_level = checklist.language_level_user or _user_german_level(session, user_id)
    if required is not None:
        checklist.language_level_required = required
    if user_level is not None:
        checklist.language_level_user = user_level
    if required is not None:
        items = _normalized_items(checklist.items)
        items["language_ok"] = _level_meets(user_level, required)
        checklist.items = items
    session.add(checklist)


def _required_german_level_from_fit(session: Session, application_id: uuid.UUID) -> str | None:
    checks = session.exec(select(RequirementCheck).where(RequirementCheck.application_id == application_id)).all()
    candidates: list[str] = []
    for check in checks:
        if _effective_status(check) not in {RequirementStatus.PARTIAL, RequirementStatus.MISSING}:
            continue
        if not GERMAN_RE.search(check.requirement):
            continue
        level = _extract_level(check.requirement)
        if level is not None:
            candidates.append(level)
    return max(candidates, key=lambda level: LEVEL_ORDER[level], default=None)


def _user_german_level(session: Session, user_id: uuid.UUID) -> str | None:
    skills = session.exec(
        select(Skill).where(Skill.user_id == user_id, Skill.kind == SkillKind.LANGUAGE)
    ).all()
    candidates: list[str] = []
    for skill in skills:
        if not GERMAN_RE.search(f"{skill.name} {skill.level or ''}"):
            continue
        level = _extract_level(f"{skill.name} {skill.level or ''}")
        if level is not None:
            candidates.append(level)
    return max(candidates, key=lambda level: LEVEL_ORDER[level], default=None)


def _effective_status(check: RequirementCheck) -> RequirementStatus:
    return check.user_override or check.status


def _extract_level(value: str) -> str | None:
    match = LEVEL_RE.search(value)
    return match.group(1).upper() if match else None


def _level_meets(user_level: str | None, required: str) -> bool:
    if user_level is None:
        return False
    return LEVEL_ORDER.get(user_level, 0) >= LEVEL_ORDER.get(required, 0)


def _normalized_items(items: dict[str, bool] | None) -> dict[str, bool]:
    normalized = default_package_items()
    if items:
        for key in normalized:
            if key in items:
                normalized[key] = bool(items[key])
    return normalized


def _checklist_response(checklist: PackageChecklist) -> PackageChecklistResponse:
    return PackageChecklistResponse(
        id=checklist.id,
        application_id=checklist.application_id,
        salary_expectation=checklist.salary_expectation,
        earliest_start_date=checklist.earliest_start_date,
        language_level_required=checklist.language_level_required,
        language_level_user=checklist.language_level_user,
        work_permit_status=checklist.work_permit_status,
        certificates_ready=checklist.certificates_ready,
        cover_letter_required=checklist.cover_letter_required,
        items=_normalized_items(checklist.items),
        notes=checklist.notes,
    )
