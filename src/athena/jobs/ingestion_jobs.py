from athena.adapters.meta import MetaOwnPostsAdapter
from athena.config import Settings
from athena.db.models import Competitor, OwnPost, PostComment, TrackedKeyword
from athena.ingestion.runner import IngestResult, run_ingestion, upsert_rows
from athena.logging_setup import get_logger

log = get_logger("athena.jobs.ingestion")


def ingest_meta_posts(session_factory, settings: Settings) -> dict:
    mode = settings.source_mode_for("meta")
    adapter = MetaOwnPostsAdapter(mode=mode, settings=settings)
    session = session_factory()
    try:
        posts = run_ingestion(adapter, session, OwnPost, conflict=("source_id", "window_date"))
        # comments: use the adapter's comment stream (fixture) -> upsert PostComment
        raw = adapter.fetch_comments_fixture() if mode == "fixture" else {"data": []}
        comment_rows = adapter.normalize_comments(raw)
        ci, cu = upsert_rows(session, PostComment, comment_rows, ("source_id",))
        session.commit()
        return {"posts": posts, "comments": IngestResult("meta", ci, cu)}
    finally:
        session.close()


def ingest_google_reviews(session_factory, settings: Settings):
    from athena.adapters.google_reviews import GoogleReviewsAdapter
    from athena.db.models import GoogleReview

    adapter = GoogleReviewsAdapter(mode=settings.source_mode_for("google_reviews"), settings=settings)
    session = session_factory()
    try:
        return run_ingestion(adapter, session, GoogleReview, conflict=("source_id",))
    finally:
        session.close()


def ingest_keyword_volumes(session_factory, settings):
    """Keywords come from enabled TrackedKeyword rows; fixture mode ignores the list."""
    from athena.adapters.google_ads import KeywordPlannerAdapter
    from athena.db.models import KeywordVolume

    session = session_factory()
    try:
        keywords = [k.keyword for k in session.query(TrackedKeyword)
                    .filter(TrackedKeyword.enabled.is_(True)).all()]
        adapter = KeywordPlannerAdapter(mode=settings.source_mode_for("google_ads"),
                                        settings=settings, keywords=keywords)
        return run_ingestion(adapter, session, KeywordVolume,
                             conflict=("source_id", "window_date"))
    finally:
        session.close()


def ingest_zoho_chats(session_factory, settings):
    from athena.adapters.zoho import ZohoChatsAdapter
    from athena.db.models import ZohoChat

    adapter = ZohoChatsAdapter(mode=settings.source_mode_for("zoho"), settings=settings)
    session = session_factory()
    try:
        return run_ingestion(adapter, session, ZohoChat, conflict=("source_id",))
    finally:
        session.close()


def ingest_competitor_posts(session_factory, settings: Settings) -> dict:
    """Both platforms, one job. Live: one adapter per enabled competitor row (rows with an
    empty external_id are skipped with a warning). Fixture: one run per platform — record-level
    attribution (from.name / business_discovery.username) labels the competitors. A failing
    competitor is logged and skipped; it never aborts the run."""
    from athena.adapters.meta import MetaCompetitorAdapter, MetaIGCompetitorAdapter
    from athena.db.models import CompetitorComment, CompetitorPost

    mode = settings.source_mode_for("meta")
    session = session_factory()
    p_ins = p_upd = c_ins = c_upd = 0
    failed: list[str] = []
    # NB totals vs. failed are not mutually exclusive: run_ingestion commits the post rows
    # internally, so if a competitor's posts ingest fine but the *comments* fetch/upsert
    # below then raises, that competitor still lands in `failed` while its posts remain
    # counted in p_ins/p_upd. Intentional -- the per-competitor exception log has the detail.
    try:
        rows = (session.query(Competitor).filter(Competitor.enabled.is_(True))
                .order_by(Competitor.id).all())
        fb = [r for r in rows if r.platform == "facebook"]
        ig = [r for r in rows if r.platform == "instagram"]
        if mode == "fixture":   # one representative run per platform
            fb, ig = fb[:1], ig[:1]
        if (mode == "live" and fb
                and not getattr(settings, "competitor_live_access_enabled", False)):
            # Hoisted PPCA gate: one warning instead of a stack trace per competitor
            # (the adapter keeps its own gate as defense in depth).
            log.warning("competitor live access not enabled (PPCA required); "
                        "skipping all facebook competitors",
                        extra={"platform": "facebook", "skipped": len(fb)})
            fb = []

        for comp in fb:
            if mode == "live" and not comp.external_id:
                log.warning("skipping competitor without page_id",
                            extra={"competitor": comp.name, "platform": "facebook"})
                continue
            try:
                adapter = MetaCompetitorAdapter(mode=mode, competitor=comp.name,
                                                page_id=comp.external_id, settings=settings)
                res = run_ingestion(adapter, session, CompetitorPost, conflict=("source_id",))
                p_ins += res.inserted
                p_upd += res.updated
                raw = adapter.fetch_comments_fixture() if mode == "fixture" else {"data": []}
                ci, cu = upsert_rows(session, CompetitorComment,
                                     adapter.normalize_comments(raw), ("source_id",))
                c_ins += ci
                c_upd += cu
            except Exception:
                session.rollback()
                failed.append(comp.name)
                log.exception("competitor ingestion failed",
                              extra={"competitor": comp.name, "platform": "facebook"})

        for comp in ig:
            if mode == "live" and not comp.external_id:
                log.warning("skipping competitor without IG username",
                            extra={"competitor": comp.name, "platform": "instagram"})
                continue
            try:
                adapter = MetaIGCompetitorAdapter(mode=mode, competitor=comp.name,
                                                  username=comp.external_id, settings=settings)
                res = run_ingestion(adapter, session, CompetitorPost, conflict=("source_id",))
                p_ins += res.inserted
                p_upd += res.updated
            except Exception:
                session.rollback()
                failed.append(comp.name)
                log.exception("competitor ingestion failed",
                              extra={"competitor": comp.name, "platform": "instagram"})

        session.commit()
        return {"posts": IngestResult("meta", p_ins, p_upd),
                "comments": IngestResult("meta", c_ins, c_upd),
                "failed": failed}
    finally:
        session.close()


def ingest_competitor_reviews(session_factory, settings: Settings) -> dict:
    """Google competitor reviews via the Places API. One adapter per enabled
    platform="google" competitor (place_id in external_id). Live skips rows with an
    empty place_id; a failing competitor is logged and skipped, never aborting the run."""
    from athena.adapters.google_places import GooglePlacesReviewsAdapter
    from athena.db.models import Competitor, CompetitorReview

    mode = settings.source_mode_for("google_places")
    session = session_factory()
    r_ins = r_upd = 0
    failed: list[str] = []
    try:
        rows = (session.query(Competitor)
                .filter(Competitor.enabled.is_(True), Competitor.platform == "google")
                .order_by(Competitor.id).all())
        for comp in rows:
            if mode == "live" and not comp.external_id:
                log.warning("skipping competitor without place_id",
                            extra={"competitor": comp.name, "platform": "google"})
                continue
            try:
                adapter = GooglePlacesReviewsAdapter(mode=mode, competitor=comp.name,
                                                     place_id=comp.external_id, settings=settings)
                res = run_ingestion(adapter, session, CompetitorReview, conflict=("source_id",))
                r_ins += res.inserted
                r_upd += res.updated
            except Exception:
                session.rollback()
                failed.append(comp.name)
                log.exception("competitor reviews ingestion failed",
                              extra={"competitor": comp.name, "platform": "google"})
        return {"reviews": IngestResult("google_places", r_ins, r_upd), "failed": failed}
    finally:
        session.close()


def register_all(registry, session_factory, settings) -> None:
    jobs = {
        "ingest_meta_posts": (ingest_meta_posts, "0 3 * * *"),
        "ingest_competitor_posts": (ingest_competitor_posts, "0 3 * * *"),
        "ingest_google_reviews": (ingest_google_reviews, "0 3 * * *"),
        "ingest_competitor_reviews": (ingest_competitor_reviews, "0 3 * * *"),
        "ingest_keyword_volumes": (ingest_keyword_volumes, "0 4 * * 1"),
        "ingest_zoho_chats": (ingest_zoho_chats, "0 3 * * *"),
    }
    for name, (fn, cron) in jobs.items():
        registry.job(name, cron=cron)(lambda fn=fn: fn(session_factory, settings))
