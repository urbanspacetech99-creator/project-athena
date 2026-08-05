from athena.config import Settings
from athena.db.models import OwnPost, PostComment
from athena.jobs.ingestion_jobs import ingest_meta_posts


def test_ingest_meta_posts_populates_db(session):
    settings = Settings()  # SOURCE_MODE defaults to fixture
    res = ingest_meta_posts(lambda: session, settings)
    assert res["posts"].total == 26      # 14 FB + 12 IG
    assert session.query(OwnPost).count() == res["posts"].total
    assert session.query(PostComment).count() == res["comments"].total == 14
