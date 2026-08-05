"""Integration tests for automatic database + schema provisioning.

Uses the session-scoped `pg_url` testcontainer; each test provisions its own
uniquely-named database and drops it afterwards, so they stay isolated.
"""
from sqlalchemy import create_engine, inspect, text
from sqlalchemy.engine import make_url

from athena.config import Settings
from athena.db.bootstrap import bootstrap_database, ensure_database, ensure_schema

HEAD = "0006_competitor_reviews"


def _settings_for(pg_url: str, dbname: str) -> Settings:
    # render_as_string(hide_password=False): str(URL) masks the password as '***'.
    url = make_url(pg_url).set(database=dbname).render_as_string(hide_password=False)
    return Settings(database_url=url, db_auto_create=True)


def _drop(pg_url: str, dbname: str) -> None:
    admin = create_engine(make_url(pg_url).set(database="postgres"), isolation_level="AUTOCOMMIT")
    try:
        with admin.connect() as conn:
            conn.execute(text(f'DROP DATABASE IF EXISTS "{dbname}" WITH (FORCE)'))
    finally:
        admin.dispose()


def test_ensure_database_creates_then_is_idempotent(pg_url):
    dbname = "athena_bootstrap_it"
    _drop(pg_url, dbname)
    settings = _settings_for(pg_url, dbname)
    try:
        assert ensure_database(settings) is True   # did not exist -> created
        assert ensure_database(settings) is False  # now exists -> no-op
    finally:
        _drop(pg_url, dbname)


def test_ensure_schema_brings_new_db_to_head(pg_url):
    dbname = "athena_schema_it"
    _drop(pg_url, dbname)
    settings = _settings_for(pg_url, dbname)
    try:
        ensure_database(settings)
        ensure_schema(settings)
        engine = create_engine(settings.database_url)
        try:
            tables = set(inspect(engine).get_table_names())
            assert {"own_posts", "zoho_chats", "generated_posts", "alembic_version"} <= tables
            with engine.connect() as conn:
                version = conn.execute(text("SELECT version_num FROM alembic_version")).scalar_one()
            assert version == HEAD
        finally:
            engine.dispose()
    finally:
        _drop(pg_url, dbname)


def test_bootstrap_provisions_fixture_db_too(pg_url):
    live_db, fix_db = "athena_bootstrap_live", "athena_bootstrap_fix"
    _drop(pg_url, live_db)
    _drop(pg_url, fix_db)
    live_url = make_url(pg_url).set(database=live_db).render_as_string(hide_password=False)
    fix_url = make_url(pg_url).set(database=fix_db).render_as_string(hide_password=False)
    settings = Settings(database_url=live_url, fixture_database_url=fix_url,
                        source_mode="live", db_auto_create=True)
    try:
        bootstrap_database(settings)
        for url in (live_url, fix_url):
            engine = create_engine(url)
            try:
                tables = set(inspect(engine).get_table_names())
                assert {"own_posts", "zoho_chats", "competitors"} <= tables
                # seed ran on both -> config tables populated
                with engine.connect() as conn:
                    assert conn.execute(text("SELECT count(*) FROM competitors")).scalar() > 0
            finally:
                engine.dispose()
    finally:
        _drop(pg_url, live_db)
        _drop(pg_url, fix_db)


def test_bootstrap_database_end_to_end_and_idempotent(pg_url):
    dbname = "athena_bootstrap_e2e"
    _drop(pg_url, dbname)
    settings = _settings_for(pg_url, dbname)
    try:
        assert bootstrap_database(settings) is True   # created db + migrated
        assert bootstrap_database(settings) is False  # second run: nothing created, still fine
        engine = create_engine(settings.database_url)
        try:
            assert "own_posts" in inspect(engine).get_table_names()
        finally:
            engine.dispose()
    finally:
        _drop(pg_url, dbname)
