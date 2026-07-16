from datetime import datetime, timezone

from athena.db.models import OwnPost


def test_own_post_roundtrip(session):
    post = OwnPost(
        source_id="ig_123",
        platform="instagram",
        title="Summer promo",
        content="20% off units",
        views=100,
        likes=10,
        interactions=15,
        window_date=datetime(2026, 7, 1, tzinfo=timezone.utc),
    )
    session.add(post)
    session.commit()
    fetched = session.query(OwnPost).filter_by(source_id="ig_123").one()
    assert fetched.platform == "instagram"
    assert fetched.views == 100


def test_keyword_volume_composite_unique(session):
    from datetime import datetime, timezone
    from sqlalchemy.exc import IntegrityError
    from athena.db.models import KeywordVolume
    import pytest
    def mk(vol, when):
        return KeywordVolume(source_id="self storage", keyword="self storage",
                             weekly_search_volume=vol, window_date=when)
    session.add(mk(100, datetime(2026, 6, 1, tzinfo=timezone.utc)))
    session.add(mk(120, datetime(2026, 6, 8, tzinfo=timezone.utc)))
    session.commit()
    session.add(mk(999, datetime(2026, 6, 1, tzinfo=timezone.utc)))
    with pytest.raises(IntegrityError):
        session.commit()
    session.rollback()


def test_generate_columns_present():
    from athena.db.models import GeneratedPost, SavedDraft
    assert {"image_b64", "canva_edit_url"} <= set(SavedDraft.__table__.columns.keys())
    assert {"image_b64", "canva_edit_url", "visual_style"} <= set(
        GeneratedPost.__table__.columns.keys())


def test_config_tables_roundtrip(session):
    # Uses keys/keywords distinct from the UrbanSpace seed defaults (which the shared
    # `session` fixture loads) so inserts don't collide with seeded unique columns.
    from athena.db.models import (AgentDefinition, Competitor, OAuthToken,
                                   SkillDefinition, TrackedKeyword)
    now = datetime.now(timezone.utc)
    session.add(Competitor(platform="instagram", name="StorHub", external_id="storhubsg",
                           enabled=True, created_at=now, updated_at=now))
    session.add(TrackedKeyword(keyword="self storage singapore roundtrip test",
                               enabled=True, created_at=now))
    session.add(SkillDefinition(key="test-tone-of-voice", name="Tone of voice",
                                content="Plain-spoken.", updated_at=now))
    session.add(AgentDefinition(key="test_caption_writer", name="Caption writer",
                                system_prompt="You write captions.",
                                skill_keys=["test-tone-of-voice"], updated_at=now))
    session.add(OAuthToken(provider="canva", access_token="a", refresh_token="r",
                           expires_at=None, updated_at=now))
    session.commit()
    comp = session.query(Competitor).filter_by(external_id="storhubsg").one()
    assert comp.platform == "instagram" and comp.enabled is True
    agent = session.query(AgentDefinition).filter_by(key="test_caption_writer").one()
    assert agent.skill_keys == ["test-tone-of-voice"]
    assert session.get(OAuthToken, "canva").refresh_token == "r"


def test_competitor_platform_external_id_partial_unique(session):
    from sqlalchemy.exc import IntegrityError
    import pytest
    from athena.db.models import Competitor

    now = datetime.now(timezone.utc)

    # Two rows sharing the same platform + non-empty external_id must collide.
    session.add(Competitor(platform="instagram", name="Dup One",
                           external_id="dup-partial-index-test", enabled=True,
                           created_at=now, updated_at=now))
    session.commit()
    session.add(Competitor(platform="instagram", name="Dup Two",
                           external_id="dup-partial-index-test", enabled=True,
                           created_at=now, updated_at=now))
    with pytest.raises(IntegrityError):
        session.commit()
    session.rollback()

    # Two rows sharing the same platform with an EMPTY external_id must coexist —
    # the seeded FB rows (Extra Space Asia, StorHub) already prove this; assert it.
    fb_empty = (session.query(Competitor)
                .filter_by(platform="facebook", external_id="").all())
    assert len(fb_empty) >= 2


def test_competitor_post_has_platform(session):
    from athena.db.models import CompetitorPost
    session.add(CompetitorPost(source_id="x1", competitor="StorHub", text="post",
                               platform="facebook",
                               window_date=datetime(2026, 7, 1, tzinfo=timezone.utc)))
    session.commit()
    assert (session.query(CompetitorPost).filter_by(source_id="x1").one()
            .platform == "facebook")


def test_competitor_review_row_roundtrips(session):
    from athena.db.models import CompetitorReview
    session.add(CompetitorReview(source_id="pr1", competitor="StorHub", star_rating=5,
                                 comment="Great facility", reviewer="Zack T.",
                                 place_rating=4.4, place_review_count=210,
                                 window_date=datetime(2026, 7, 8, tzinfo=timezone.utc)))
    session.commit()
    row = session.query(CompetitorReview).filter_by(source_id="pr1").one()
    assert row.competitor == "StorHub"
    assert row.place_rating == 4.4 and row.place_review_count == 210
    assert row.star_rating == 5 and row.reviewer == "Zack T."
