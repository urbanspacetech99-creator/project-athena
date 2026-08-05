from datetime import datetime, timedelta, timezone
from typing import Any

from sqlalchemy import func
from sqlalchemy.orm import Session
from typing_extensions import TypedDict
from langgraph.graph import START, END, StateGraph

from athena.ai.agents import resolve_agent_prompt
from athena.ai.llm import LLMClient
from athena.ai.schemas import CommentInsights
from athena.db.models import OwnPost, PostComment


def _week_start(reference: datetime | None) -> datetime:
    ref = reference or datetime.now(timezone.utc)
    return ref - timedelta(days=7)


def weekly_kpi(session: Session, reference: datetime | None = None) -> dict:
    since = _week_start(reference)
    row = session.query(
        func.count(OwnPost.id),
        func.coalesce(func.sum(OwnPost.views), 0),
        func.coalesce(func.sum(OwnPost.likes), 0),
        func.coalesce(func.sum(OwnPost.interactions), 0),
    ).filter(OwnPost.window_date >= since).one()
    return {"posts": row[0], "views": int(row[1]), "likes": int(row[2]), "interactions": int(row[3])}


class EngagementState(TypedDict):
    reference: Any
    top_post: dict | None
    insights: CommentInsights | None


def _top_post(session: Session, reference: datetime) -> dict | None:
    since = _week_start(reference)
    post = (session.query(OwnPost).filter(OwnPost.window_date >= since)
            .order_by(OwnPost.interactions.desc()).first())
    if not post:
        return None
    return {"source_id": post.source_id, "platform": post.platform, "content": post.content,
            "views": post.views, "likes": post.likes, "interactions": post.interactions}


def _window_comments(session: Session, reference: datetime) -> list[str]:
    since = _week_start(reference)
    own_ids = [r[0] for r in session.query(OwnPost.source_id).filter(OwnPost.window_date >= since).all()]
    if not own_ids:
        return []
    rows = session.query(PostComment.text).filter(PostComment.post_source_id.in_(own_ids)).all()
    return [r[0] for r in rows]


def build_engagement_graph(session: Session, llm: LLMClient):
    def top_post_node(state: EngagementState) -> dict:
        return {"top_post": _top_post(session, state["reference"])}

    def comment_insights_node(state: EngagementState) -> dict:
        comments = _window_comments(session, state["reference"])
        if not comments:
            return {"insights": CommentInsights(summary="No comments this week.")}
        user = "Comments:\n" + "\n".join(f"- {c}" for c in comments)
        insights = llm.structured(
            system=resolve_agent_prompt(session, "comment_insights"),
            user=user, schema=CommentInsights)
        return {"insights": insights}

    g = StateGraph(EngagementState)
    g.add_node("top_post", top_post_node)
    g.add_node("comment_insights", comment_insights_node)
    g.add_edge(START, "top_post")
    g.add_edge("top_post", "comment_insights")
    g.add_edge("comment_insights", END)
    return g.compile()
