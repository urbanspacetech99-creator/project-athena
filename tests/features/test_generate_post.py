from athena.ai.images import FakeImageClient
from athena.ai.llm import default_fake_llm
from athena.db.models import GeneratedPost
from athena.features.generate import generate_post
from athena.integrations.canva import FakeCanvaClient

BRIEF = {"platform": "instagram", "tone": "friendly", "length": "short",
         "prefill_prompt": "Promote climate-controlled units",
         "visual_style": "clean_product",
         "include_hashtags": True, "include_cta": True,
         "include_emoji": False, "include_pricing": False}


def test_generate_post_returns_three_options_with_image_and_canva(session):
    out = generate_post(session, default_fake_llm(), FakeImageClient(), FakeCanvaClient(), BRIEF)
    assert len(out["options"]) == 3
    for opt in out["options"]:
        assert opt["caption"]
        assert opt["image_b64"] and opt["mime_type"].startswith("image/")
        assert opt["canva_edit_url"].startswith("https://www.canva.com/design/")
        assert opt["visual_style"]


def test_generate_post_persists_audit_rows(session):
    generate_post(session, default_fake_llm(), FakeImageClient(), FakeCanvaClient(), BRIEF)
    rows = session.query(GeneratedPost).all()
    assert len(rows) == 3
    assert all(r.source_feature == "post_generator" for r in rows)
    assert all(r.image_b64 and r.canva_edit_url for r in rows)
    assert all(r.prefill_prompt == "Promote climate-controlled units" for r in rows)


def test_generate_post_option_count_is_configurable(session):
    out = generate_post(session, default_fake_llm(), FakeImageClient(), FakeCanvaClient(),
                        BRIEF, options=2)
    assert len(out["options"]) == 2
