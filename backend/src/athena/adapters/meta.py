# Field lists verified against Graph API v25.0 docs on 2026-07-12.
import base64
import json
from athena.logging_setup import get_logger
from datetime import datetime
from pathlib import Path
from typing import Any

import httpx

from athena.adapters.base import SourceAdapter, raise_on_error_envelope
from athena.config import Settings

FIXTURE_DIR = Path(__file__).parent / "fixtures"
GRAPH = "https://graph.facebook.com/v25.0"
log = get_logger("athena.adapters.meta")

def _parse_ts(ts: str) -> datetime:
    return datetime.strptime(ts, "%Y-%m-%dT%H:%M:%S%z")


class MetaOwnPostsAdapter(SourceAdapter):
    source = "meta"

    def __init__(self, mode, settings: Settings | None = None):
        super().__init__(mode)
        self.settings = settings or Settings()

    def _load(self, name: str) -> Any:
        return json.loads((FIXTURE_DIR / name).read_text(encoding="utf-8"))

    def fetch_fixture(self, **kwargs):
        return {
            "fb_posts": self._load("meta_own_posts.json"),
            "ig_media": self._load("meta_ig_media.json"),
            "ig_insights": self._load("meta_ig_insights.json"),
        }

    def fetch_live(self, **kwargs):
        s = self.settings
        token = getattr(s, "meta_page_token", "") or ""
        page = getattr(s, "meta_page_id", "") or ""
        ig = getattr(s, "meta_ig_user_id", "") or ""
        with httpx.Client(base_url=GRAPH, timeout=30) as c:
            fb_posts = raise_on_error_envelope(c.get(f"/{page}/posts", params={
                "fields": "message,created_time,permalink_url,shares,full_picture,"
                          "attachments{media_type},"
                          "reactions.summary(true),comments.summary(true)",
                "access_token": token}).json(), "graph api")
            ig_media = raise_on_error_envelope(c.get(f"/{ig}/media", params={
                "fields": "caption,media_type,media_product_type,timestamp,permalink,"
                          "username,like_count,comments_count,media_url,thumbnail_url,"
                          "children{media_type,media_url,thumbnail_url}",
                "access_token": token}).json(), "graph api")
            ig_insights = {}
            for m in ig_media.get("data", []):
                ig_insights[m["id"]] = raise_on_error_envelope(c.get(f"/{m['id']}/insights", params={
                    "metric": "reach,views,likes,comments,total_interactions",
                    "access_token": token}).json(), "graph api")
        return {"fb_posts": fb_posts, "ig_media": ig_media, "ig_insights": ig_insights}

    @staticmethod
    def _download_image_b64(url: str) -> str:
        """Best-effort image download. Meta's media URLs are signed and expire in
        roughly a day, so we pull the bytes once at ingestion time and store our own
        copy rather than depending on a URL that won't still work next week."""
        if not url:
            return ""
        try:
            resp = httpx.get(url, timeout=15)
            resp.raise_for_status()
            return base64.b64encode(resp.content).decode()
        except Exception:
            log.warning("post image download failed", extra={"url": url})
            return ""

    @staticmethod
    def _ig_image_src(m: dict) -> tuple[str, bool]:
        """Returns (image_url, is_video). Carousel posts don't expose media_url at the
        top level at all — Instagram requires reading the first child item instead."""
        media_type = m.get("media_type", "")
        if media_type == "CAROUSEL_ALBUM":
            children = (m.get("children") or {}).get("data", [])
            if children:
                m = children[0]
                media_type = m.get("media_type", "")
        is_video = media_type == "VIDEO"
        return (m.get("thumbnail_url", "") if is_video else m.get("media_url", "")), is_video

    def normalize(self, raw) -> list[dict]:
        #from athena.ai.images import PLACEHOLDER_PNG_B64
        rows: list[dict] = []
        for p in raw["fb_posts"].get("data", []):
            likes = p.get("reactions", {}).get("summary", {}).get("total_count", 0)
            comments = p.get("comments", {}).get("summary", {}).get("total_count", 0)
            shares = p.get("shares", {}).get("count", 0)
            #image_b64 = (self._download_image_b64(p.get("full_picture", ""))
                         #if self.mode == "live" else PLACEHOLDER_PNG_B64)
            attachments = (p.get("attachments") or {}).get("data") or [{}]
            is_video = attachments[0].get("media_type") == "video"
            rows.append({"source_id": p["id"], "platform": "facebook", "title": "",
                         "content": p.get("message", ""), "views": 0,
                         "likes": likes, "interactions": likes + shares + comments,
                         "image_b64": "", "_image_src": p.get("full_picture", ""),
                         "permalink": p.get("permalink_url", ""), "is_video": is_video,
                         "window_date": _parse_ts(p["created_time"])})
        insights_by_id = raw.get("ig_insights", {})
        for m in raw["ig_media"].get("data", []):
            ins = {d["name"]: d["values"][0]["value"]
                   for d in insights_by_id.get(m["id"], {}).get("data", [])}
            media_src, is_video = self._ig_image_src(m)
            rows.append({"source_id": m["id"], "platform": "instagram", "title": "",
                         "content": m.get("caption", ""), "views": ins.get("views", 0),
                         "likes": ins.get("likes", m.get("like_count", 0)),
                         "interactions": ins.get("total_interactions",
                                                 m.get("like_count", 0) + m.get("comments_count", 0)),
                         "image_b64": "", "_image_src": media_src,
                         "permalink": m.get("permalink", ""), "is_video": is_video,
                         "window_date": _parse_ts(m["timestamp"])})
        return rows

    # --- comments (separate stream -> PostComment) ---
    def fetch_comments_fixture(self):
        return self._load("meta_own_comments.json")

    def fetch_comments_live(self, post_id: str):
        token = getattr(self.settings, "meta_page_token", "") or ""
        with httpx.Client(base_url=GRAPH, timeout=30) as c:
            body = c.get(f"/{post_id}/comments", params={
                "fields": "message,created_time,from,like_count,comment_count",
                "access_token": token}).json()
        return raise_on_error_envelope(body, "graph api")

    def normalize_comments(self, raw) -> list[dict]:
        rows = []
        for cm in raw.get("data", []):
            post_source_id = cm["id"].rsplit("_", 1)[0]
            rows.append({"source_id": cm["id"], "post_source_id": post_source_id,
                         "text": cm.get("message", ""), "window_date": _parse_ts(cm["created_time"])})
        return rows


class MetaCompetitorAdapter(SourceAdapter):
    source = "meta"

    def __init__(self, mode, competitor: str, page_id: str = "",
                 settings: Settings | None = None):
        super().__init__(mode)
        self.competitor = competitor
        self.page_id = page_id
        self.settings = settings or Settings()

    def _load(self, name: str) -> Any:
        return json.loads((FIXTURE_DIR / name).read_text(encoding="utf-8"))

    def fetch_fixture(self, **kwargs):
        return self._load("meta_competitor_posts.json")

    def fetch_live(self, **kwargs):
        if not getattr(self.settings, "competitor_live_access_enabled", False):
            raise RuntimeError("competitor live access not enabled (PPCA required, see risk R1)")
        if not self.page_id:
            raise RuntimeError(f"competitor {self.competitor!r} has no page_id configured")
        token = getattr(self.settings, "meta_page_token", "") or ""
        with httpx.Client(base_url=GRAPH, timeout=30) as c:
            body = c.get(f"/{self.page_id}/posts", params={
                "fields": "message,created_time,permalink_url,from,shares,"
                          "reactions.summary(true),comments.summary(true)",
                "access_token": token}).json()
        return raise_on_error_envelope(body, "graph api")

    def normalize(self, raw) -> list[dict]:
        rows = []
        for p in raw.get("data", []):
            name = (p.get("from") or {}).get("name") or self.competitor
            likes = p.get("reactions", {}).get("summary", {}).get("total_count", 0)
            comments = p.get("comments", {}).get("summary", {}).get("total_count", 0)
            rows.append({"source_id": p["id"], "competitor": name, "platform": "facebook",
                         "text": p.get("message", ""), "like_count": likes,
                         "comment_count": comments,
                         "window_date": _parse_ts(p["created_time"])})
        return rows

    def fetch_comments_fixture(self):
        return self._load("meta_competitor_comments.json")

    def normalize_comments(self, raw) -> list[dict]:
        rows = []
        for cm in raw.get("data", []):
            rows.append({"source_id": cm["id"], "post_source_id": cm["id"].rsplit("_", 1)[0],
                         "text": cm.get("message", ""), "window_date": _parse_ts(cm["created_time"])})
        return rows


class MetaIGCompetitorAdapter(SourceAdapter):
    """Competitor Instagram posts via Business Discovery (through our own IG business
    account — no PPCA needed; requires instagram_basic + business discovery permission).
    Business Discovery exposes NO comment text, so there is no comments stream here."""

    source = "meta"

    def __init__(self, mode, competitor: str, username: str = "",
                 settings: Settings | None = None):
        super().__init__(mode)
        self.competitor = competitor
        self.username = username
        self.settings = settings or Settings()

    def _load(self, name: str) -> Any:
        return json.loads((FIXTURE_DIR / name).read_text(encoding="utf-8"))

    def fetch_fixture(self, **kwargs):
        return self._load("meta_ig_competitor.json")

    def fetch_live(self, **kwargs):
        if not self.username:
            raise RuntimeError(f"competitor {self.competitor!r} has no IG username configured")
        token = getattr(self.settings, "meta_page_token", "") or ""
        ig = getattr(self.settings, "meta_ig_user_id", "") or ""
        if not ig:
            raise RuntimeError("meta_ig_user_id is not configured (business discovery "
                               "queries go through our own IG business account)")
        fields = (f"business_discovery.username({self.username})"
                  "{username,media{caption,media_type,permalink,timestamp,"
                  "like_count,comments_count,media_url,thumbnail_url,"
                  "children{media_type,media_url,thumbnail_url}}}")
        with httpx.Client(base_url=GRAPH, timeout=30) as c:
            body = c.get(f"/{ig}", params={"fields": fields, "access_token": token}).json()
        return raise_on_error_envelope(body, "graph api")

    def normalize(self, raw) -> list[dict]:
        bd = raw.get("business_discovery") or {}
        name = bd.get("username") or self.competitor
        rows = []
        for m in (bd.get("media") or {}).get("data", []):
            media_src, is_video = MetaOwnPostsAdapter._ig_image_src(m)
            rows.append({"source_id": m["id"], "competitor": name, "platform": "instagram",
                         "text": m.get("caption", ""),
                         "like_count": m.get("like_count", 0),
                         "comment_count": m.get("comments_count", 0),
                         "image_b64": "", "_image_src": media_src,
                         "permalink": m.get("permalink", ""), "is_video": is_video,
                         "window_date": _parse_ts(m["timestamp"])})
        return rows
