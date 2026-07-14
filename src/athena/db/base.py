from sqlalchemy import create_engine
from sqlalchemy.orm import DeclarativeBase, sessionmaker

from athena.config import Settings


class Base(DeclarativeBase):
    pass


def make_engine(settings: Settings | None = None):
    settings = settings or Settings()
    return create_engine(settings.database_url, pool_pre_ping=True)


def make_session_factory(engine=None):
    return sessionmaker(bind=engine or make_engine())
