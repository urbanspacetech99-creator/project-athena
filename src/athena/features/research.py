import re
from datetime import datetime, timedelta, timezone

from sqlalchemy import func
from sqlalchemy.orm import Session

from athena.ai.agents import resolve_agent_prompt
from athena.ai.llm import LLMClient
from athena.ai.schemas import CompetitorInsights, CustomerInsights, SocialReviewInsights, TitleSuggestions
from athena.db.models import (Competitor, CompetitorComment, CompetitorPost, CompetitorReview,
                              GoogleReview, KeywordVolume, OwnPost, PostComment, ZohoChat)


def suggest_titles(session: Session, llm: LLMClient, source: str, context: str) -> TitleSuggestions:
    return llm.structured(
        system=resolve_agent_prompt(session, "title_suggester"),
        user=f"Research source: {source}\nContext:\n{context}",
        schema=TitleSuggestions)


def research_internet_trends(session: Session, llm: LLMClient) -> dict:
    # Scope to the latest ingested window and dedupe by keyword server-side: the same
    # keyword recurs across windows/source_ids (the unique key is source_id+window_date,
    # not keyword), so a global top-5 would mix weeks and repeat terms.
    latest = session.query(func.max(KeywordVolume.window_date)).scalar()
    rows = []
    if latest is not None:
        rows = (session.query(KeywordVolume.keyword,
                              func.max(KeywordVolume.weekly_search_volume).label("vol"))
                .filter(KeywordVolume.window_date == latest)
                .group_by(KeywordVolume.keyword)
                .order_by(func.max(KeywordVolume.weekly_search_volume).desc())
                .limit(5).all())
    keywords = [{"keyword": kw, "weekly_search_volume": vol} for kw, vol in rows]
    context = "Top search keywords this week:\n" + "\n".join(
        f"- {k['keyword']}: {k['weekly_search_volume']}/wk" for k in keywords)
    titles = suggest_titles(session, llm, "internet_trends", context)
    return {"keywords": keywords, "titles": titles.titles, "prefill_prompt": titles.prefill_prompt}


def extract_customer_questions(session: Session) -> dict:
    """Feature 4: customer questions from chat transcripts (regex, no AI).

    Label-agnostic. When a transcript carries ``Customer:`` speaker prefixes (the
    fixture / idealized shape) keep only the customer's questions — this preserves
    speaker attribution and excludes staff turns. When it has no such labels (live
    Zoho Call_Logs are one unlabeled paragraph interleaving both speakers) fall back
    to every question sentence in the transcript, since the source gives us no way to
    tell customer from staff.
    """
    out: list[str] = []
    seen: set[str] = set()

    def add(sentence: str) -> None:
        s = sentence.strip()
        if s and s not in seen:
            seen.add(s)
            out.append(s)

    for (transcript,) in session.query(ZohoChat.transcript).all():
        text = transcript or ""
        lines = text.splitlines()
        has_customer_label = any(
            ":" in ln and ln.partition(":")[0].strip().lower() == "customer" for ln in lines)
        if has_customer_label:
            for line in lines:
                if ":" not in line:
                    continue
                speaker, _, body = line.partition(":")
                if speaker.strip().lower() != "customer" or "?" not in body:
                    continue
                for sentence in re.findall(r"[^?]*\?", body):
                    add(sentence)
        else:
            # Unlabeled prose: split on sentence terminators, keep the '?'-ending runs.
            for sentence in re.findall(r"[^.?!]*\?", text):
                add(sentence)
    return {"questions": out}


def customer_insights_summary(session: Session, llm: LLMClient,
                              reference: datetime | None = None) -> dict:
    """Feature 5: monthly AI summary of chat history -> top services/features/promos + titles."""
    ref = reference or datetime.now(timezone.utc)
    since = ref - timedelta(days=30)
    transcripts = [t for (t,) in session.query(ZohoChat.transcript)
                   .filter(ZohoChat.window_date >= since).all()]
    if not transcripts:
        insights = CustomerInsights(summary="No customer chats in the past month.")
    else:
        body = "\n---\n".join(transcripts)
        insights = llm.structured(
            system=resolve_agent_prompt(session, "customer_insights"),
            user=f"Chat transcripts:\n{body}", schema=CustomerInsights)
    context = (f"Top services: {insights.top_services}; features: {insights.top_features}; "
               f"promotions: {insights.top_promotions}. {insights.summary}")
    titles = suggest_titles(session, llm, "customer_insights", context)
    return {"insights": insights, "titles": titles.titles, "prefill_prompt": titles.prefill_prompt}


def research_social_reviews(session: Session, llm: LLMClient,
                            reference: datetime | None = None) -> dict:
    """Feature 6: views + comment topics + review aggregation + titles."""
    ref = reference or datetime.now(timezone.utc)
    since = ref - timedelta(days=7)
    views = int(session.query(func.coalesce(func.sum(OwnPost.views), 0))
                .filter(OwnPost.window_date >= since).scalar() or 0)
    own_ids = [r[0] for r in session.query(OwnPost.source_id).filter(OwnPost.window_date >= since).all()]
    comments = ([c[0] for c in session.query(PostComment.text)
                 .filter(PostComment.post_source_id.in_(own_ids)).all()] if own_ids else [])
    reviews = [r[0] for r in session.query(GoogleReview.comment).all() if r[0]]
    context = ("Comments:\n" + "\n".join(f"- {c}" for c in comments) +
               "\n\nReviews:\n" + "\n".join(f"- {r}" for r in reviews))
    insights = llm.structured(
        system=resolve_agent_prompt(session, "social_review_analyst"),
        user=context, schema=SocialReviewInsights)
    titles = suggest_titles(session, llm, "social_reviews",
                            f"Views: {views}. Topics: {insights.comment_topics}. {insights.review_summary}")
    return {"views": views, "insights": insights,
            "titles": titles.titles, "prefill_prompt": titles.prefill_prompt}


def research_competitor(session: Session, llm: LLMClient,
                        competitor: str | None = None) -> dict:
    """Feature 7: competitor activity & recommendations + titles. When `competitor` is
    given, scopes to that competitor (folding platform aliases — IG posts are attributed
    by username) and uses its posts, comment signal, and Google reviews."""
    aliases: set[str] | None = None
    if competitor:
        aliases = {competitor}
        for c in session.query(Competitor).filter(Competitor.name == competitor).all():
            if c.external_id:
                aliases.add(c.external_id)

    post_q = session.query(CompetitorPost)
    if aliases is not None:
        post_q = post_q.filter(CompetitorPost.competitor.in_(aliases))
    # Bounded to the 50 most recent posts so the prompt budget stays fixed as tables grow.
    recent_posts = post_q.order_by(CompetitorPost.window_date.desc()).limit(50).all()
    posts = [(p.competitor, p.text, p.like_count, p.comment_count) for p in recent_posts]
    post_ids = [p.source_id for p in recent_posts]
    comments = ([c[0] for c in
                 session.query(CompetitorComment.text)
                 .filter(CompetitorComment.post_source_id.in_(post_ids))
                 .order_by(CompetitorComment.window_date.desc()).limit(50).all()]
                if post_ids else [])

    review_q = session.query(CompetitorReview)
    if competitor:
        review_q = review_q.filter(CompetitorReview.competitor == competitor)
    reviews = review_q.order_by(CompetitorReview.window_date.desc()).limit(20).all()

    context = ("Competitor posts:\n" +
               "\n".join(f"- [{c}] {t} ({likes} likes, {comments} comments)"
                         for c, t, likes, comments in posts) +
               "\n\nAudience comments:\n" + "\n".join(f"- {c}" for c in comments) +
               "\n\nGoogle reviews:\n" +
               "\n".join(f"- [{r.competitor}] {r.reviewer} ({r.star_rating}★): {r.comment}" for r in reviews))
    insights = llm.structured(
        system=resolve_agent_prompt(session, "competitor_analyst"),
        user=context, schema=CompetitorInsights)
    recos = "; ".join(f"{r.title}: {r.detail}" for r in insights.recommendations)
    titles = suggest_titles(session, llm, "competitor",
                            f"{insights.activity_summary} Recommendations: {recos}")
    return {"insights": insights, "titles": titles.titles, "prefill_prompt": titles.prefill_prompt}
