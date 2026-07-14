from athena.config import Settings
from athena.db.models import KeywordVolume
from athena.jobs.ingestion_jobs import ingest_keyword_volumes


def test_ingest_keyword_volumes_populates_db(session):
    res = ingest_keyword_volumes(lambda: session, Settings())
    # fixture mode ignores the enabled-keyword filter and ingests every fixture
    # result row (one per seeded keyword in seed_data.KEYWORDS).
    assert res.total == 10
    assert session.query(KeywordVolume).count() == res.total
