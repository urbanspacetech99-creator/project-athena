from datetime import datetime, timezone

from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from athena.api import schemas
from athena.api.deps import get_llm, get_session
from athena.features.home import build_engagement_graph, weekly_kpi

router = APIRouter(prefix="/home", tags=["home"])


@router.get("/weekly-kpi", response_model=schemas.KpiSnapshotOut,
            summary="Weekly KPI snapshot (views, likes, interactions, posts) for the past 7 days")
def weekly_kpi_endpoint(session: Session = Depends(get_session)):
    """Headline performance numbers over the past week (fixed 7-day window)."""
    return weekly_kpi(session)


@router.get("/weekly-engagement", response_model=schemas.EngagementSummaryOut,
            summary="Weekly engagement: top post + AI comment insights")
def weekly_engagement_endpoint(session: Session = Depends(get_session), llm=Depends(get_llm)):
    """Top-performing post this week plus an AI reading of comment themes, sentiment, and feedback."""
    graph = build_engagement_graph(session, llm)
    out = graph.invoke({"reference": datetime.now(timezone.utc), "top_post": None, "insights": None})
    return {"top_post": out["top_post"], "insights": out["insights"]}
