import threading

from sqlalchemy import create_engine
from sqlalchemy.engine import Engine
from sqlalchemy.orm import DeclarativeBase, Session, sessionmaker
from sqlalchemy.sql.util import find_tables

from athena.config import KNOWN_SOURCES, Settings


class Base(DeclarativeBase):
    pass


# Sourced tables by table name -> owning source. Keyed by name (not model class)
# because models.py imports Base from this module. test_routed_session guards the
# map against drifting from the actual metadata.
SOURCE_TABLES = {
    "own_posts": "meta",
    "post_comments": "meta",
    "competitor_posts": "meta",
    "competitor_comments": "meta",
    "google_reviews": "google_reviews",
    "competitor_reviews": "google_places",
    "keyword_volumes": "google_ads",
    "zoho_chats": "zoho",
}

# One engine (connection pool) per distinct URL, shared across factories. The lock
# keeps concurrent first requests from minting two engines for one URL — routing
# compares engines by identity, so duplicates would spuriously split same-DB commits.
_engines: dict[str, Engine] = {}
_engines_lock = threading.Lock()


def _engine_for_url(url: str) -> Engine:
    with _engines_lock:
        engine = _engines.get(url)
        if engine is None:
            engine = _engines[url] = create_engine(url, pool_pre_ping=True)
        return engine


class RoutedSession(Session):
    """Session that binds each sourced table to the DB its source's effective mode
    selects (Settings.database_url_for); everything else — config/app tables, raw
    SQL — uses the default bind. Only sources whose DB differs from the default
    appear in ``engines_by_source``, so a single-DB config degenerates to plain
    Session behavior. This is what serves live and fixture data side by side while
    each database holds only its own kind of rows."""

    def __init__(self, *args, engines_by_source: dict[str, Engine] | None = None, **kwargs):
        super().__init__(*args, **kwargs)
        self._engines_by_source = engines_by_source or {}

    def get_bind(self, mapper=None, clause=None, **kw):
        if self._engines_by_source:
            # Resolve via the mapper when present; clause inspection covers
            # column-only queries and insert/update statements (include_crud).
            tables: set[str] = set()
            if mapper is not None:
                tables.add(mapper.local_table.name)
            if clause is not None:
                # check_columns yields None for table-less columns (e.g. count(*)).
                tables.update(t.name for t in
                              find_tables(clause, check_columns=True, include_crud=True)
                              if t is not None)
            sources = {SOURCE_TABLES[t] for t in tables if t in SOURCE_TABLES}
            if len(sources) == 1:
                engine = self._engines_by_source.get(sources.pop())
                if engine is not None:
                    return engine
        return super().get_bind(mapper=mapper, clause=clause, **kw)


def make_engine(settings: Settings | None = None):
    settings = settings or Settings()
    # active_database_url() is the config-table / default bind; sourced tables are
    # routed per source by make_session_factory.
    return _engine_for_url(settings.active_database_url())


def make_session_factory(engine=None, settings: Settings | None = None):
    """Routed session factory. Passing an explicit `engine` returns a plain
    (unrouted) factory bound to it, for tests and scripts that target one DB."""
    if engine is not None:
        return sessionmaker(bind=engine)
    settings = settings or Settings()
    default = make_engine(settings)
    routed = {source: eng for source in KNOWN_SOURCES
              if (eng := _engine_for_url(settings.database_url_for(source))) is not default}
    return sessionmaker(class_=RoutedSession, bind=default, engines_by_source=routed)
