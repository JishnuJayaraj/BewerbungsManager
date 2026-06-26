"""Demo seed data so a fresh clone has something to look at (Task 17).

Idempotent: running it twice will not duplicate the demo profile or application.
Run with ``python -m app.seed`` (uses DATABASE_URL from the environment / .env).
"""

from __future__ import annotations

from datetime import date, datetime, timezone

from sqlmodel import Session, select

from app.db import create_db_engine, seed_local_user
from app.models import (
    Application,
    ApplicationBrief,
    BriefLanguage,
    CommsDirection,
    CommsKind,
    CommsLogEntry,
    Experience,
    PackageChecklist,
    Profile,
    ProfileEntrySource,
    Project,
    Skill,
    SkillKind,
    WorkPermitStatus,
    default_package_items,
)

DEMO_JOB_UUID = "demo-senior-python-engineer"

DEMO_JOB_SNAPSHOT = {
    "uuid": DEMO_JOB_UUID,
    "company": "Beispiel GmbH",
    "companyCleaned": "Beispiel GmbH",
    "text": {
        "title": "Senior Python Engineer",
        "fulltext": "We are hiring a Senior Python Engineer for our platform team. Python, "
        "distributed systems, AWS. German C1 required.",
        "requirements": ["Python", "Distributed systems", "AWS", "German C1"],
        "tasks": ["Design backend services", "Own platform reliability"],
        "benefits": ["Remote-friendly", "Relocation support"],
    },
    "addresses": [{"place": "Berlin", "country": "DE", "zipCode": "10115"}],
    "classifications": {
        "companyType": "COMPANY",
        "employmentTypes": ["FULL_TIME"],
        "jobTypes": ["OCCUPATION"],
        "occupationAreas": ["IT"],
        "itSkills": [{"text": "Python"}, {"text": "AWS"}],
    },
    "counterpart": {"firstName": "Maria", "lastName": "Schmidt", "role": "HR", "email": "jobs@beispiel.de"},
}


def seed_demo_data(session: Session) -> dict[str, str]:
    """Create the demo profile + application if they don't already exist."""
    user = seed_local_user(session)

    profile = session.exec(select(Profile).where(Profile.user_id == user.id)).first()
    if profile is None:
        profile = Profile(
            user_id=user.id,
            full_name="Ada Lovelace",
            headline="Senior Backend / Platform Engineer",
            seniority="senior",
            years_exp=8,
            summary="Backend engineer focused on Python platforms and distributed systems.",
            locations=[{"place": "Berlin", "lat": 52.52, "lon": 13.405, "radius_km": 50}],
            preferences={"employment_types": ["FULL_TIME"], "occupation_areas": ["IT"], "remote": True},
            brief_defaults={"tone": "direct, professional", "language": "DE", "target_angle": "Backend/platform engineer"},
        )
        session.add(profile)
        session.flush()
        session.add_all(
            [
                Skill(user_id=user.id, profile_id=profile.id, name="Python", kind=SkillKind.IT_SKILL, level="expert", source=ProfileEntrySource.CV),
                Skill(user_id=user.id, profile_id=profile.id, name="AWS", kind=SkillKind.IT_SKILL, level="advanced", source=ProfileEntrySource.CV),
                Skill(user_id=user.id, profile_id=profile.id, name="German", kind=SkillKind.LANGUAGE, level="B2", source=ProfileEntrySource.MANUAL),
                Experience(
                    user_id=user.id,
                    profile_id=profile.id,
                    title="Backend Engineer",
                    company="ACME",
                    start=date(2019, 1, 1),
                    is_current=True,
                    summary="Owned core backend services.",
                    bullets=["Built Python APIs serving 2M requests/day.", "Led migration to event-driven architecture."],
                    tech=["Python", "AWS", "PostgreSQL"],
                ),
                Project(
                    user_id=user.id,
                    profile_id=profile.id,
                    name="JobCraft",
                    role="Creator",
                    summary="Application-package tooling for the German market.",
                    tech=["Python", "FastAPI", "React"],
                ),
            ]
        )

    application = session.exec(
        select(Application).where(Application.user_id == user.id, Application.job_uuid == DEMO_JOB_UUID)
    ).first()
    if application is None:
        application = Application(
            user_id=user.id,
            job_uuid=DEMO_JOB_UUID,
            job_snapshot=DEMO_JOB_SNAPSHOT,
            job_title="Senior Python Engineer",
            company="Beispiel GmbH",
            contact=DEMO_JOB_SNAPSHOT["counterpart"],
            next_action="Tailor cover letter and apply",
            followup_date=date(2026, 7, 10),
        )
        session.add(application)
        session.flush()
        session.add(
            ApplicationBrief(
                user_id=user.id,
                application_id=application.id,
                target_angle="Backend/platform engineer, not a full-stack generalist",
                avoid="Do not overstate Kubernetes experience",
                tone="direct, professional",
                language=BriefLanguage.DE,
                company_motivation="Mission of helping people find work; strong platform team.",
            )
        )
        session.add(
            PackageChecklist(
                user_id=user.id,
                application_id=application.id,
                salary_expectation="80.000 EUR",
                earliest_start_date=date(2026, 9, 1),
                language_level_required="C1",
                language_level_user="B2",
                work_permit_status=WorkPermitStatus.EU_CITIZEN,
                cover_letter_required=True,
                items=default_package_items(),
            )
        )
        session.add(
            CommsLogEntry(
                user_id=user.id,
                application_id=application.id,
                kind=CommsKind.NOTE,
                occurred_at=datetime(2026, 6, 26, 9, 0, tzinfo=timezone.utc),
                subject="Saved from search",
                body="Looks like a strong Python platform role; German C1 is the gap to address.",
                direction=CommsDirection.NONE,
            )
        )

    session.commit()
    return {"user_id": str(user.id), "demo_job_uuid": DEMO_JOB_UUID}


def main() -> None:
    engine = create_db_engine()
    with Session(engine) as session:
        result = seed_demo_data(session)
    print(f"Seeded demo data: profile + application ({result['demo_job_uuid']}).")


if __name__ == "__main__":
    main()
