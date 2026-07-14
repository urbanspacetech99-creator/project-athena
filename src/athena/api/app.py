import asyncio
from contextlib import asynccontextmanager

from fastapi import FastAPI

from athena.config import Settings
from athena.logging_setup import configure_logging, get_logger


def create_app(settings: Settings | None = None) -> FastAPI:
    settings = settings or Settings()
    configure_logging(settings.log_level)
    log = get_logger("athena.api")

    @asynccontextmanager
    async def lifespan(_app: FastAPI):
        if settings.db_auto_create:
            from athena.db.bootstrap import bootstrap_database
            try:
                # run the blocking DB work off the event loop
                await asyncio.to_thread(bootstrap_database, settings)
            except Exception:
                log.exception("database bootstrap failed")
                raise
        yield

    app = FastAPI(title="Athena AI Marketing Pipeline", lifespan=lifespan)

    @app.get("/health")
    def health() -> dict[str, str]:
        log.info("health check", extra={"endpoint": "/health"})
        return {"status": "ok"}

    from athena.api.routes_data import router as data_router
    from athena.api.routes_ingest import router as ingest_router
    from athena.api.routes_home import router as home_router
    from athena.api.routes_research import router as research_router
    app.include_router(data_router)
    app.include_router(ingest_router)
    app.include_router(home_router)
    app.include_router(research_router)

    from athena.api.routes_generate import router as generate_router
    app.include_router(generate_router)

    from athena.api.routes_config import router as config_router
    app.include_router(config_router)

    from pathlib import Path

    # The empty-string check matters: Path("") is the CWD and is_dir() is True,
    # which would mount the entire working directory at "/".
    dist = Path(settings.frontend_dist)
    if settings.frontend_dist and dist.is_dir():
        from fastapi.staticfiles import StaticFiles
        # Mounted last so every API route above takes priority — add new routers ABOVE this block.
        app.mount("/", StaticFiles(directory=dist, html=True), name="dashboard")
        log.info("serving dashboard", extra={"dist": str(dist)})

    return app


app = create_app()
