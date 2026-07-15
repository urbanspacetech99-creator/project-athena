import { api } from "../../api";
import { ASSET } from "../../assets";
import { AiCard } from "../../components/AiCard";
import { AsyncSection } from "../../components/AsyncSection";
import { StatusBadge } from "../../components/StatusBadge";
import { SuggestedPosts } from "../../components/SuggestedPosts";
import { TagPill } from "../../components/TagPill";
import { useApi, useCachedApi } from "../../hooks/useApi";
import { CACHE_KEYS } from "../../lib/cacheKeys";
import { Ico } from "../../icons";
import { newestFirst } from "../../lib/derive";
import { fmt } from "../../lib/fmt";
import type { OwnPostRow } from "../../types";

function RankRows({ posts }: { posts: OwnPostRow[] }) {
  if (posts.length === 0) return <div className="empty-note">No posts ingested yet.</div>;
  return (
    <>
      <div className="rank-header"><span /><span>Ranking</span><span>Likes</span><span>Interactions</span></div>
      {posts.map((p, i) => (
        <div className="rank-row" key={p.id}>
          <span className="rank-num">{i + 1}</span>
          <span className="rank-title">{p.title || p.content}</span>
          <span className="rank-stat"><Ico k="heart" /> {p.likes}</span>
          <span className="rank-stat"><Ico k="msg" /> {p.interactions}</span>
        </div>
      ))}
    </>
  );
}

export function SocialTab({ onGenerate }: { onGenerate: (title: string, context: string) => void }) {
  // own_posts window_date is the post's publish date (stable across re-ingests), so rows never duplicate per week — no dedupe needed, unlike keyword volumes.
  const social = useCachedApi(CACHE_KEYS.socialReviews, api.socialReviews);
  const posts = useApi(api.ownPosts);
  const comments = useApi(api.postComments);
  const reviews = useApi(api.googleReviews);

  // Rank by interactions — real for both platforms (FB = likes+shares+comments, IG = insight).
  // The Meta adapter has no Facebook views metric (FB rows always carry views: 0), so sorting
  // by views would reduce the FB ranking to arbitrary insertion order.
  const top = (platform: string) =>
    (posts.data?.items ?? [])
      .filter((p) => p.platform === platform)
      .sort((a, b) => b.interactions - a.interactions)
      .slice(0, 3);
  const fb = top("facebook");
  const ig = top("instagram");

  return (
    <>
      <div className="ct-title" style={{ marginBottom: 2 }}>Engagement <StatusBadge kind="data" source="meta" /></div>
      <div className="ct-sub" style={{ marginBottom: 14 }}>
        Views and likes of your posts this week{social.data ? ` · ${fmt(social.data.views)} total weekly views` : ""}.
      </div>
      <div className="soc-grid" style={{ marginBottom: 20 }}>
        <div className="soc-card">
          <div className="soc-hdr" style={{ background: "#3E6FB0" }}>
            <span>Facebook</span><small>{posts.data ? `${fb.length} posts` : "…"}</small>
            <StatusBadge kind="data" source="meta" light />
          </div>
          <div className="soc-preview-wrap" style={{ background: "#3E6FB0" }}>
            <img className="soc-preview-img" src={ASSET.FB_PREVIEW} alt="Facebook page preview" />
          </div>
          <AsyncSection q={posts}>{() => <RankRows posts={fb} />}</AsyncSection>
        </div>
        <div className="soc-card">
          <div className="soc-hdr" style={{ background: "#C0392B" }}>
            <span>Instagram</span><small>{posts.data ? `${ig.length} posts` : "…"}</small>
            <StatusBadge kind="data" source="meta" light />
          </div>
          <div className="soc-preview-wrap" style={{ background: "#C0392B" }}>
            <img className="soc-preview-img" src={ASSET.IG_PREVIEW} alt="Instagram profile preview" />
          </div>
          <AsyncSection q={posts}>{() => <RankRows posts={ig} />}</AsyncSection>
        </div>
      </div>
      <div className="ct-title" style={{ marginBottom: 2 }}>Comments &amp; Reviews</div>
      <div className="ct-sub" style={{ marginBottom: 14 }}>Recent comments on your posts and Google reviews</div>
      <div className="cm-grid" style={{ marginBottom: 20 }}>
        <div className="cm-card">
          <div className="cm-hdr" style={{ background: "#3E6FB0" }}>
            <span>Post comments</span><small>{comments.data?.count ?? "…"} total</small>
            <StatusBadge kind="data" source="meta" light />
          </div>
          <div className="cm-body">
            <AsyncSection q={comments}>
              {(c) => c.items.length === 0
                ? <div className="empty-note">No comments yet.</div>
                : newestFirst(c.items).slice(0, 8).map((cm) => (
                    <div className="cm-item" key={cm.id}><div className="cm-txt">{cm.text}</div></div>
                  ))}
            </AsyncSection>
          </div>
        </div>
        <div className="cm-card">
          <AsyncSection q={reviews}>
            {(r) => {
              const avg = r.items.length
                ? (r.items.reduce((a, x) => a + x.star_rating, 0) / r.items.length).toFixed(1) : null;
              return (
                <>
                  <div className="cm-hdr" style={{ background: "#2F7A3D" }}>
                    {/* avg and count both describe the fetched tail window; r.count is all-time and only used when there is nothing to average */}
                    <span>Google</span><small>{avg ? `★${avg} · ${r.items.length}` : `${r.count} reviews`}</small>
                    <StatusBadge kind="data" source="google_reviews" light />
                  </div>
                  <div className="cm-body">
                    {r.items.length === 0
                      ? <div className="empty-note">No reviews yet.</div>
                      : newestFirst(r.items).slice(0, 6).map((rv) => (
                          <div className="cm-item" key={rv.id}>
                            <span className="cm-name">{rv.reviewer}</span>
                            <span className="cm-stars">{"★".repeat(rv.star_rating)}</span>
                            <div className="cm-txt">{rv.comment}</div>
                          </div>
                        ))}
                  </div>
                </>
              );
            }}
          </AsyncSection>
        </div>
      </div>
      <AsyncSection q={social}>
        {(s) => (
          <>
            <AiCard title="AI Insights & Patterns" sub="Recurring themes in comments and reviews" tag="AI PATTERNS">
              <div className="insight-row" style={{ borderTop: "1px solid #F6E3DD" }}>
                <div style={{ flex: 1 }}>
                  <div className="insight-title">Review summary</div>
                  <div className="insight-body">{s.insights.review_summary}</div>
                </div>
              </div>
              <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginTop: 10 }}>
                {s.insights.comment_topics.map((t, i) => (
                  <TagPill key={i} style={{ background: "var(--ai-l)", color: "var(--ai-d)" }}>{t}</TagPill>
                ))}
              </div>
            </AiCard>
            <div style={{ height: 16 }} />
            <SuggestedPosts title="AI Suggested Posts" sub="Post ideas from social engagement and reviews"
              titles={s.titles} subLabel="From social & review analysis"
              onGenerate={(title) => onGenerate(title, s.prefill_prompt)} />
          </>
        )}
      </AsyncSection>
    </>
  );
}
