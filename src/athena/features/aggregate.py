import operator
from typing import Annotated

from langgraph.graph import END, START, StateGraph
from sqlalchemy.orm import Session, sessionmaker
from typing_extensions import TypedDict

from athena.ai.agents import resolve_agent_prompt
from athena.ai.llm import LLMClient
from athena.ai.schemas import AggregatedRecommendations
from athena.features import research
from athena.logging_setup import get_logger

log = get_logger("athena.features.aggregate")


class AggState(TypedDict):
    findings: Annotated[list, operator.add]
    result: AggregatedRecommendations | None


def build_aggregator_graph(session: Session, llm: LLMClient):
    """Feature 10: supervisor fan-out across the four research sources, then synthesis.

    LangGraph runs the four analyst nodes concurrently (real threads) in one superstep, so
    each node opens its OWN Session on the shared engine rather than sharing `session`
    (SQLAlchemy Sessions are not thread-safe). `session` is used only to locate the engine.
    """
    make_session = sessionmaker(bind=session.get_bind())

    def _finding(source: str, summary: str) -> dict:
        return {"findings": [{"source": source, "summary": summary}]}

    def internet_trends_node(_: AggState) -> dict:
        with make_session() as s:
            data = research.research_internet_trends(s, llm)
        kws = ", ".join(k["keyword"] for k in data["keywords"]) or "none"
        return _finding("internet_trends", f"Top keywords: {kws}. {data['prefill_prompt']}")

    def customer_insights_node(_: AggState) -> dict:
        with make_session() as s:
            data = research.customer_insights_summary(s, llm)
        return _finding("customer_insights", data["insights"].summary)

    def social_reviews_node(_: AggState) -> dict:
        with make_session() as s:
            data = research.research_social_reviews(s, llm)
        return _finding("social_reviews", f"Views {data['views']}. {data['insights'].review_summary}")

    def competitor_node(_: AggState) -> dict:
        with make_session() as s:
            data = research.research_competitor(s, llm)
        return _finding("competitor", data["insights"].activity_summary)

    def synthesis_node(state: AggState) -> dict:
        body = "\n".join(f"[{f['source']}] {f['summary']}" for f in state["findings"])
        log.info("aggregator synthesis", extra={"n_findings": len(state["findings"])})
        with make_session() as s:
            system = resolve_agent_prompt(s, "aggregator_synthesis")
        rec = llm.structured(system=system, user=body, schema=AggregatedRecommendations)
        return {"result": rec}

    g = StateGraph(AggState)
    analysts = {"internet_trends": internet_trends_node,
                "customer_insights": customer_insights_node,
                "social_reviews": social_reviews_node,
                "competitor": competitor_node}
    for name, node in analysts.items():
        g.add_node(name, node)
        g.add_edge(START, name)          # fan-out: all four start in one superstep (real threads)
        g.add_edge(name, "synthesis")    # barrier: synthesis waits for all four
    g.add_node("synthesis", synthesis_node)
    g.add_edge("synthesis", END)
    return g.compile()


def aggregated_recommendations(session: Session, llm: LLMClient) -> dict:
    state = build_aggregator_graph(session, llm).invoke({"findings": [], "result": None})
    rec = state["result"]
    return {"titles": rec.titles, "prefill_prompt": rec.prefill_prompt, "rationale": rec.rationale}
