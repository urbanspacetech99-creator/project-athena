import base64
import json
from typing import Protocol

from pydantic import BaseModel

from athena.ai.images import GeneratedImage
from athena.config import Settings
from athena.logging_setup import get_logger

log = get_logger("athena.integrations.canva")

CANVA_BASE = "https://api.canva.com/rest/v1"
_REFRESH_BUFFER_S = 300  # refresh when <5 min of validity remains


class CanvaHandoff(BaseModel):
    asset_id: str
    edit_url: str


class CanvaClient(Protocol):
    def upload_and_edit_url(self, image: GeneratedImage, title: str) -> CanvaHandoff: ...


def parse_asset_id(body: dict) -> str:
    asset = (body.get("job") or {}).get("asset") or {}
    asset_id = asset.get("id")
    if not asset_id:
        status = (body.get("job") or {}).get("status")
        raise ValueError(f"no asset id in Canva upload response (job status={status!r})")
    return asset_id


def parse_edit_url(body: dict) -> str:
    urls = (body.get("design") or {}).get("urls") or {}
    edit_url = urls.get("edit_url")
    if not edit_url:
        raise ValueError("no edit_url in Canva design response")
    return edit_url


def upload_metadata_header(name: str) -> str:
    """Value for the `Asset-Upload-Metadata` header: a JSON object whose `name_base64` is the
    base64-encoded asset NAME string (max 50 chars unencoded), per the Canva Connect docs.
    (Confirmed live 2026-07-10 — NOT base64 of a JSON object.)"""
    name_b64 = base64.b64encode(name[:50].encode()).decode()
    return json.dumps({"name_base64": name_b64})


class CanvaConnectClient:
    """Live client: upload the image as an asset (async job → poll to completion), then create a
    design from it to get an edit URL. Shapes confirmed against the live API 2026-07-10.

    Scopes required: asset:write (upload), asset:read (poll the upload job), design:content:write
    (create design), design:meta:read (design metadata).

    Tokens: prefers the DB-persisted oauth_tokens row (survives restarts; refresh tokens
    ROTATE, so persistence is mandatory). Falls back to the .env access token when no row
    exists (no refresh possible in that posture). Auto-refreshes preemptively on expiry.
    """

    def __init__(self, settings: Settings, session_factory=None):
        self._settings = settings
        if session_factory is None:
            from athena.db.base import make_session_factory
            session_factory = make_session_factory()
        self._session_factory = session_factory

    @staticmethod
    def _needs_refresh(expires_at) -> bool:
        """Unknown expiry (None, e.g. the env-seeded row) counts as needing refresh — the
        seeded access token's remaining life is unknowable, so assume the worst."""
        from datetime import datetime, timedelta, timezone
        if expires_at is None:
            return True
        if expires_at.tzinfo is None:
            expires_at = expires_at.replace(tzinfo=timezone.utc)
        return datetime.now(timezone.utc) >= expires_at - timedelta(seconds=_REFRESH_BUFFER_S)

    def _access_token(self) -> str:
        from sqlalchemy import select

        from athena.db.models import OAuthToken
        from athena.integrations.token_store import get_oauth_token
        session = self._session_factory()
        try:
            row = get_oauth_token(session, "canva")
            if row is None:
                return self._settings.canva_access_token
            if not row.refresh_token or not self._needs_refresh(row.expires_at):
                # No refresh token → a refresh POST is doomed; use what we have.
                return row.access_token
            # Canva refresh tokens are single-use and ROTATE: if two workers refresh
            # concurrently, the loser consumes an already-spent token and fails. Take a
            # row lock, then re-check — if another worker refreshed while we waited, its
            # fresh token is what we must use (never the stale one we read above).
            # populate_existing is required: the identity map would otherwise hand back
            # the already-loaded instance with its STALE attributes, defeating the re-check.
            row = session.execute(
                select(OAuthToken).where(OAuthToken.provider == "canva")
                .with_for_update().execution_options(populate_existing=True)
            ).scalar_one_or_none()
            if row is None:
                return self._settings.canva_access_token
            if not row.refresh_token or not self._needs_refresh(row.expires_at):
                return row.access_token
            # _refresh commits on this session, which releases the row lock.
            return self._refresh(session, row.refresh_token)
        finally:
            session.close()

    def _refresh(self, session, refresh_token: str) -> str:
        import httpx
        from datetime import datetime, timedelta, timezone

        from athena.integrations.token_store import save_oauth_token
        log.info("canva token refresh", extra={"mode": "live"})
        resp = httpx.post(
            f"{CANVA_BASE}/oauth/token",
            auth=(self._settings.canva_client_id, self._settings.canva_client_secret),
            data={"grant_type": "refresh_token", "refresh_token": refresh_token},
            timeout=30.0)
        if resp.status_code >= 400:
            log.error("canva token refresh failed",
                      extra={"status": resp.status_code, "body": resp.text[:500]})
        resp.raise_for_status()
        body = resp.json()
        expires_at = datetime.now(timezone.utc) + timedelta(seconds=int(body["expires_in"]))
        save_oauth_token(session, "canva", access_token=body["access_token"],
                         refresh_token=body["refresh_token"], expires_at=expires_at)
        return body["access_token"]

    def upload_and_edit_url(self, image: GeneratedImage, title: str) -> CanvaHandoff:
        import httpx
        auth = {"Authorization": f"Bearer {self._access_token()}"}
        name = title[:50]
        log.info("canva asset upload", extra={"mode": "live", "title": name})
        up = httpx.post(
            f"{CANVA_BASE}/asset-uploads",
            headers={**auth, "Content-Type": "application/octet-stream",
                     "Asset-Upload-Metadata": upload_metadata_header(name)},
            content=base64.b64decode(image.data_b64), timeout=60.0)
        up.raise_for_status()
        job = self._await_upload(up.json().get("job") or {}, auth, httpx)
        asset_id = parse_asset_id({"job": job})
        log.info("canva design create", extra={"mode": "live", "asset_id": asset_id})
        des = httpx.post(
            f"{CANVA_BASE}/designs", headers={**auth, "Content-Type": "application/json"},
            json={"type": "type_and_asset",
                  "design_type": {"type": "custom", "width": 1080, "height": 1080},
                  "asset_id": asset_id, "title": name}, timeout=60.0)
        des.raise_for_status()
        return CanvaHandoff(asset_id=asset_id, edit_url=parse_edit_url(des.json()))

    def _await_upload(self, job: dict, auth: dict, httpx, attempts: int = 20,
                      delay: float = 1.5) -> dict:
        """Poll `GET /asset-uploads/{id}` until the async job reaches `success` (returns the
        completed job) or `failed`/timeout (raises ValueError). Needs the `asset:read` scope."""
        import time
        for _ in range(attempts):
            status = job.get("status")
            if status == "success":
                return job
            if status == "failed":
                raise ValueError(f"canva asset upload failed: {job.get('error')}")
            time.sleep(delay)
            g = httpx.get(f"{CANVA_BASE}/asset-uploads/{job['id']}", headers=auth, timeout=30.0)
            g.raise_for_status()
            job = g.json().get("job") or {}
        raise ValueError(f"canva asset upload did not complete (last status={job.get('status')!r})")


class FakeCanvaClient:
    """Deterministic client for tests / no-key dev."""

    def upload_and_edit_url(self, image: GeneratedImage, title: str) -> CanvaHandoff:
        log.info("canva asset upload", extra={"mode": "fake", "title": title})
        return CanvaHandoff(asset_id="Msd_FAKE",
                            edit_url="https://www.canva.com/design/DAF_FAKE/edit")


def get_canva_client(settings: Settings, session_factory=None) -> CanvaClient:
    if settings.canva_mode == "live":
        return CanvaConnectClient(settings, session_factory)
    return FakeCanvaClient()
