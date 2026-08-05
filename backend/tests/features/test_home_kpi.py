from datetime import datetime, timedelta, timezone
from athena.db.models import OwnPost
from athena.features.home import weekly_kpi


def test_weekly_kpi_sums_last_7_days(session):
    ref = datetime(2026, 7, 8, tzinfo=timezone.utc)
    session.add(OwnPost(source_id="a", platform="facebook", content="", views=100, likes=10,
                        interactions=15, window_date=ref - timedelta(days=1)))
    session.add(OwnPost(source_id="b", platform="instagram", content="", views=50, likes=5,
                        interactions=8, window_date=ref - timedelta(days=6)))
    session.add(OwnPost(source_id="c", platform="facebook", content="", views=999, likes=99,
                        interactions=99, window_date=ref - timedelta(days=10)))  # out of window
    session.commit()
    kpi = weekly_kpi(session, reference=ref)
    assert kpi["posts"] == 2
    assert kpi["views"] == 150
    assert kpi["likes"] == 15
    assert kpi["interactions"] == 23


def test_weekly_kpi_empty_returns_zeros(session):
    ref = datetime(2026, 7, 8, tzinfo=timezone.utc)
    kpi = weekly_kpi(session, reference=ref)
    assert kpi == {"posts": 0, "views": 0, "likes": 0, "interactions": 0}
