from datetime import datetime, timedelta, timezone

import pytest

from athena.config import Settings
from athena.integrations.canva import CanvaConnectClient
from athena.integrations.token_store import get_oauth_token, save_oauth_token


@pytest.fixture
def canva_settings():
    return Settings(canva_mode="live", canva_client_id="cid", canva_client_secret="csec",
                    canva_access_token="env-token", canva_refresh_token="env-refresh")


def test_refresh_when_expired(session, canva_settings, monkeypatch):
    save_oauth_token(session, "canva", access_token="old", refresh_token="rot-1",
                     expires_at=datetime.now(timezone.utc) - timedelta(minutes=1))
    calls = {}

    class FakeResp:
        status_code = 200
        def raise_for_status(self): pass
        def json(self):
            return {"access_token": "new", "refresh_token": "rot-2",
                    "token_type": "Bearer", "expires_in": 14400}

    def fake_post(url, **kwargs):
        calls["url"] = url
        calls["data"] = kwargs.get("data")
        calls["auth"] = kwargs.get("auth")
        return FakeResp()

    import httpx
    monkeypatch.setattr(httpx, "post", fake_post)
    client = CanvaConnectClient(canva_settings, session_factory=lambda: session)
    token = client._access_token()
    assert token == "new"
    assert calls["url"].endswith("/oauth/token")
    assert calls["data"]["refresh_token"] == "rot-1"
    assert calls["auth"] == ("cid", "csec")         # HTTP Basic per Canva docs
    stored = get_oauth_token(session, "canva")
    assert stored.refresh_token == "rot-2"          # rotation persisted
    assert stored.expires_at is not None


def test_refresh_when_expiry_unknown(session, canva_settings, monkeypatch):
    """The env-seeded row has expires_at=None: its remaining life is unknowable, so the
    first live call must refresh (and persist a real expiry) rather than 401 hours later."""
    save_oauth_token(session, "canva", access_token="seeded", refresh_token="rot-1",
                     expires_at=None)

    class FakeResp:
        status_code = 200
        def raise_for_status(self): pass
        def json(self):
            return {"access_token": "new", "refresh_token": "rot-2",
                    "token_type": "Bearer", "expires_in": 14400}

    import httpx
    monkeypatch.setattr(httpx, "post", lambda url, **kwargs: FakeResp())
    client = CanvaConnectClient(canva_settings, session_factory=lambda: session)
    assert client._access_token() == "new"
    stored = get_oauth_token(session, "canva")
    assert stored.refresh_token == "rot-2"
    assert stored.expires_at is not None            # real expiry persisted


def test_refresh_failure_raises_and_does_not_persist(session, canva_settings, monkeypatch):
    import httpx

    save_oauth_token(session, "canva", access_token="old", refresh_token="rot-1",
                     expires_at=datetime.now(timezone.utc) - timedelta(minutes=1))

    def fake_post(url, **kwargs):
        return httpx.Response(400, json={"error": "invalid_grant",
                                         "error_description": "refresh token revoked"},
                              request=httpx.Request("POST", url))

    monkeypatch.setattr(httpx, "post", fake_post)
    client = CanvaConnectClient(canva_settings, session_factory=lambda: session)
    with pytest.raises(httpx.HTTPStatusError):
        client._access_token()
    stored = get_oauth_token(session, "canva")
    assert stored.access_token == "old"             # nothing persisted on failure
    assert stored.refresh_token == "rot-1"


def test_concurrent_refresh_recheck_sees_fresh_tokens(session, canva_settings, monkeypatch):
    """Another worker refreshes between our staleness check and our taking the row lock:
    the under-lock re-read must repopulate the instance from the DB (the identity map
    would otherwise return the already-loaded STALE attributes) and use the fresh token
    instead of consuming the already-spent refresh token."""
    from sqlalchemy.orm import sessionmaker

    save_oauth_token(session, "canva", access_token="stale", refresh_token="dead",
                     expires_at=datetime.now(timezone.utc) - timedelta(minutes=1))
    # Prime this session's identity map with the expired row, as _access_token's
    # first (unlocked) read does. Keep a strong reference: the identity map is weak,
    # so without one the instance is GC'd and the scenario silently evaporates.
    primed = get_oauth_token(session, "canva")
    assert primed.access_token == "stale"

    # Simulate another worker's completed refresh through a second session.
    other = sessionmaker(bind=session.get_bind())()
    try:
        save_oauth_token(other, "canva", access_token="fresh", refresh_token="rot-next",
                         expires_at=datetime.now(timezone.utc) + timedelta(hours=4))
    finally:
        other.close()

    import httpx
    monkeypatch.setattr(httpx, "post", lambda *a, **k: pytest.fail("must not refresh"))
    client = CanvaConnectClient(canva_settings, session_factory=lambda: session)
    assert client._access_token() == "fresh"


def test_valid_token_not_refreshed(session, canva_settings, monkeypatch):
    save_oauth_token(session, "canva", access_token="good", refresh_token="rot-1",
                     expires_at=datetime.now(timezone.utc) + timedelta(hours=3))
    import httpx
    monkeypatch.setattr(httpx, "post",
                        lambda *a, **k: pytest.fail("should not call the token endpoint"))
    client = CanvaConnectClient(canva_settings, session_factory=lambda: session)
    assert client._access_token() == "good"


def test_env_fallback_without_db_row(session, canva_settings):
    row = get_oauth_token(session, "canva")
    if row is not None:
        session.delete(row)
        session.commit()
    client = CanvaConnectClient(canva_settings, session_factory=lambda: session)
    assert client._access_token() == "env-token"
