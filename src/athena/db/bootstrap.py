"""Automatic database + schema provisioning.

On startup the app ensures its target Postgres database exists and its schema is
migrated to head, so a fresh server (local, container, or a brand-new remote DB)
works with no manual ``createdb`` / ``alembic upgrade`` step. Gated by
``Settings.db_auto_create``.

The two steps are independent and each idempotent:

* :func:`ensure_database` connects to the target DB; only if that fails with
  "database does not exist" does it connect to the ``postgres`` maintenance
  database and issue ``CREATE DATABASE``.
* :func:`ensure_schema` runs the Alembic migrations up to head.
"""
from __future__ import annotations

from pathlib import Path

from sqlalchemy import create_engine, text
from sqlalchemy.engine import make_url
from sqlalchemy.exc import OperationalError

from athena.config import Settings
from athena.logging_setup import get_logger

log = get_logger("athena.db.bootstrap")

# repo root: .../src/athena/db/bootstrap.py -> parents[3] == repo root
_MIGRATIONS = Path(__file__).resolve().parents[3] / "migrations"
_CONNECT_TIMEOUT = 10


def _is_missing_database(err: OperationalError, dbname: str) -> bool:
    """True if the error is Postgres 'database does not exist' (SQLSTATE 3D000)."""
    orig = getattr(err, "orig", None)
    if getattr(orig, "sqlstate", None) == "3D000":
        return True
    msg = str(err)
    return f'database "{dbname}"' in msg and "does not exist" in msg


def ensure_database(settings: Settings, *, timeout: int = _CONNECT_TIMEOUT) -> bool:
    """Create the target database if it does not exist.

    Returns ``True`` if it was created, ``False`` if it already existed. Raises
    if the server is unreachable for any reason other than a missing database
    (e.g. bad credentials, or the app user cannot ``CREATE DATABASE``).
    """
    url = make_url(settings.database_url)
    dbname = url.database
    if not dbname:
        raise ValueError("DATABASE_URL has no database name")

    probe = create_engine(url, connect_args={"connect_timeout": timeout})
    try:
        with probe.connect():
            return False  # target already reachable
    except OperationalError as err:
        if not _is_missing_database(err, dbname):
            raise
    finally:
        probe.dispose()

    # Connect to the maintenance DB to create the target. CREATE DATABASE cannot
    # run inside a transaction, so use AUTOCOMMIT. Query params (e.g. sslmode)
    # carry over from the original URL.
    admin = create_engine(
        url.set(database="postgres"),
        isolation_level="AUTOCOMMIT",
        connect_args={"connect_timeout": timeout},
    )
    try:
        with admin.connect() as conn:
            exists = conn.execute(
                text("SELECT 1 FROM pg_database WHERE datname = :n"), {"n": dbname}
            ).scalar()
            if exists:
                return False
            # A database identifier cannot be parameterized; quote it defensively.
            conn.execute(text(f'CREATE DATABASE "{dbname}"'))
        log.info("created database", extra={"database": dbname})
        return True
    finally:
        admin.dispose()


def ensure_schema(settings: Settings) -> None:
    """Run Alembic migrations up to head against the target database (idempotent)."""
    from alembic import command
    from alembic.config import Config

    cfg = Config()
    cfg.set_main_option("script_location", str(_MIGRATIONS))
    cfg.set_main_option("sqlalchemy.url", settings.database_url)
    command.upgrade(cfg, "head")
    log.info("schema migrated to head")


def bootstrap_database(settings: Settings | None = None) -> bool:
    """Ensure the database exists and its schema is at head. Safe to call repeatedly.

    Returns whether the database itself was created on this call.
    """
    settings = settings or Settings()
    created = ensure_database(settings)
    ensure_schema(settings)

    from sqlalchemy.orm import Session as _Session

    from athena.db.seed import seed_defaults
    engine = create_engine(settings.database_url)
    try:
        with _Session(engine) as session:
            seed_defaults(session, settings)
    finally:
        engine.dispose()

    # NB: 'created' is a reserved LogRecord attribute — use a distinct key.
    log.info(
        "database bootstrap complete",
        extra={"database": make_url(settings.database_url).database, "db_created": created},
    )
    return created


if __name__ == "__main__":  # manual escape hatch: `python -m athena.db.bootstrap`
    settings = Settings()
    from athena.logging_setup import configure_logging

    configure_logging(settings.log_level)
    bootstrap_database(settings)
