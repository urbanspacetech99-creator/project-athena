"""RoutedSession: each sourced table binds to the DB its source's effective mode selects.

Harness: the ``two_dbs`` / ``routed_settings`` fixtures in tests/conftest.py — the
"fixture DB" is a distinct URL onto pg_url's database with schema fx, which is all
routing needs: two URLs resolving to two distinct engines whose statements land in
provably different places.
"""
from datetime import datetime, timedelta, timezone

from sqlalchemy import func
from sqlalchemy.orm import Session

from athena.db.base import Base, make_session_factory
from athena.db.models import Competitor, GoogleReview, KeywordVolume, OwnPost
from athena.ingestion.runner import upsert_rows

WD = datetime(2026, 7, 8, tzinfo=timezone.utc)
LATER = WD + timedelta(days=3)


def test_source_tables_map_matches_model_metadata():
    # SOURCE_TABLES is keyed by table name (base.py can't import models); catch drift in
    # BOTH directions — a new sourced model (has source_id) missing from the map would
    # silently use the default bind, i.e. fixture rows in the live DB in mixed mode.
    from athena.db.base import SOURCE_TABLES
    sourced = {name for name, t in Base.metadata.tables.items() if "source_id" in t.c}
    assert sourced == set(SOURCE_TABLES)


def test_orm_writes_and_reads_route_per_source(two_dbs, routed_settings):
    factory = make_session_factory(settings=routed_settings())
    with factory() as s:
        s.add(OwnPost(source_id="p1", platform="instagram", window_date=WD))
        s.add(GoogleReview(source_id="r1", star_rating=5, comment="ok", reviewer="A",
                           window_date=WD))
        s.commit()
    with Session(two_dbs["live"]) as raw:
        assert raw.query(OwnPost).count() == 1
        assert raw.query(GoogleReview).count() == 0   # live DB purity
    with Session(two_dbs["fx"]) as raw:
        assert raw.query(OwnPost).count() == 0        # fixture DB purity
        assert raw.query(GoogleReview).count() == 1
    with factory() as s:                              # one session composes both DBs
        assert s.query(OwnPost).count() == 1
        assert s.query(GoogleReview).count() == 1


def test_column_only_query_routes_to_the_sources_db(two_dbs, routed_settings):
    # Different rows in each DB: the later window lives in the LIVE keyword_volumes, so
    # only fixture-DB routing explains getting WD back from the aggregate.
    with Session(two_dbs["live"]) as raw:
        raw.add(KeywordVolume(source_id="k9", keyword="live", weekly_search_volume=9,
                              window_date=LATER))
        raw.commit()
    with Session(two_dbs["fx"]) as raw:
        raw.add(KeywordVolume(source_id="k1", keyword="fx", weekly_search_volume=1,
                              window_date=WD))
        raw.commit()
    factory = make_session_factory(settings=routed_settings())
    with factory() as s:
        assert s.query(func.max(KeywordVolume.window_date)).scalar() == WD


def test_upsert_statement_routes_to_the_sources_db(two_dbs, routed_settings):
    # run_ingestion's write path is session.execute(pg_insert(...)); bind resolution
    # must see the statement's table, not just ORM mappers.
    factory = make_session_factory(settings=routed_settings())
    with factory() as s:
        upsert_rows(s, GoogleReview,
                    [{"source_id": "r9", "star_rating": 4, "comment": "x",
                      "reviewer": "B", "window_date": WD}], ("source_id",))
        s.commit()
    with Session(two_dbs["fx"]) as raw:
        assert raw.query(GoogleReview).count() == 1
    with Session(two_dbs["live"]) as raw:
        assert raw.query(GoogleReview).count() == 0


def test_config_tables_stay_on_the_active_db(two_dbs, routed_settings):
    factory = make_session_factory(settings=routed_settings())   # live global mode
    with factory() as s:
        s.add(Competitor(platform="facebook", name="X"))
        s.commit()
    with Session(two_dbs["live"]) as raw:
        assert raw.query(Competitor).count() == 1
    with Session(two_dbs["fx"]) as raw:
        assert raw.query(Competitor).count() == 0


def test_global_fixture_mode_routes_everything_to_the_fixture_db(two_dbs, routed_settings):
    settings = routed_settings(source_mode="fixture", zoho_source_mode="live")
    factory = make_session_factory(settings=settings)
    with factory() as s:
        s.add(OwnPost(source_id="p1", platform="instagram", window_date=WD))
        s.add(Competitor(platform="facebook", name="X"))
        s.commit()
    with Session(two_dbs["fx"]) as raw:
        assert raw.query(OwnPost).count() == 1
        assert raw.query(Competitor).count() == 1
    with Session(two_dbs["live"]) as raw:
        assert raw.query(OwnPost).count() == 0
        assert raw.query(Competitor).count() == 0
