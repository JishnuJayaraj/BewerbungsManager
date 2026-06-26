from __future__ import annotations

from sqlmodel import Session, SQLModel, func, select

from app.config import Settings
from app.db import create_db_engine
from app.models import Application, Profile, Skill
from app.seed import DEMO_JOB_UUID, seed_demo_data


def test_seed_demo_data_is_idempotent(tmp_path) -> None:
    engine = create_db_engine(Settings(DATABASE_URL=f"sqlite:///{tmp_path / 'seed.db'}"))
    SQLModel.metadata.create_all(engine)

    with Session(engine) as session:
        first = seed_demo_data(session)
        seed_demo_data(session)  # run twice — must not duplicate

    with Session(engine) as session:
        profiles = session.exec(select(func.count()).select_from(Profile)).one()
        skills = session.exec(select(func.count()).select_from(Skill)).one()
        apps = session.exec(select(Application).where(Application.job_uuid == DEMO_JOB_UUID)).all()

    assert profiles == 1
    assert skills == 3
    assert len(apps) == 1
    assert first["demo_job_uuid"] == DEMO_JOB_UUID
