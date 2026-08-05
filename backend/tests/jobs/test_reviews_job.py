from athena.config import Settings
from athena.db.models import GoogleReview
from athena.jobs.ingestion_jobs import ingest_google_reviews


def test_ingest_google_reviews_populates_db(session):
    res = ingest_google_reviews(lambda: session, Settings())
    assert res.total == 13
    assert session.query(GoogleReview).count() == res.total
