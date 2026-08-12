import { api } from "../../lib/api";
import { AiCard } from "../../components/AiCard";
import { AsyncSection } from "../../components/AsyncSection";
import { StatusBadge } from "../../components/StatusBadge";
import { SuggestedPosts } from "../../components/SuggestedPosts";
import { TagPill } from "../../components/TagPill";
import { useApi, useCachedApi } from "../../hooks/useApi";
import { CACHE_KEYS } from "../../lib/cacheKeys";
import { newestFirst } from "../../lib/derive";
import { fmt } from "../../lib/fmt";
import { RankRows } from "./RankRows";

export function SocialTab({ onGenerate }: { onGenerate: (title: string, context: string) => void }) {
  const social = useCachedApi(CACHE_KEYS.socialReviews, api.socialReviews);
  const posts = useApi(api.ownPosts);
  const comments = useApi(api.postComments);
  const reviews = useApi(api.googleReviews);

  // Rank by interactions — now comment count alone for both platforms (not likes/shares).
  const top = (platform: string) =>
    (posts.data?.items ?? [])
      .filter((p) => p.platform === platform)
      .sort((a, b) => b.interactions - a.interactions || b.likes - a.likes)
      .slice(0, 3);
  const fb = top("facebook");
  const ig = top("instagram");

  const commentsForPost = (sourceId: string) =>
    (comments.data?.items ?? []).filter((c) => c.post_source_id === sourceId);

  return (
    <>
      <div className="ct-title" style={{ marginBottom: 2 }}>Top performing this week <StatusBadge kind="data" source="meta" /></div>
      <div className="ct-sub" style={{ marginBottom: 14 }}>
        Your highest-engagement posts, ranked{social.data ? ` · ${fmt(social.data.views)} total weekly views` : ""}.
      </div>
      <div className="cm-grid" style={{ marginBottom: 20 }}>
        <div className="cm-card">
          <div className="cm-hdr" style={{ background: "#3E6FB0" }}>
            <span>Facebook</span><small>Top 3</small>
            <StatusBadge kind="data" source="meta" light />
          </div>
          <div className="cm-body" style={{ maxHeight: "none", overflowY: "visible" }}>
            <AsyncSection q={posts}>{() => <RankRows posts={fb} />}</AsyncSection>
          </div>
        </div>
        <div className="cm-card">
          <div className="cm-hdr" style={{ background: "#C0392B" }}>
            <span>Instagram</span><small>Top 3</small>
            <StatusBadge kind="data" source="meta" light />
          </div>
          <div className="cm-body" style={{ maxHeight: "none", overflowY: "visible" }}>
            <AsyncSection q={posts}>{() => <RankRows posts={ig} />}</AsyncSection>
          </div>
        </div>
      </div>
      <div className="ct-title" style={{ marginBottom: 2 }}>Comments &amp; Reviews</div>
      <div className="ct-sub" style={{ marginBottom: 14 }}>Recent comments on your posts and Google reviews</div>
      <div className="cm-grid" style={{ marginBottom: 20, gridTemplateColumns: "1fr 1fr 1fr" }}>
        <div className="cm-card">
          <div className="cm-hdr" style={{ background: "#3E6FB0" }}>
            <span>Facebook comments</span>
            <small>{posts.data ? fb.reduce((n, p) => n + commentsForPost(p.source_id).length, 0) : "…"}</small>
            <StatusBadge kind="data" source="meta" light />
          </div>
          <div className="cm-body">
            <AsyncSection q={comments}>
              {() => fb.length === 0
                ? <div className="empty-note">No posts ingested yet.</div>
                : fb.map((p, i) => (
                    <div className="cm-rank-group" key={p.source_id}>
                      <div className="cm-rank-label">Rank {i + 1}</div>
                      {newestFirst(commentsForPost(p.source_id)).map((cm) => (
                        <div className="cm-item" key={cm.id}><div className="cm-txt">{cm.text}</div></div>
                      ))}
                    </div>
                  ))}
            </AsyncSection>
          </div>
        </div>
        <div className="cm-card">
          <div className="cm-hdr" style={{ background: "#C0392B" }}>
            <span>Instagram commenters</span>
            <small>{posts.data ? ig.reduce((n, p) => n + commentsForPost(p.source_id).length, 0) : "…"}</small>
            <StatusBadge kind="data" source="meta" light />
          </div>
          <div className="cm-body">
            <AsyncSection q={comments}>
              {() => ig.length === 0
                ? <div className="empty-note">No posts ingested yet.</div>
                : ig.map((p, i) => (
                    <div className="cm-rank-group" key={p.source_id}>
                      <div className="cm-rank-label">Rank {i + 1}</div>
                      {newestFirst(commentsForPost(p.source_id)).map((cm) => (
                        <div className="cm-item" key={cm.id}><div className="cm-txt">{cm.text}</div></div>
                      ))}
                    </div>
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
                  <ul className="insight-list">
                    {s.insights.review_summary.split(/(?<=[.!?])\s+/).filter(Boolean).map((point, i) => (
                      <li key={i}>{point}</li>
                    ))}
                  </ul>
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