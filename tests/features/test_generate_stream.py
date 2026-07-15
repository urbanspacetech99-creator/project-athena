from athena.ai.images import FakeImageClient
from athena.ai.llm import default_fake_llm
from athena.db.models import GeneratedPost
from athena.features.generate import generate_post_stream
from athena.integrations.canva import FakeCanvaClient

BRIEF = {"platform": "instagram", "tone": "friendly", "length": "short",
         "prefill_prompt": "Promote climate-controlled units",
         "visual_style": "clean_product",
         "include_hashtags": True, "include_cta": True,
         "include_emoji": False, "include_pricing": False}


def _events(session, options):
    return list(generate_post_stream(session, default_fake_llm(), FakeImageClient(),
                                     FakeCanvaClient(), BRIEF, options=options))


def test_stream_emits_ordered_progress_then_result(session):
    events = _events(session, options=2)
    progress = [e for e in events if e["event"] == "progress"]
    # step 0 = "Starting…", then 2 options × (3 graph nodes + 1 Canva upload) = 8 more
    assert [p["step"] for p in progress] == list(range(9))
    assert {p["total"] for p in progress} == {8}
    assert progress[1]["label"] == "Option 1: caption written"
    assert progress[4]["label"] == "Option 1: Canva design created"
    assert progress[5]["label"] == "Option 2: caption written"
    assert events[-1]["event"] == "result"
    assert len(events[-1]["data"]["options"]) == 2


def test_stream_result_matches_sync_shape_and_persists(session):
    events = _events(session, options=3)
    options = events[-1]["data"]["options"]
    for opt in options:
        assert opt["caption"]
        assert opt["image_b64"] and opt["mime_type"].startswith("image/")
        assert opt["canva_edit_url"].startswith("https://www.canva.com/design/")
        assert opt["visual_style"]
    assert session.query(GeneratedPost).count() == 3
