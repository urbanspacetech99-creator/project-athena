import json
from datetime import datetime, timezone

from fastapi.testclient import TestClient

from athena.ai.llm import FakeLLM
from athena.api import deps
from athena.api.app import create_app
from athena.db.models import (CompetitorPost, GeneratedPost, GoogleReview, KeywordVolume,
                              OwnPost, ZohoChat)

NOW = datetime.now(timezone.utc)


def _client(session):
    app = create_app()
    app.dependency_overrides[deps.get_session] = lambda: session
    return TestClient(app)


def _lines(res):
    return [json.loads(line) for line in res.text.strip().splitlines()]


def test_post_stream_emits_progress_then_result(session):
    res = _client(session).post("/generate/post/stream",
                                json={"platform": "instagram", "prefill_prompt": "units"})
    assert res.status_code == 200
    assert res.headers["content-type"].startswith("application/x-ndjson")
    lines = _lines(res)
    progress = [ln for ln in lines if ln["event"] == "progress"]
    assert [p["step"] for p in progress] == list(range(13))  # 0..12 = start + 3 options × 4
    assert all(p["total"] == 12 for p in progress)
    assert lines[-1]["event"] == "result"
    assert len(lines[-1]["data"]["options"]) == 3
    assert session.query(GeneratedPost).count() == 3


def test_post_stream_failure_emits_error_event_and_persists_nothing(session):
    app = create_app()
    app.dependency_overrides[deps.get_session] = lambda: session
    # No schemas registered -> the first structured() call raises KeyError mid-stream.
    app.dependency_overrides[deps.get_llm] = lambda: FakeLLM({})
    res = TestClient(app).post("/generate/post/stream", json={"platform": "instagram"})
    assert res.status_code == 200  # status was already sent when the failure happened
    lines = _lines(res)
    assert lines[-1]["event"] == "error"
    assert lines[-1]["detail"]
    assert session.query(GeneratedPost).count() == 0


def test_recommendations_stream_emits_five_steps_then_result(session):
    session.add(KeywordVolume(source_id="k1", window_date=NOW, keyword="self storage",
                              weekly_search_volume=100))
    session.add(OwnPost(source_id="p1", window_date=NOW, platform="instagram", title="t",
                        content="tour", views=1, likes=1, interactions=1))
    session.add(GoogleReview(source_id="r1", window_date=NOW, star_rating=5, comment="good",
                             reviewer="A"))
    session.add(CompetitorPost(source_id="c1", window_date=NOW, competitor="BoxCo", text="x"))
    session.add(ZohoChat(source_id="z1", window_date=NOW, transcript="Customer: price?"))
    session.commit()
    res = _client(session).get("/generate/recommendations/stream")
    lines = _lines(res)
    progress = [ln for ln in lines if ln["event"] == "progress"]
    assert [p["step"] for p in progress] == list(range(6))
    assert lines[-1]["event"] == "result"
    assert len(lines[-1]["data"]["titles"]) == 5


def test_stream_endpoints_documented():
    spec = TestClient(create_app()).get("/openapi.json").json()
    assert "/generate/post/stream" in spec["paths"]
    assert "/generate/recommendations/stream" in spec["paths"]


def test_recommendations_stream_failure_emits_error_event(session):
    app = create_app()
    app.dependency_overrides[deps.get_session] = lambda: session
    # Empty FakeLLM -> a threaded analyst node's structured() call raises KeyError,
    # which must propagate out of graph.stream() into a terminal error event.
    app.dependency_overrides[deps.get_llm] = lambda: FakeLLM({})
    res = TestClient(app).get("/generate/recommendations/stream")
    assert res.status_code == 200
    lines = _lines(res)
    assert lines[-1]["event"] == "error"
    assert lines[-1]["detail"]
