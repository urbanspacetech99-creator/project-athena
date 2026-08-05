from athena.config import Settings
from athena.db.models import Competitor, CompetitorReview
from athena.jobs.ingestion_jobs import ingest_competitor_reviews


def _add_google_competitor(session, name):
    session.add(Competitor(platform="google", name=name, external_id="", enabled=True))
    session.commit()


def test_reviews_job_ingests_fixture(session):
    # seed_data.COMPETITORS now seeds Extra Space Asia + StorHub as enabled google
    # competitors (Task 8); disable those so this test's own StorHub row is the only
    # enabled google competitor, keeping the "only StorHub" assertion valid.
    session.query(Competitor).filter(Competitor.platform == "google").update({"enabled": False})
    session.commit()
    _add_google_competitor(session, "StorHub")
    res = ingest_competitor_reviews(lambda: session, Settings())
    assert res["reviews"].total > 0
    rows = session.query(CompetitorReview).all()
    assert rows and all(r.competitor == "StorHub" for r in rows)
    assert rows[0].place_rating > 0


def test_reviews_job_ingests_all_google_competitors(session):
    # Unlike the posts job (one representative run per platform in fixture mode), the reviews
    # job iterates every enabled google competitor, so both competitors land review rows.
    _add_google_competitor(session, "Extra Space Asia")
    _add_google_competitor(session, "StorHub")
    res = ingest_competitor_reviews(lambda: session, Settings())
    assert res["reviews"].total > 0
    names = {r.competitor for r in session.query(CompetitorReview).all()}
    assert "Extra Space Asia" in names and "StorHub" in names


def test_reviews_job_skips_when_no_google_competitors(session):
    # seed_data.COMPETITORS now seeds two enabled google competitors (Task 8); disable
    # them so no *enabled* google competitor remains -> nothing to fetch.
    session.query(Competitor).filter(Competitor.platform == "google").update({"enabled": False})
    session.commit()
    res = ingest_competitor_reviews(lambda: session, Settings())
    assert res["reviews"].total == 0
    assert session.query(CompetitorReview).count() == 0
