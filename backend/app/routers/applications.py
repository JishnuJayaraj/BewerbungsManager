from __future__ import annotations

import uuid
from datetime import datetime, timezone
from typing import Any

from fastapi import APIRouter, Depends, HTTPException, Query, Response, status
from sqlmodel import Session, func, select

from app.config import get_settings
from app.db import get_session, seed_local_user
from app.models import (
    Application,
    ApplicationBrief,
    ApplicationStatus,
    BriefLanguage,
    CommsLogEntry,
    Profile,
)
from app.routers.search import get_hr4u_client
from app.schemas.applications import (
    ApplicationBriefRequest,
    ApplicationBriefResponse,
    ApplicationListResponse,
    ApplicationPatch,
    ApplicationResponse,
    ApplicationSaveRequest,
    CommsLogCreate,
    CommsLogListResponse,
    CommsLogResponse,
)
from app.services.hr4u import Hr4uClient, Hr4uClientError

router = APIRouter(prefix="/api/applications", tags=["applications"])


@router.post("", response_model=ApplicationResponse, status_code=status.HTTP_201_CREATED)
async def save_application(
    request: ApplicationSaveRequest,
    session: Session = Depends(get_session),
    client: Hr4uClient = Depends(get_hr4u_client),
) -> ApplicationResponse:
    user = seed_local_user(session)
    existing = session.exec(
        select(Application).where(Application.user_id == user.id, Application.job_uuid == request.job_uuid)
    ).first()
    if existing is not None:
        raise HTTPException(status_code=409, detail="Application already exists for this job")

    try:
        detail = await client.job_detail(request.job_uuid)
    except Hr4uClientError as exc:
        raise _upstream_error(exc) from exc
    if detail.status == "expired" or detail.job is None:
        raise HTTPException(
            status_code=410,
            detail={
                "code": "job_expired",
                "message": "Job posting is expired or no longer available",
                "details": {"uuid": request.job_uuid},
            },
        )

    job = detail.job
    application = Application(
        user_id=user.id,
        job_uuid=job.uuid,
        job_snapshot=job.model_dump(mode="json"),
        job_title=job.text.title or "",
        company=job.companyCleaned or job.company,
        contact=job.counterpart.model_dump(mode="json") if job.counterpart else {},
    )
    session.add(application)
    session.commit()
    session.refresh(application)
    return _application_response(application)


@router.get("", response_model=ApplicationListResponse)
def list_applications(
    session: Session = Depends(get_session),
    page: int = Query(default=1, ge=1),
    size: int = Query(default=50, ge=1, le=100),
) -> ApplicationListResponse:
    user = seed_local_user(session)
    total = session.exec(
        select(func.count()).select_from(Application).where(Application.user_id == user.id)
    ).one()
    statement = (
        select(Application)
        .where(Application.user_id == user.id)
        .order_by(Application.status, Application.board_order, Application.created_at.desc())
        .offset((page - 1) * size)
        .limit(size)
    )
    applications = session.exec(statement).all()
    return ApplicationListResponse(
        items=[_application_response(application) for application in applications],
        page=page,
        total=total,
    )


@router.get("/{application_id}", response_model=ApplicationResponse)
def get_application(
    application_id: uuid.UUID,
    session: Session = Depends(get_session),
) -> ApplicationResponse:
    user = seed_local_user(session)
    return _application_response(_get_application(session, user.id, application_id))


@router.patch("/{application_id}", response_model=ApplicationResponse)
def patch_application(
    application_id: uuid.UUID,
    request: ApplicationPatch,
    session: Session = Depends(get_session),
) -> ApplicationResponse:
    user = seed_local_user(session)
    application = _get_application(session, user.id, application_id)
    for field, value in request.model_dump(exclude_unset=True).items():
        setattr(application, field, value)
    if request.status == ApplicationStatus.APPLIED and application.applied_at is None:
        application.applied_at = _now()
    application.updated_at = _now()
    session.add(application)
    session.commit()
    session.refresh(application)
    return _application_response(application)


@router.delete("/{application_id}", status_code=status.HTTP_204_NO_CONTENT, response_class=Response)
def delete_application(application_id: uuid.UUID, session: Session = Depends(get_session)) -> Response:
    user = seed_local_user(session)
    application = _get_application(session, user.id, application_id)
    for model in (ApplicationBrief, CommsLogEntry):
        for row in session.exec(select(model).where(model.application_id == application.id)).all():
            session.delete(row)
    session.delete(application)
    session.commit()
    return Response(status_code=status.HTTP_204_NO_CONTENT)


@router.get("/{application_id}/brief", response_model=ApplicationBriefResponse)
def get_brief(application_id: uuid.UUID, session: Session = Depends(get_session)) -> ApplicationBriefResponse:
    user = seed_local_user(session)
    application = _get_application(session, user.id, application_id)
    brief = _get_or_create_brief(session, user.id, application.id)
    session.commit()
    session.refresh(brief)
    return _brief_response(brief)


@router.put("/{application_id}/brief", response_model=ApplicationBriefResponse)
def put_brief(
    application_id: uuid.UUID,
    request: ApplicationBriefRequest,
    session: Session = Depends(get_session),
) -> ApplicationBriefResponse:
    user = seed_local_user(session)
    application = _get_application(session, user.id, application_id)
    brief = _get_or_create_brief(session, user.id, application.id)
    data = request.model_dump(exclude_unset=True)
    if "emphasize" in data:
        brief.emphasize = {"items": data.pop("emphasize") or []}
    for field, value in data.items():
        setattr(brief, field, value)
    brief.updated_at = _now()
    session.add(brief)
    session.commit()
    session.refresh(brief)
    return _brief_response(brief)


@router.get("/{application_id}/comms", response_model=CommsLogListResponse)
def list_comms(
    application_id: uuid.UUID,
    session: Session = Depends(get_session),
    page: int = Query(default=1, ge=1),
    size: int = Query(default=50, ge=1, le=100),
) -> CommsLogListResponse:
    user = seed_local_user(session)
    application = _get_application(session, user.id, application_id)
    total = session.exec(
        select(func.count()).select_from(CommsLogEntry).where(CommsLogEntry.application_id == application.id)
    ).one()
    statement = (
        select(CommsLogEntry)
        .where(CommsLogEntry.application_id == application.id)
        .order_by(CommsLogEntry.occurred_at.desc())
        .offset((page - 1) * size)
        .limit(size)
    )
    entries = session.exec(statement).all()
    return CommsLogListResponse(
        items=[_comms_response(entry) for entry in entries],
        page=page,
        total=total,
    )


@router.post("/{application_id}/comms", response_model=CommsLogResponse, status_code=status.HTTP_201_CREATED)
def create_comms(
    application_id: uuid.UUID,
    request: CommsLogCreate,
    session: Session = Depends(get_session),
) -> CommsLogResponse:
    user = seed_local_user(session)
    application = _get_application(session, user.id, application_id)
    entry = CommsLogEntry(
        user_id=user.id,
        application_id=application.id,
        kind=request.kind,
        occurred_at=request.occurred_at or _now(),
        subject=request.subject,
        body=request.body,
        direction=request.direction,
    )
    session.add(entry)
    session.commit()
    session.refresh(entry)
    return _comms_response(entry)


@router.delete("/{application_id}/comms/{entry_id}", status_code=status.HTTP_204_NO_CONTENT, response_class=Response)
def delete_comms(
    application_id: uuid.UUID,
    entry_id: uuid.UUID,
    session: Session = Depends(get_session),
) -> Response:
    user = seed_local_user(session)
    application = _get_application(session, user.id, application_id)
    statement = select(CommsLogEntry).where(
        CommsLogEntry.user_id == user.id,
        CommsLogEntry.application_id == application.id,
        CommsLogEntry.id == entry_id,
    )
    entry = session.exec(statement).first()
    if entry is None:
        raise HTTPException(status_code=404, detail="Comms log entry not found")
    session.delete(entry)
    session.commit()
    return Response(status_code=status.HTTP_204_NO_CONTENT)


def _get_application(session: Session, user_id: uuid.UUID, application_id: uuid.UUID) -> Application:
    statement = select(Application).where(Application.user_id == user_id, Application.id == application_id)
    application = session.exec(statement).first()
    if application is None:
        raise HTTPException(status_code=404, detail="Application not found")
    return application


def _get_or_create_brief(session: Session, user_id: uuid.UUID, application_id: uuid.UUID) -> ApplicationBrief:
    statement = select(ApplicationBrief).where(ApplicationBrief.application_id == application_id)
    brief = session.exec(statement).first()
    if brief is not None:
        return brief

    defaults = _profile_brief_defaults(session, user_id)
    language = defaults.get("language") or BriefLanguage.EN
    brief = ApplicationBrief(
        user_id=user_id,
        application_id=application_id,
        target_angle=defaults.get("target_angle"),
        tone=defaults.get("tone"),
        language=BriefLanguage(language),
        emphasize={"items": []},
    )
    session.add(brief)
    session.flush()
    return brief


def _profile_brief_defaults(session: Session, user_id: uuid.UUID) -> dict[str, Any]:
    profile = session.exec(select(Profile).where(Profile.user_id == user_id)).first()
    return profile.brief_defaults if profile is not None else {}


ACTIVE_STATUSES = {
    ApplicationStatus.SAVED,
    ApplicationStatus.APPLIED,
    ApplicationStatus.INTERVIEW,
    ApplicationStatus.OFFER,
}


def _application_response(application: Application) -> ApplicationResponse:
    days_since_applied: int | None = None
    if application.applied_at is not None:
        applied = application.applied_at
        if applied.tzinfo is None:
            applied = applied.replace(tzinfo=timezone.utc)
        days_since_applied = max(0, (_now() - applied).days)

    threshold = get_settings().ghost_threshold_days
    gone_quiet = (
        application.status == ApplicationStatus.APPLIED
        and days_since_applied is not None
        and days_since_applied >= threshold
    )

    return ApplicationResponse(
        id=application.id,
        job_uuid=application.job_uuid,
        job_snapshot=application.job_snapshot,
        job_title=application.job_title,
        company=application.company,
        status=application.status,
        board_order=application.board_order,
        contact=application.contact,
        next_action=application.next_action,
        followup_date=application.followup_date,
        needs_followup=application.needs_followup,
        applied_at=application.applied_at,
        created_at=application.created_at,
        updated_at=application.updated_at,
        days_since_applied=days_since_applied,
        gone_quiet=gone_quiet,
        is_active=application.status in ACTIVE_STATUSES,
    )


def _brief_response(brief: ApplicationBrief) -> ApplicationBriefResponse:
    emphasize = brief.emphasize
    items = emphasize.get("items", []) if isinstance(emphasize, dict) else []
    return ApplicationBriefResponse(
        id=brief.id,
        application_id=brief.application_id,
        target_angle=brief.target_angle,
        emphasize=items,
        avoid=brief.avoid,
        tone=brief.tone,
        language=brief.language,
        company_motivation=brief.company_motivation,
        user_notes=brief.user_notes,
        created_at=brief.created_at,
        updated_at=brief.updated_at,
    )


def _comms_response(entry: CommsLogEntry) -> CommsLogResponse:
    return CommsLogResponse(
        id=entry.id,
        application_id=entry.application_id,
        kind=entry.kind,
        occurred_at=entry.occurred_at,
        subject=entry.subject,
        body=entry.body,
        direction=entry.direction,
        created_at=entry.created_at,
    )


def _upstream_error(exc: Hr4uClientError) -> HTTPException:
    return HTTPException(
        status_code=502,
        detail={
            "code": "upstream_hr4u_error",
            "message": "HR4U request failed",
            "details": {"status_code": exc.status_code},
        },
    )


def _now() -> datetime:
    return datetime.now(timezone.utc)
