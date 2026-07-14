from athena.worker.scheduler import JobRegistry
from athena.jobs.ingestion_jobs import register_all
from athena.db.base import make_session_factory
from athena.config import Settings


def test_register_all_registers_five_jobs():
    reg = JobRegistry()
    register_all(reg, make_session_factory(), Settings())
    assert set(reg.names()) == {
        "ingest_meta_posts", "ingest_competitor_posts", "ingest_google_reviews",
        "ingest_keyword_volumes", "ingest_zoho_chats",
    }


def test_registered_jobs_are_callable_zero_arg():
    reg = JobRegistry()
    register_all(reg, make_session_factory(), Settings())
    # each registered job is a no-arg callable bound to (session_factory, settings)
    fn, cron = reg._jobs["ingest_keyword_volumes"]
    assert callable(fn)
    assert cron == "0 4 * * 1"
