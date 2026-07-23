"""Degenerate single-DB live config (no FIXTURE_DATABASE_URL): the session targets the
LIVE database with nowhere safe to route fixture rows, so a source whose override pins
it to fixture must be SKIPPED — never ingested — or fixture rows would land in the live
DB (the leak found in the 2026-07-22 audit). With a fixture DB configured these sources
are routed there instead — see tests/features/test_mixed_mode.py."""
import pytest

from athena.config import Settings
from athena.db.models import (CompetitorPost, CompetitorReview, GoogleReview,
                              KeywordVolume, OwnPost, ZohoChat)
from athena.jobs import ingestion_jobs as jobs

CASES = [
    (jobs.ingest_meta_posts, "meta_source_mode", OwnPost),
    (jobs.ingest_competitor_posts, "meta_source_mode", CompetitorPost),
    (jobs.ingest_google_reviews, "google_reviews_source_mode", GoogleReview),
    (jobs.ingest_keyword_volumes, "google_ads_source_mode", KeywordVolume),
    (jobs.ingest_zoho_chats, "zoho_source_mode", ZohoChat),
    (jobs.ingest_competitor_reviews, "google_places_source_mode", CompetitorReview),
]


@pytest.mark.parametrize("job,override,model", CASES, ids=[c[0].__name__ for c in CASES])
def test_job_skips_when_fixture_pinned_in_live_mode(session, job, override, model):
    # fixture_database_url pinned empty: a FIXTURE_DATABASE_URL in the developer's env
    # would otherwise leak in (env vars still apply with _env_file=None) and turn the
    # degenerate config under test into the routed one.
    settings = Settings(_env_file=None, source_mode="live", fixture_database_url="",
                        **{override: "fixture"})
    res = job(lambda: session, settings)
    assert res.get("skipped") is True
    assert session.query(model).count() == 0


def test_fixture_global_still_ingests(session):
    # The predicate must not fire in fixture mode: the session targets the fixture DB
    # there, and skipping would silently break fixture ingestion (the demo path).
    settings = Settings(_env_file=None, source_mode="fixture",
                        google_reviews_source_mode="fixture")
    res = jobs.ingest_google_reviews(lambda: session, settings)
    assert res.total > 0
    assert session.query(GoogleReview).count() == res.total
