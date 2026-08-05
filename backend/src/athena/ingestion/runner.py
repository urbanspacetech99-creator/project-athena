from dataclasses import dataclass
from typing import Any

from sqlalchemy import text
from sqlalchemy.dialects.postgresql import insert as pg_insert
from sqlalchemy.orm import Session

from athena.adapters.base import SourceAdapter
from athena.logging_setup import get_logger

log = get_logger("athena.ingestion")


@dataclass
class IngestResult:
    source: str
    inserted: int
    updated: int

    @property
    def total(self) -> int:
        return self.inserted + self.updated


def upsert_rows(session, model, rows, conflict) -> tuple[int, int]:
    """Upsert rows; return (inserted, updated). Caller commits."""
    inserted = updated = 0
    for values in rows:
        update_cols = {k: v for k, v in values.items() if k not in conflict}
        stmt = (
            pg_insert(model)
            .values(**values)
            .on_conflict_do_update(index_elements=list(conflict), set_=update_cols)
            .returning(text("(xmax = 0) AS inserted"))
        )
        if session.execute(stmt).scalar():
            inserted += 1
        else:
            updated += 1
    return inserted, updated


def run_ingestion(
    adapter: SourceAdapter,
    session: Session,
    model: type,
    conflict: tuple[str, ...],
    **fetch_kwargs: Any,
) -> IngestResult:
    log.info("ingest start", extra={"source": adapter.source, "mode": adapter.mode,
                                    "model": model.__tablename__})
    rows = adapter.fetch_normalized(**fetch_kwargs)
    inserted, updated = upsert_rows(session, model, rows, conflict)
    session.commit()
    log.info("ingest finish", extra={"source": adapter.source, "rows": len(rows),
                                     "inserted": inserted, "updated": updated})
    return IngestResult(source=adapter.source, inserted=inserted, updated=updated)
