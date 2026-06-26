from __future__ import annotations

import uuid
from datetime import datetime, timezone
from typing import Any

from fastapi import APIRouter, Depends, HTTPException, Response, status
from sqlmodel import Session, select

from app.db import get_session, seed_local_user
from app.models import Education, Experience, Profile, ProfileEntrySource, Project, Skill, SkillKind
from app.schemas.enrich import (
    EnrichApplyInputs,
    EnrichApplyRequest,
    EnrichApplyResponse,
    EnrichInputs,
    EnrichQuestionsResult,
)
from app.schemas.profile import (
    CvParseRequest,
    CvParseResult,
    EducationInput,
    EducationResponse,
    EducationUpdate,
    ExperienceInput,
    ExperienceResponse,
    ExperienceUpdate,
    ProfileResponse,
    ProfileUpdate,
    ProjectInput,
    ProjectResponse,
    ProjectUpdate,
    SkillInput,
    SkillResponse,
    SkillUpdate,
    format_profile_date,
    parse_profile_date,
)
from app.services.cv_parser import CvParser
from app.services.enrich import EnrichService

router = APIRouter(prefix="/api/profile", tags=["profile"])


def get_cv_parser() -> CvParser:
    return CvParser()


def get_enrich_service() -> EnrichService:
    return EnrichService()


@router.post("/parse", response_model=ProfileResponse)
async def parse_profile(
    request: CvParseRequest,
    session: Session = Depends(get_session),
    parser: CvParser = Depends(get_cv_parser),
) -> ProfileResponse:
    user = seed_local_user(session)
    profile = _get_or_create_profile(session, user.id)
    profile.raw_cv_text = request.cv_text

    parse_warning: str | None = None
    try:
        parsed = await parser.parse(request.cv_text)
    except Exception:
        parsed = CvParseResult()
        parse_warning = "CV parsing failed; an empty editable profile was created."

    _replace_profile_from_parse(session, profile, user.id, parsed)
    session.commit()
    session.refresh(profile)
    return _profile_response(session, profile, parse_warning=parse_warning)


@router.get("", response_model=ProfileResponse)
def get_profile(session: Session = Depends(get_session)) -> ProfileResponse:
    user = seed_local_user(session)
    profile = _get_or_create_profile(session, user.id)
    session.commit()
    session.refresh(profile)
    return _profile_response(session, profile)


@router.put("", response_model=ProfileResponse)
def update_profile(
    request: ProfileUpdate,
    session: Session = Depends(get_session),
) -> ProfileResponse:
    user = seed_local_user(session)
    profile = _get_or_create_profile(session, user.id)
    for field, value in request.model_dump(exclude_unset=True).items():
        setattr(profile, field, value)
    profile.updated_at = _now()
    session.add(profile)
    session.commit()
    session.refresh(profile)
    return _profile_response(session, profile)


@router.post("/enrich/questions", response_model=EnrichQuestionsResult)
async def enrich_questions(
    session: Session = Depends(get_session),
    service: EnrichService = Depends(get_enrich_service),
) -> EnrichQuestionsResult:
    user = seed_local_user(session)
    profile = _get_or_create_profile(session, user.id)
    session.commit()
    profile_dict = _profile_response(session, profile).model_dump(mode="json")
    try:
        return await service.questions(EnrichInputs(profile=profile_dict))
    except Exception as exc:  # noqa: BLE001 — surface a clean 502 instead of a 500
        raise HTTPException(
            status_code=502,
            detail={"code": "upstream_llm_error", "message": "Could not generate enrichment questions."},
        ) from exc


@router.post("/enrich/apply", response_model=EnrichApplyResponse)
async def enrich_apply(
    request: EnrichApplyRequest,
    session: Session = Depends(get_session),
    service: EnrichService = Depends(get_enrich_service),
) -> EnrichApplyResponse:
    user = seed_local_user(session)
    profile = _get_or_create_profile(session, user.id)
    session.commit()
    profile_dict = _profile_response(session, profile).model_dump(mode="json")

    try:
        enrichment = await service.apply(EnrichApplyInputs(profile=profile_dict, answers=request.answers))
    except Exception as exc:  # noqa: BLE001
        raise HTTPException(
            status_code=502,
            detail={"code": "upstream_llm_error", "message": "Could not apply enrichment."},
        ) from exc

    changes = list(enrichment.change_summary)
    if enrichment.headline:
        profile.headline = enrichment.headline
    if enrichment.seniority:
        profile.seniority = enrichment.seniority
    if enrichment.years_exp is not None:
        profile.years_exp = enrichment.years_exp
    if enrichment.summary:
        profile.summary = enrichment.summary
    if enrichment.target_roles:
        prefs = dict(profile.preferences or {})
        existing = [str(role) for role in prefs.get("target_roles", [])]
        merged = existing + [role for role in enrichment.target_roles if role not in existing]
        prefs["target_roles"] = merged
        profile.preferences = prefs

    existing_skill_names = {
        skill.name.casefold()
        for skill in session.exec(select(Skill).where(Skill.profile_id == profile.id)).all()
    }
    added_skills: list[str] = []
    for skill in enrichment.add_skills:
        if skill.name.casefold() in existing_skill_names:
            continue
        session.add(
            Skill(
                user_id=user.id,
                profile_id=profile.id,
                name=skill.name,
                kind=skill.kind if isinstance(skill.kind, SkillKind) else SkillKind(skill.kind),
                level=skill.level,
                source=ProfileEntrySource.MANUAL,
            )
        )
        existing_skill_names.add(skill.name.casefold())
        added_skills.append(skill.name)

    # Append bullets / summaries to existing experiences referenced by id.
    if enrichment.experience_updates:
        experiences = {
            str(exp.id): exp
            for exp in session.exec(select(Experience).where(Experience.profile_id == profile.id)).all()
        }
        for patch in enrichment.experience_updates:
            experience = experiences.get(str(patch.experience_id))
            if experience is None:
                continue
            new_bullets = [b for b in patch.add_bullets if b and b not in experience.bullets]
            if new_bullets:
                experience.bullets = [*experience.bullets, *new_bullets]
                changes.append(f"Added {len(new_bullets)} bullet(s) to {experience.title}.")
            if patch.summary and not experience.summary:
                experience.summary = patch.summary
            session.add(experience)

    # Add education the answers revealed (dedup by degree + institution).
    if enrichment.add_education:
        existing_edu = {
            (item.degree.casefold(), (item.institution or "").casefold())
            for item in session.exec(select(Education).where(Education.profile_id == profile.id)).all()
        }
        for edu in enrichment.add_education:
            key = (edu.degree.casefold(), (edu.institution or "").casefold())
            if key in existing_edu:
                continue
            session.add(
                Education(
                    user_id=user.id,
                    profile_id=profile.id,
                    degree=edu.degree,
                    institution=edu.institution,
                    field_of_study=edu.field_of_study,
                    start=parse_profile_date(edu.start),
                    end=parse_profile_date(edu.end),
                    grade=edu.grade,
                    summary=edu.summary,
                )
            )
            existing_edu.add(key)
            changes.append(f"Added education: {edu.degree}.")

    if not changes:
        changes = [f"Updated {len(request.answers)} detail(s) from your answers."]
    profile.updated_at = _now()
    session.add(profile)
    session.commit()
    session.refresh(profile)
    return EnrichApplyResponse(
        profile=_profile_response(session, profile),
        changes=changes,
        added_skills=added_skills,
    )


@router.post("/skills", response_model=SkillResponse, status_code=status.HTTP_201_CREATED)
def create_skill(request: SkillInput, session: Session = Depends(get_session)) -> SkillResponse:
    user = seed_local_user(session)
    profile = _get_or_create_profile(session, user.id)
    skill = Skill(user_id=user.id, profile_id=profile.id, **request.model_dump())
    session.add(skill)
    session.commit()
    session.refresh(skill)
    return _skill_response(skill)


@router.put("/skills/{skill_id}", response_model=SkillResponse)
def update_skill(
    skill_id: uuid.UUID,
    request: SkillUpdate,
    session: Session = Depends(get_session),
) -> SkillResponse:
    user = seed_local_user(session)
    skill = _get_user_child(session, Skill, user.id, skill_id, "Skill")
    for field, value in request.model_dump(exclude_unset=True).items():
        setattr(skill, field, value)
    session.add(skill)
    session.commit()
    session.refresh(skill)
    return _skill_response(skill)


@router.delete("/skills/{skill_id}", status_code=status.HTTP_204_NO_CONTENT, response_class=Response)
def delete_skill(skill_id: uuid.UUID, session: Session = Depends(get_session)) -> Response:
    user = seed_local_user(session)
    skill = _get_user_child(session, Skill, user.id, skill_id, "Skill")
    session.delete(skill)
    session.commit()
    return Response(status_code=status.HTTP_204_NO_CONTENT)


@router.post("/experiences", response_model=ExperienceResponse, status_code=status.HTTP_201_CREATED)
def create_experience(
    request: ExperienceInput,
    session: Session = Depends(get_session),
) -> ExperienceResponse:
    user = seed_local_user(session)
    profile = _get_or_create_profile(session, user.id)
    data = _experience_data(request.model_dump())
    experience = Experience(user_id=user.id, profile_id=profile.id, **data)
    session.add(experience)
    session.commit()
    session.refresh(experience)
    return _experience_response(experience)


@router.put("/experiences/{experience_id}", response_model=ExperienceResponse)
def update_experience(
    experience_id: uuid.UUID,
    request: ExperienceUpdate,
    session: Session = Depends(get_session),
) -> ExperienceResponse:
    user = seed_local_user(session)
    experience = _get_user_child(session, Experience, user.id, experience_id, "Experience")
    for field, value in _experience_data(request.model_dump(exclude_unset=True)).items():
        setattr(experience, field, value)
    session.add(experience)
    session.commit()
    session.refresh(experience)
    return _experience_response(experience)


@router.delete("/experiences/{experience_id}", status_code=status.HTTP_204_NO_CONTENT, response_class=Response)
def delete_experience(experience_id: uuid.UUID, session: Session = Depends(get_session)) -> Response:
    user = seed_local_user(session)
    experience = _get_user_child(session, Experience, user.id, experience_id, "Experience")
    session.delete(experience)
    session.commit()
    return Response(status_code=status.HTTP_204_NO_CONTENT)


@router.post("/projects", response_model=ProjectResponse, status_code=status.HTTP_201_CREATED)
def create_project(request: ProjectInput, session: Session = Depends(get_session)) -> ProjectResponse:
    user = seed_local_user(session)
    profile = _get_or_create_profile(session, user.id)
    project = Project(user_id=user.id, profile_id=profile.id, **request.model_dump())
    session.add(project)
    session.commit()
    session.refresh(project)
    return _project_response(project)


@router.put("/projects/{project_id}", response_model=ProjectResponse)
def update_project(
    project_id: uuid.UUID,
    request: ProjectUpdate,
    session: Session = Depends(get_session),
) -> ProjectResponse:
    user = seed_local_user(session)
    project = _get_user_child(session, Project, user.id, project_id, "Project")
    for field, value in request.model_dump(exclude_unset=True).items():
        setattr(project, field, value)
    session.add(project)
    session.commit()
    session.refresh(project)
    return _project_response(project)


@router.delete("/projects/{project_id}", status_code=status.HTTP_204_NO_CONTENT, response_class=Response)
def delete_project(project_id: uuid.UUID, session: Session = Depends(get_session)) -> Response:
    user = seed_local_user(session)
    project = _get_user_child(session, Project, user.id, project_id, "Project")
    session.delete(project)
    session.commit()
    return Response(status_code=status.HTTP_204_NO_CONTENT)


@router.post("/education", response_model=EducationResponse, status_code=status.HTTP_201_CREATED)
def create_education(request: EducationInput, session: Session = Depends(get_session)) -> EducationResponse:
    user = seed_local_user(session)
    profile = _get_or_create_profile(session, user.id)
    item = Education(user_id=user.id, profile_id=profile.id, **_education_data(request.model_dump()))
    session.add(item)
    session.commit()
    session.refresh(item)
    return _education_response(item)


@router.put("/education/{education_id}", response_model=EducationResponse)
def update_education(
    education_id: uuid.UUID,
    request: EducationUpdate,
    session: Session = Depends(get_session),
) -> EducationResponse:
    user = seed_local_user(session)
    item = _get_user_child(session, Education, user.id, education_id, "Education")
    for field, value in _education_data(request.model_dump(exclude_unset=True)).items():
        setattr(item, field, value)
    session.add(item)
    session.commit()
    session.refresh(item)
    return _education_response(item)


@router.delete("/education/{education_id}", status_code=status.HTTP_204_NO_CONTENT, response_class=Response)
def delete_education(education_id: uuid.UUID, session: Session = Depends(get_session)) -> Response:
    user = seed_local_user(session)
    item = _get_user_child(session, Education, user.id, education_id, "Education")
    session.delete(item)
    session.commit()
    return Response(status_code=status.HTTP_204_NO_CONTENT)


def _get_or_create_profile(session: Session, user_id: uuid.UUID) -> Profile:
    statement = select(Profile).where(Profile.user_id == user_id)
    profile = session.exec(statement).first()
    if profile is not None:
        return profile
    profile = Profile(user_id=user_id)
    session.add(profile)
    session.flush()
    return profile


def _replace_profile_from_parse(
    session: Session,
    profile: Profile,
    user_id: uuid.UUID,
    parsed: CvParseResult,
) -> None:
    for model in (Skill, Experience, Project, Education):
        for row in session.exec(select(model).where(model.user_id == user_id)).all():
            session.delete(row)

    for field in ("full_name", "headline", "seniority", "years_exp", "summary", "locations", "links"):
        setattr(profile, field, getattr(parsed, field))
    profile.updated_at = _now()
    session.add(profile)
    session.flush()

    for item in parsed.skills:
        session.add(
            Skill(
                user_id=user_id,
                profile_id=profile.id,
                name=item.name,
                kind=item.kind,
                level=item.level,
                source=ProfileEntrySource.CV,
            )
        )
    for item in parsed.experiences:
        session.add(
            Experience(
                user_id=user_id,
                profile_id=profile.id,
                title=item.title,
                company=item.company,
                start=parse_profile_date(item.start),
                end=parse_profile_date(item.end),
                is_current=item.is_current,
                summary=item.summary,
                bullets=item.bullets,
                tech=item.tech,
            )
        )
    for item in parsed.projects:
        session.add(
            Project(
                user_id=user_id,
                profile_id=profile.id,
                name=item.name,
                role=item.role,
                summary=item.summary,
                tech=item.tech,
                links=item.links,
            )
        )
    for item in parsed.education:
        session.add(
            Education(
                user_id=user_id,
                profile_id=profile.id,
                degree=item.degree,
                institution=item.institution,
                field_of_study=item.field_of_study,
                start=parse_profile_date(item.start),
                end=parse_profile_date(item.end),
                grade=item.grade,
                summary=item.summary,
            )
        )


def _profile_response(
    session: Session,
    profile: Profile,
    *,
    parse_warning: str | None = None,
) -> ProfileResponse:
    skills = session.exec(select(Skill).where(Skill.profile_id == profile.id).order_by(Skill.name)).all()
    experiences = session.exec(select(Experience).where(Experience.profile_id == profile.id).order_by(Experience.start)).all()
    projects = session.exec(select(Project).where(Project.profile_id == profile.id).order_by(Project.name)).all()
    education = session.exec(select(Education).where(Education.profile_id == profile.id).order_by(Education.start)).all()
    return ProfileResponse(
        id=profile.id,
        full_name=profile.full_name,
        headline=profile.headline,
        seniority=profile.seniority,
        years_exp=profile.years_exp,
        summary=profile.summary,
        locations=profile.locations,
        preferences=profile.preferences,
        brief_defaults=profile.brief_defaults,
        links=profile.links,
        skills=[_skill_response(skill) for skill in skills],
        experiences=[_experience_response(experience) for experience in experiences],
        projects=[_project_response(project) for project in projects],
        education=[_education_response(item) for item in education],
        parse_warning=parse_warning,
    )


def _skill_response(skill: Skill) -> SkillResponse:
    return SkillResponse(id=skill.id, name=skill.name, kind=skill.kind, level=skill.level, source=skill.source)


def _experience_response(experience: Experience) -> ExperienceResponse:
    return ExperienceResponse(
        id=experience.id,
        title=experience.title,
        company=experience.company,
        start=format_profile_date(experience.start),
        end=format_profile_date(experience.end),
        is_current=experience.is_current,
        summary=experience.summary,
        bullets=experience.bullets,
        tech=experience.tech,
    )


def _project_response(project: Project) -> ProjectResponse:
    return ProjectResponse(
        id=project.id,
        name=project.name,
        role=project.role,
        summary=project.summary,
        tech=project.tech,
        links=project.links,
    )


def _education_response(item: Education) -> EducationResponse:
    return EducationResponse(
        id=item.id,
        degree=item.degree,
        institution=item.institution,
        field_of_study=item.field_of_study,
        start=format_profile_date(item.start),
        end=format_profile_date(item.end),
        grade=item.grade,
        summary=item.summary,
    )


def _education_data(data: dict[str, Any]) -> dict[str, Any]:
    parsed = dict(data)
    if "start" in parsed:
        parsed["start"] = parse_profile_date(parsed["start"])
    if "end" in parsed:
        parsed["end"] = parse_profile_date(parsed["end"])
    return parsed


def _experience_data(data: dict[str, Any]) -> dict[str, Any]:
    parsed = dict(data)
    if "start" in parsed:
        parsed["start"] = parse_profile_date(parsed["start"])
    if "end" in parsed:
        parsed["end"] = parse_profile_date(parsed["end"])
    return parsed


def _get_user_child(
    session: Session,
    model: type[Skill] | type[Experience] | type[Project] | type[Education],
    user_id: uuid.UUID,
    row_id: uuid.UUID,
    label: str,
) -> Skill | Experience | Project | Education:
    statement = select(model).where(model.user_id == user_id, model.id == row_id)
    row = session.exec(statement).first()
    if row is None:
        raise HTTPException(status_code=404, detail=f"{label} not found")
    return row


def _now() -> datetime:
    return datetime.now(timezone.utc)
