from athena.config import Settings
from athena.db.models import AgentDefinition, Competitor, OAuthToken, SkillDefinition, TrackedKeyword
from athena.db.seed import seed_defaults
from athena.db.seed_data import AGENTS, SKILLS

EXPECTED_AGENT_KEYS = {"caption_writer", "image_prompt_designer", "title_suggester",
                       "customer_insights", "social_review_analyst", "competitor_analyst",
                       "comment_insights", "aggregator_synthesis"}


def test_seed_populates_empty_tables(session):
    # NB: the shared `session` fixture already seeds; this asserts the outcome.
    keys = {a.key for a in session.query(AgentDefinition).all()}
    assert keys == EXPECTED_AGENT_KEYS
    assert {s.key for s in session.query(SkillDefinition).all()} == {
        "brand-identity", "tone-of-voice", "content-rules", "visual-style"}
    assert session.query(Competitor).count() >= 2
    assert session.query(TrackedKeyword).count() >= 5
    skill_keys = {s.key for s in session.query(SkillDefinition).all()}
    for a in session.query(AgentDefinition).all():
        assert set(a.skill_keys) <= skill_keys


def test_seed_is_idempotent_and_preserves_edits(session):
    agent = session.query(AgentDefinition).filter_by(key="caption_writer").one()
    agent.system_prompt = "USER EDITED"
    session.commit()
    seed_defaults(session)  # second run: tables non-empty -> untouched
    assert (session.query(AgentDefinition).filter_by(key="caption_writer").one()
            .system_prompt == "USER EDITED")
    assert session.query(AgentDefinition).count() == len(AGENTS)
    assert session.query(SkillDefinition).count() == len(SKILLS)


def test_seed_canva_row_from_refresh_token_only(session):
    """No pre-provisioned access token, only a refresh token -- the row must still be
    seeded (access_token="", expires_at=None) so the first live call can refresh."""
    assert session.get(OAuthToken, "canva") is None   # not seeded by the shared fixture's
                                                        # default Settings() (both empty)
    settings = Settings(canva_access_token="", canva_refresh_token="only-a-refresh-token")
    counts = seed_defaults(session, settings)
    assert counts["oauth_tokens"] == 1
    row = session.get(OAuthToken, "canva")
    assert row is not None
    assert row.access_token == ""
    assert row.refresh_token == "only-a-refresh-token"
    assert row.expires_at is None
