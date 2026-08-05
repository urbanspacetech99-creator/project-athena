from datetime import datetime, timezone

from athena.integrations.token_store import get_oauth_token, save_oauth_token


def test_save_and_get_roundtrip(session):
    row = save_oauth_token(session, "canva", access_token="a2", refresh_token="r2",
                           expires_at=datetime(2026, 8, 1, tzinfo=timezone.utc))
    assert row.refresh_token == "r2"
    again = save_oauth_token(session, "canva", access_token="a3", refresh_token="r3",
                             expires_at=None)
    assert get_oauth_token(session, "canva").access_token == "a3"
    assert again.refresh_token == "r3"
