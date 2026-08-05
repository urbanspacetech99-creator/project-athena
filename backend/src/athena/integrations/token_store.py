"""Persistence for rotating OAuth tokens (currently: Canva)."""
from datetime import datetime, timezone

from sqlalchemy.orm import Session

from athena.db.models import OAuthToken


def get_oauth_token(session: Session, provider: str) -> OAuthToken | None:
    return session.get(OAuthToken, provider)


def save_oauth_token(session: Session, provider: str, access_token: str,
                     refresh_token: str, expires_at: datetime | None) -> OAuthToken:
    """Upsert the provider's token row. COMMITS the passed session (parity with seed_defaults)."""
    row = session.get(OAuthToken, provider)
    if row is None:
        row = OAuthToken(provider=provider)
        session.add(row)
    row.access_token = access_token
    row.refresh_token = refresh_token
    row.expires_at = expires_at
    row.updated_at = datetime.now(timezone.utc)
    session.commit()
    return row
