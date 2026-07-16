from sqlalchemy import create_engine
from sqlalchemy.orm import DeclarativeBase, sessionmaker

from athena.config import Settings


class Base(DeclarativeBase):
    pass


def make_engine(settings: Settings | None = None):
    settings = settings or Settings()
    # active_database_url() routes to the fixture DB in fixture mode so live and fixture
    # data never share tables (falls back to database_url when no fixture DB is configured).
    return create_engine(settings.active_database_url(), pool_pre_ping=True)


def make_session_factory(engine=None):
    return sessionmaker(bind=engine or make_engine())
