from datetime import datetime, timezone

from athena.config import Settings
from athena.db.models import Competitor, CompetitorPost
from athena.jobs.ingestion_jobs import ingest_competitor_posts


def test_competitor_job_ingests_both_platforms(session):
    res = ingest_competitor_posts(lambda: session, Settings())
    assert res["posts"].total > 0
    platforms = {p.platform for p in session.query(CompetitorPost).all()}
    assert platforms == {"facebook", "instagram"}


def test_competitor_job_skips_disabled_rows(session):
    for c in session.query(Competitor).all():
        c.enabled = False
    session.commit()
    res = ingest_competitor_posts(lambda: session, Settings())
    assert res["posts"].total == 0


def test_competitor_job_isolates_failing_competitor(session, monkeypatch):
    from athena.adapters.meta import MetaIGCompetitorAdapter

    def boom(self, **kwargs):
        raise RuntimeError("ig blew up")

    monkeypatch.setattr(MetaIGCompetitorAdapter, "fetch_normalized", boom)
    res = ingest_competitor_posts(lambda: session, Settings())
    # the other platform's rows still landed, and counts reflect the survivor only
    platforms = {p.platform for p in session.query(CompetitorPost).all()}
    assert platforms == {"facebook"}
    assert res["posts"].total == session.query(CompetitorPost).count() > 0
    # failing competitor surfaced; session still usable after the failure
    failed_names = {c.name for c in session.query(Competitor)
                    .filter(Competitor.platform == "instagram").all()}
    assert len(res["failed"]) == 1 and res["failed"][0] in failed_names


def test_competitor_job_isolates_db_failure(session, monkeypatch):
    """A row that fails the DB write (NOT NULL/unique violation inside upsert_rows) must be
    isolated the same way an adapter-level exception is: the failing competitor is skipped,
    the other platform still lands, and the job's final commit does not raise."""
    from athena.adapters.meta import MetaCompetitorAdapter

    def bad_normalize(self, raw):
        return [{"source_id": None, "competitor": "X", "platform": "facebook",
                 "text": "boom", "window_date": datetime.now(timezone.utc)}]

    monkeypatch.setattr(MetaCompetitorAdapter, "normalize", bad_normalize)
    res = ingest_competitor_posts(lambda: session, Settings())
    platforms = {p.platform for p in session.query(CompetitorPost).all()}
    assert platforms == {"instagram"}
    assert len(res["failed"]) == 1
