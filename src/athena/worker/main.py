import time

from athena.config import Settings
from athena.logging_setup import configure_logging, get_logger
from athena.worker.scheduler import JobRegistry, build_scheduler

registry = JobRegistry()
# Plan 2 registers ingestion jobs on `registry`.


def main() -> None:
    from athena.db.base import make_session_factory
    from athena.jobs.ingestion_jobs import register_all

    settings = Settings()
    configure_logging(settings.log_level)
    log = get_logger("athena.worker")
    if settings.db_auto_create:
        from athena.db.bootstrap import bootstrap_database
        bootstrap_database(settings)
    register_all(registry, make_session_factory(), settings)
    log.info("worker starting", extra={"jobs": registry.names()})
    build_scheduler(registry, start=True)
    while True:
        time.sleep(60)


if __name__ == "__main__":
    main()
