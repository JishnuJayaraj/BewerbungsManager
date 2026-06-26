from collections.abc import Generator
from urllib.parse import urlparse

from sqlmodel import Session, create_engine, select

from app.config import Settings, get_settings
from app.models import LOCAL_USER_EMAIL, LOCAL_USER_ID, User


def create_db_engine(settings: Settings | None = None):
    app_settings = settings or get_settings()
    connect_args = {"check_same_thread": False} if _is_sqlite_url(app_settings.database_url) else {}
    return create_engine(app_settings.database_url, connect_args=connect_args)


def get_local_user_id(settings: Settings | None = None):
    app_settings = settings or get_settings()
    if not app_settings.single_user:
        raise RuntimeError("Local user is only available when SINGLE_USER=true")
    return LOCAL_USER_ID


def seed_local_user(session: Session) -> User:
    user = session.get(User, LOCAL_USER_ID)
    if user is not None:
        return user

    user = User(id=LOCAL_USER_ID, email=LOCAL_USER_EMAIL)
    session.add(user)
    session.commit()
    session.refresh(user)
    return user


def local_user_exists(session: Session) -> bool:
    statement = select(User).where(User.id == LOCAL_USER_ID)
    return session.exec(statement).first() is not None


def _is_sqlite_url(database_url: str) -> bool:
    parsed = urlparse(database_url)
    return parsed.scheme.startswith("sqlite")


engine = create_db_engine()


def get_session() -> Generator[Session, None, None]:
    with Session(engine) as session:
        yield session
