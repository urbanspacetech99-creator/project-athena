from datetime import datetime, timezone

from sqlalchemy.orm import Session

from athena.db.models import SavedDraft
from athena.logging_setup import get_logger

log = get_logger("athena.features.drafts")


def create_draft(session: Session, platform: str, caption: str, image_b64: str = "",
                 canva_edit_url: str = "") -> SavedDraft:
    draft = SavedDraft(platform=platform, caption=caption, image_url="",
                       image_b64=image_b64, canva_edit_url=canva_edit_url,
                       created_at=datetime.now(timezone.utc))
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
                 platform: str | None = None) -> SavedDraft | None:
    draft = session.get(SavedDraft, draft_id)
    if draft is None:
        return None
    if caption is not None:
        draft.caption = caption
    if platform is not None:
        draft.platform = platform
    session.commit()
    session.refresh(draft)
    log.info("draft updated", extra={"draft_id": draft_id})
    return draft


def delete_draft(session: Session, draft_id: int) -> bool:
    draft = session.get(SavedDraft, draft_id)
    if draft is None:
        return False
    session.delete(draft)
    session.commit()
    log.info("draft deleted", extra={"draft_id": draft_id})
    return True
