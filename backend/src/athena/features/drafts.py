import base64
from datetime import datetime, timezone

from sqlalchemy.orm import Session

from athena.db.models import SavedDraft
from athena.logging_setup import get_logger
from athena.integrations.canva import CanvaClient
from athena.ai.images import GeneratedImage

_IMAGE_SIGNATURES = (b"\x89PNG\r\n\x1a\n", b"\xff\xd8\xff")  # PNG, JPEG

log = get_logger("athena.features.drafts")

def _looks_like_image(image_b64: str) -> bool:
    try:
        data = base64.b64decode(image_b64, validate=True)
    except Exception:
        return False
    return any(data.startswith(sig) for sig in _IMAGE_SIGNATURES)

def open_canva_design(session: Session, draft_id: int, canva: CanvaClient) -> SavedDraft | None:
    draft = session.get(SavedDraft, draft_id)
    if draft is None:
        return None
    existing_url = canva.get_design_edit_url(draft.canva_design_id) if draft.canva_design_id else None
    if existing_url is not None:
        return draft
    image = GeneratedImage(mime_type="image/png", data_b64=draft.image_b64)
    handoff = canva.upload_and_edit_url(image, title=draft.platform)
    draft.canva_edit_url = handoff.edit_url
    draft.canva_design_id = handoff.design_id
    session.commit()
    session.refresh(draft)
    log.info("recreated deleted canva design", extra={"draft_id": draft_id})
    return draft



def create_draft(session: Session, platform: str, caption: str, image_b64: str = "",
                 canva_edit_url: str = "", canva_design_id: str = "") -> SavedDraft:
    draft = SavedDraft(platform=platform, caption=caption, image_url="",
                       image_b64=image_b64, canva_edit_url=canva_edit_url,
                       canva_design_id=canva_design_id, created_at=datetime.now(timezone.utc))
    session.add(draft)
    session.commit()
    session.refresh(draft)
    log.info("draft created", extra={"draft_id": draft.id, "platform": platform})
    return draft


def list_drafts(session: Session) -> list[SavedDraft]:
    return session.query(SavedDraft).order_by(SavedDraft.created_at.desc()).all()


def get_draft(session: Session, draft_id: int) -> SavedDraft | None:
    return session.get(SavedDraft, draft_id)


def update_draft(session: Session, draft_id: int, caption: str | None = None,
                 platform: str | None = None, image_b64: str | None = None) -> SavedDraft | None:
    draft = session.get(SavedDraft, draft_id)
    if draft is None:
        return None
    if caption is not None:
        draft.caption = caption
    if platform is not None:
        draft.platform = platform
    if image_b64 is not None:
        if not _looks_like_image(image_b64):
            raise ValueError("uploaded file is not a valid PNG or JPEG image")
        draft.image_b64 = image_b64
    session.commit()
    session.refresh(draft)
    log.info("draft updated", extra={"draft_id": draft_id})
    return draft

def fetch_canva_image(session: Session, draft_id: int, canva: CanvaClient) -> SavedDraft | None:
    draft = session.get(SavedDraft, draft_id)
    if draft is None:
        return None
    if not draft.canva_design_id:
        raise ValueError("draft has no canva_design_id")
    image = canva.fetch_latest_image(draft.canva_design_id)
    draft.image_b64 = image.data_b64
    session.commit()
    session.refresh(draft)
    log.info("draft image refreshed from canva", extra={"draft_id": draft_id})
    return draft


def delete_draft(session: Session, draft_id: int) -> bool:
    draft = session.get(SavedDraft, draft_id)
    if draft is None:
        return False
    session.delete(draft)
    session.commit()
    log.info("draft deleted", extra={"draft_id": draft_id})
    return True
