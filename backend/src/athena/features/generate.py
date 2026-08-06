from datetime import datetime, timezone
from typing import Any

from langgraph.graph import END, START, StateGraph
from sqlalchemy.orm import Session
from typing_extensions import TypedDict

from athena.ai.agents import resolve_agent_prompt
from athena.ai.images import GeneratedImage, ImageClient
from athena.ai.llm import LLMClient
from athena.ai.schemas import ImagePromptSpec, PostCaption
from athena.db.models import GeneratedPost
from athena.integrations.canva import CanvaClient
from athena.logging_setup import get_logger
from athena.ai.images import GeneratedImage, ImageClient, PLACEHOLDER_PNG_B64

log = get_logger("athena.features.generate")

_ASPECT = {"instagram": "1:1", "facebook": "1:1", "story": "9:16"}


class PostOptionState(TypedDict):
    brief: dict
    option_index: int
    caption: PostCaption | None
    caption_failed: bool
    image_prompt: ImagePromptSpec | None
    image: GeneratedImage | None
    image_failed: bool


def _includes(brief: dict) -> str:
    wanted = [k for k in ("hashtags", "cta", "emoji", "pricing") if brief.get(f"include_{k}")]
    return ", ".join(wanted) or "none"


def build_post_option_graph(llm: LLMClient, image_client: ImageClient,
                            caption_system: str, image_prompt_system: str):
    def caption_node(state: PostOptionState) -> dict:
        b = state["brief"]
        try:
            cap = llm.structured(
                system=caption_system,
                user=(f"Platform: {b['platform']}. Tone: {b['tone']}. Length: {b['length']}. "
                      f"Include: {_includes(b)}. Variation #{state['option_index'] + 1}. "
                      f"Brief: {b.get('prefill_prompt', '')}"),
                schema=PostCaption)
            return {"caption": cap, "caption_failed": False}
        except Exception:
            log.warning("caption generation failed, falling back to manual draft", exc_info=True)
            return {"caption": None, "caption_failed": True}

    def image_prompt_node(state: PostOptionState) -> dict:
        b = state["brief"]
        caption_text = state["caption"].caption if state["caption"] else b.get("prefill_prompt", "")
        try:
            spec = llm.structured(
                system=image_prompt_system,
                user=(f"Visual style: {b.get('visual_style', 'clean_product')}. "
                      f"Caption: {caption_text}. Brief: {b.get('prefill_prompt', '')}"),
                schema=ImagePromptSpec)
            return {"image_prompt": spec}
        except Exception:
            # Same LLM as caption_node — if Claude is down this fails too, so the fallback
            # must not depend on it: build a deterministic prompt from the raw brief instead.
            log.warning("image prompt generation failed, using deterministic fallback", exc_info=True)
            style = b.get("visual_style", "clean_product")
            fallback = ImagePromptSpec(
                prompt=f"{style.replace('_', ' ')} social media visual. {b.get('prefill_prompt', '')}".strip(),
                visual_style=style)
            return {"image_prompt": fallback}

    def image_node(state: PostOptionState) -> dict:
        b = state["brief"]
        aspect = _ASPECT.get(b["platform"], "1:1")
        try:
            img = image_client.generate(state["image_prompt"].prompt, aspect_ratio=aspect)
            return {"image": img, "image_failed": False}
        except Exception:
            log.warning("image generation failed, falling back to placeholder", exc_info=True)
            return {"image": GeneratedImage(mime_type="image/png", data_b64=PLACEHOLDER_PNG_B64),
                    "image_failed": True}

    g = StateGraph(PostOptionState)
    g.add_node("caption", caption_node)
    g.add_node("image_prompt", image_prompt_node)
    g.add_node("image", image_node)
    g.add_edge(START, "caption")
    g.add_edge("caption", "image_prompt")
    g.add_edge("image_prompt", "image")
    g.add_edge("image", END)
    return g.compile()


_STEP_LABEL = {"caption": "caption written", "image_prompt": "image prompt designed",
               "image": "image generated"}


def generate_post_stream(session: Session, llm: LLMClient, image_client: ImageClient,
                         canva: CanvaClient, brief: dict, options: int = 3):
    """Streaming variant of Feature 8: yields a progress event dict per completed step
    (3 graph nodes + 1 Canva upload per option; total = options*4), then one result
    event. Persists all rows in a single commit at the end, exactly like generate_post —
    a mid-stream failure persists nothing."""
    graph = build_post_option_graph(
        llm, image_client,
        caption_system=resolve_agent_prompt(session, "caption_writer"),
        image_prompt_system=resolve_agent_prompt(session, "image_prompt_designer"))
    now = datetime.now(timezone.utc)
    total = options * 4
    step = 0
    result: list[dict[str, Any]] = []
    log.info("post generation start", extra={"platform": brief.get("platform"), "options": options})
    yield {"event": "progress", "step": 0, "total": total, "label": "Starting…"}
    for i in range(options):
        state: dict[str, Any] = {"brief": brief, "option_index": i, "caption": None,
                                 "caption_failed": False, "image_prompt": None,
                                 "image": None, "image_failed": False}
        for update in graph.stream(state, stream_mode="updates"):
            for node, values in update.items():
                state.update(values)
                step += 1
                yield {"event": "progress", "step": step, "total": total,
                       "label": f"Option {i + 1}: {_STEP_LABEL.get(node, node)}"}
        caption: PostCaption | None = state["caption"]
        spec: ImagePromptSpec = state["image_prompt"]
        image: GeneratedImage = state["image"]
        caption_text = caption.caption if caption else ""
        hashtags = caption.hashtags if caption else []
        try:
            handoff = canva.upload_and_edit_url(image, title=f"{brief.get('platform', 'post')}-{i + 1}")
            edit_url = handoff.edit_url
            design_id = handoff.design_id
        except Exception:
            log.warning("canva upload failed", exc_info=True)
            edit_url = ""
            design_id = ""
        step += 1
        yield {"event": "progress", "step": step, "total": total,
               "label": f"Option {i + 1}: Canva design created"}
        session.add(GeneratedPost(
            platform=brief["platform"], caption=caption_text, image_url="",
            image_b64=image.data_b64, canva_edit_url=edit_url,
            source_feature="post_generator", prefill_prompt=brief.get("prefill_prompt", ""),
            visual_style=spec.visual_style, created_at=now))
        result.append({
            "caption": caption_text, "hashtags": hashtags,
            "image_b64": image.data_b64, "mime_type": image.mime_type,
            "canva_edit_url": edit_url, "canva_design_id": design_id, "visual_style": spec.visual_style,
            "caption_failed": state["caption_failed"], "image_failed": state["image_failed"]})
    session.commit()
    log.info("post generation done", extra={"options": len(result)})
    yield {"event": "result", "data": {"options": result}}


def generate_post(session: Session, llm: LLMClient, image_client: ImageClient,
                  canva: CanvaClient, brief: dict, options: int = 3) -> dict:
    """Feature 8: run the caption->image_prompt->image chain `options` times, upload each to
    Canva, persist an audit row per option, and return the option list."""
    for event in generate_post_stream(session, llm, image_client, canva, brief, options):
        if event["event"] == "result":
            return event["data"]
    raise RuntimeError("post generation stream ended without a result")
