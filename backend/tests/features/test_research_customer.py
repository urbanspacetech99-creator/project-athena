from datetime import datetime, timedelta, timezone
from athena.db.models import ZohoChat
from athena.ai.llm import FakeLLM
from athena.ai.schemas import CustomerInsights, TitleSuggestions
from athena.features.research import extract_customer_questions, customer_insights_summary


def _seed(session, ref):
    session.add(ZohoChat(source_id="c1",
        transcript="Customer: Do you have 24/7 access?\nAgent: Yes.\nCustomer: And climate control?\nAgent: Yes.",
        window_date=ref - timedelta(days=2)))
    session.add(ZohoChat(source_id="c2",
        transcript="Customer: What's the price for a 10x15 unit?\nAgent: $180/mo.",
        window_date=ref - timedelta(days=3)))
    session.commit()


def test_extract_customer_questions_regex(session):
    ref = datetime(2026, 7, 8, tzinfo=timezone.utc)
    _seed(session, ref)
    out = extract_customer_questions(session)
    qs = out["questions"]
    assert any("24/7 access" in q for q in qs)
    assert any("10x15 unit" in q for q in qs)
    assert all(q.endswith("?") for q in qs)


def test_extract_customer_questions_excludes_agent(session):
    from datetime import datetime, timedelta, timezone
    from athena.db.models import ZohoChat
    ref = datetime(2026, 7, 8, tzinfo=timezone.utc)
    session.add(ZohoChat(source_id="c3",
        transcript="Customer: Is parking free?\nAgent: Would you like to book a viewing?",
        window_date=ref - timedelta(days=1)))
    session.commit()
    qs = extract_customer_questions(session)["questions"]
    assert any("parking free" in q for q in qs)
    assert not any("book a viewing" in q for q in qs)  # agent question excluded


def test_extract_customer_questions_unlabeled_live_transcript(session):
    """Live Zoho Call_Logs are one unlabeled paragraph with no speaker prefixes; the
    extractor must still surface the question sentences (label-agnostic fallback)."""
    ref = datetime(2026, 7, 8, tzinfo=timezone.utc)
    session.add(ZohoChat(source_id="live1", window_date=ref - timedelta(days=1),
        transcript=("Hi, thanks for calling. This is Staff, how can I help you today? "
                    "Do you have 24/7 access? Yes we do. And is there climate control?")))
    session.commit()
    qs = extract_customer_questions(session)["questions"]
    assert any("24/7 access" in q for q in qs)
    assert any("climate control" in q for q in qs)
    assert all(q.endswith("?") for q in qs)


def test_customer_insights_summary_ai(session):
    ref = datetime(2026, 7, 8, tzinfo=timezone.utc)
    _seed(session, ref)
    ci = CustomerInsights(top_services=["climate control"], top_features=["24/7 access"],
                          top_promotions=[], summary="Customers want access and climate control")
    ts = TitleSuggestions(titles=["1", "2", "3", "4", "5"], prefill_prompt="p")
    llm = FakeLLM({CustomerInsights: ci, TitleSuggestions: ts})
    out = customer_insights_summary(session, llm, reference=ref)
    assert out["insights"].top_features == ["24/7 access"]
    assert out["titles"] == ["1", "2", "3", "4", "5"]
