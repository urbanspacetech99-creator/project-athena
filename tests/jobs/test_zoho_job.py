from athena.config import Settings
from athena.db.models import ZohoChat
from athena.jobs.ingestion_jobs import ingest_zoho_chats


def test_ingest_zoho_chats_populates_db(session):
    res = ingest_zoho_chats(lambda: session, Settings())
    assert res.total == 12
    assert session.query(ZohoChat).count() == res.total
