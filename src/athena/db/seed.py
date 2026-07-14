"""Idempotent seeding of the config tables with UrbanSpace defaults.

Rule: a table is seeded ONLY when it is empty — user edits are never overwritten.
Runs on every boot via bootstrap_database().
"""
from datetime import datetime, timezone

from sqlalchemy import text
from sqlalchemy.orm import Session

from athena.config import Settings
from athena.db import seed_data
from athena.db.models import (AgentDefinition, Competitor, OAuthToken, SkillDefinition,
                               TrackedKeyword)
from athena.logging_setup import get_logger

log = get_logger("athena.db.seed")


def seed_defaults(session: Session, settings: Settings | None = None) -> dict[str, int]:
    """Seed each empty config table; return {table: rows_inserted}.

    Commits the passed session (both to persist the seeded rows and to release the
    advisory lock below) — callers must not be mid-transaction when calling this.
    """
    # Serialize concurrent seeders (api + worker boot together in docker-compose):
    # the tx-scoped advisory lock is released automatically at commit/rollback.
    session.execute(text("SELECT pg_advisory_xact_lock(748291600)"))

    now = datetime.now(timezone.utc)
    counts: dict[str, int] = {}

    if session.query(Competitor).count() == 0:
        for c in seed_data.COMPETITORS:
            session.add(Competitor(platform=c["platform"], name=c["name"],
                                   external_id=c["external_id"], enabled=True,
                                   created_at=now, updated_at=now))
        counts["competitors"] = len(seed_data.COMPETITORS)

    if session.query(TrackedKeyword).count() == 0:
        for kw in seed_data.KEYWORDS:
            session.add(TrackedKeyword(keyword=kw, enabled=True, created_at=now))
        counts["tracked_keywords"] = len(seed_data.KEYWORDS)

    if session.query(SkillDefinition).count() == 0:
        for s in seed_data.SKILLS:
            session.add(SkillDefinition(key=s["key"], name=s["name"],
                                        content=s["content"], updated_at=now))
        counts["skills"] = len(seed_data.SKILLS)

    if session.query(AgentDefinition).count() == 0:
        for a in seed_data.AGENTS:
            session.add(AgentDefinition(key=a["key"], name=a["name"],
                                        system_prompt=a["system_prompt"],
                                        skill_keys=a["skill_keys"], updated_at=now))
        counts["agent_definitions"] = len(seed_data.AGENTS)

    if settings is not None and session.get(OAuthToken, "canva") is None \
            and (settings.canva_access_token or settings.canva_refresh_token):
        # Refresh-token-only case (no pre-provisioned access token): the seeded row gets
        # access_token="" and expires_at=None, which _needs_refresh treats as "unknown
        # remaining life" -> the first live call refreshes before use (see
        # tests/integrations/test_canva_refresh.py::test_refresh_when_expiry_unknown).
        session.add(OAuthToken(provider="canva", access_token=settings.canva_access_token,
                               refresh_token=settings.canva_refresh_token,
                               expires_at=None, updated_at=now))
        counts["oauth_tokens"] = 1

    session.commit()
    if counts:
        log.info("seeded config defaults", extra={"seeded": counts})
    return counts
