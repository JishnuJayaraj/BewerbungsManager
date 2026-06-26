from sqlmodel import Session, SQLModel

from app.config import Settings
from app.db import create_db_engine, local_user_exists, seed_local_user
from app.models import (
    LOCAL_USER_ID,
    ArtifactKind,
    PackageChecklist,
    RequirementStatus,
    default_package_items,
)


def test_enums_include_reconciled_artifact_and_requirement_values() -> None:
    assert ArtifactKind.PORTAL_ANSWER.value == "PORTAL_ANSWER"
    assert ArtifactKind.ANSWER_DRAFT.value == "ANSWER_DRAFT"
    assert RequirementStatus.HAVE.value == "HAVE"
    assert RequirementStatus.PARTIAL.value == "PARTIAL"
    assert RequirementStatus.MISSING.value == "MISSING"


def test_package_checklist_default_items_are_germany_specific_keys() -> None:
    checklist = PackageChecklist(user_id=LOCAL_USER_ID, application_id=LOCAL_USER_ID)

    assert checklist.items == default_package_items()
    assert set(checklist.items) == {
        "cv_reviewed",
        "cover_letter",
        "requirements_checked",
        "salary_set",
        "start_date_set",
        "language_ok",
        "work_permit_ok",
        "certificates",
        "portal_answers",
        "submitted",
        "followup_set",
    }


def test_seed_local_user_creates_fixed_single_user(tmp_path) -> None:
    database_url = f"sqlite:///{tmp_path / 'jobcraft-test.db'}"
    engine = create_db_engine(Settings(DATABASE_URL=database_url))
    SQLModel.metadata.create_all(engine)

    with Session(engine) as session:
        user = seed_local_user(session)

        assert user.id == LOCAL_USER_ID
        assert local_user_exists(session) is True
