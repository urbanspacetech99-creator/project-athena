from collections.abc import Callable, Iterator

from fastapi import Depends
from sqlalchemy.orm import Session

from athena.config import Settings
from athena.db.base import make_session_factory


def get_settings() -> Settings:
    return Settings()


def get_session_factory() -> Callable[[], Session]:
    return make_session_factory()


def get_session(factory: Callable[[], Session] = Depends(get_session_factory)) -> Iterator[Session]:
    session = factory()
    try:
        yield session
    finally:
        session.close()


def get_llm(settings: Settings = Depends(get_settings)):
    from athena.ai.llm import get_llm as _get_llm
    return _get_llm(settings)


def get_image_client(settings: Settings = Depends(get_settings)):
    from athena.ai.images import get_image_client as _f
    return _f(settings)


def get_canva_client(settings: Settings = Depends(get_settings),
                     factory: Callable[[], Session] = Depends(get_session_factory)):
    from athena.integrations.canva import get_canva_client as _f
    return _f(settings, factory)
