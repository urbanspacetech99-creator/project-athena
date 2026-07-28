import { useState } from "react";
import { api } from "../../api";
import { AiCard } from "../../components/AiCard";
import { AsyncSection } from "../../components/AsyncSection";
import { StatusBadge } from "../../components/StatusBadge";
import { SuggestedPosts } from "../../components/SuggestedPosts";
import { useApi, useCachedApi } from "../../hooks/useApi";
import { CACHE_KEYS } from "../../lib/cacheKeys";
import { competitorPlatformStats, newestFirst } from "../../lib/derive";
import type { CompetitorPlatformStat } from "../../lib/derive";

function splitHashtags(text: string) {
  const words = text.split(/(\s+)/);
  const caption: string[] = [];
  const tags: string[] = [];
  for (const w of words) {
    if (/^#\S+/.test(w.trim())) tags.push(w.trim());
    else caption.push(w);
  }
  return { caption: caption.join("").trim(), tags };
}

function PlatformCard({ label, color, stat }: { label: string; color: string; stat: CompetitorPlatformStat }) {
  return (
    <div className="soc-card">
      <div className="soc-hdr" style={{ background: color }}>
        <span>{label}</span><small>{stat.commentCount} comments</small>
        <StatusBadge kind="data" source="meta" light />
      </div>
      <div className="comp-block">
        <div className="comp-num-lbl">No. of Posts Tracked</div>
        <div className="comp-num-val">{stat.postsTracked}</div>
        <div className="comp-last-active">Last active: {stat.lastActive ? stat.lastActive.slice(0, 10) : "—"}</div>
      </div>
      <div className="comp-sec-title">Recent Posts</div>
      {stat.recent.length === 0
        ? <div className="empty-note">No posts ingested yet.</div>
        : (
      <div className="comp-recent-list">
        {stat.recent.map((p) => {
          const { caption, tags } = splitHashtags(p.text);
          return (
            <div className="comp-post-item" key={p.id}>
              <div className="comp-post-title">{caption}</div>
              {tags.length > 0 && <div className="comp-post-tags">{tags.join(" ")}</div>}
            </div>
          );
        })}
      </div>
        )}
    </div>
  );
}

export function CompetitorTab({ onGenerate }: { onGenerate: (title: string, context: string) => void }) {
  const competitors = useApi(api.listCompetitors);
  const posts = useApi(api.competitorPosts);
  const reviews = useApi(api.competitorReviews);
  const [selected, setSelected] = useState<string | null>(null);

  const rows = competitors.data?.items ?? [];
  const enabled = rows.filter((c) => c.enabled);
  const names = [...new Set(enabled.map((c) => c.name))];
  // Posts are attributed by platform handle (IG username / FB page name), which may be
  // the config row's external_id rather than its display name — fold both onto the display name.
  const aliasToName = new Map<string, string>();
  for (const c of enabled) {
    aliasToName.set(c.name, c.name);
    if (c.external_id) aliasToName.set(c.external_id, c.name);
  }
  const allPosts = (posts.data?.items ?? []).map((p) =>
    aliasToName.has(p.competitor) ? { ...p, competitor: aliasToName.get(p.competitor)! } : p,
  );
  const current = selected !== null && names.includes(selected) ? selected : names[0] ?? null;

  const mine = current ? allPosts.filter((p) => p.competitor === current) : [];
  const fb = competitorPlatformStats(mine, "facebook");
  const ig = competitorPlatformStats(mine, "instagram");
  const myReviews = current
    ? newestFirst((reviews.data?.items ?? []).filter((r) => r.competitor === current))
    : [];
  const placeRating = myReviews[0]?.place_rating ?? 0;
  const placeCount = myReviews[0]?.place_review_count ?? 0;

  // Per-competitor analysis, cached per name; the Research Refresh busts the "competitor" prefix.
  const analysis = useCachedApi(`${CACHE_KEYS.competitor}:${current ?? ""}`,
    () => api.competitor(current ?? undefined), [current]);

  return (
    <>
      <div className="ct-title" style={{ marginBottom: 2 }}>Your Competitors <StatusBadge kind="data" source="meta" /></div>
      <div className="ct-sub" style={{ marginBottom: 14 }}>
        Posts, comments and reviews from your competitors this week, from Facebook, Instagram and Google Reviews
      </div>
      <AsyncSection q={competitors}>
        {() => names.length === 0
          ? <div className="empty-note">No competitors tracked yet — add them in Settings.</div>
          : (
          <>
            <div className="comp-pill-row" style={{ marginBottom: 16 }}>
              {names.map((n) => (
                <button key={n} className={`comp-pill ${n === current ? "on" : ""}`} onClick={() => setSelected(n)}>
                  {n}
                </button>
              ))}
            </div>
            {current && (
              <div className="comp-selected-banner" style={{ marginBottom: 18 }}>
                <div className="comp-selected-avatar">{current[0]}</div>
                <div className="comp-selected-name">{current}</div>
              </div>
            )}
            <div className="comp-3grid" style={{ marginBottom: 20 }}>
              <AsyncSection q={posts}>{() => <PlatformCard label="Facebook" color="#3E6FB0" stat={fb} />}</AsyncSection>
              <AsyncSection q={posts}>{() => <PlatformCard label="Instagram" color="#C0392B" stat={ig} />}</AsyncSection>
              <div className="soc-card">
                <div className="soc-hdr" style={{ background: "#2F7A3D" }}>
                  <span>Google</span>
                  <small>{myReviews.length ? `★${placeRating} · ${placeCount}` : "—"}</small>
                  <StatusBadge kind="data" source="google_places" light />
                </div>
                <AsyncSection q={reviews}>
                  {() => myReviews.length === 0
                    ? <div className="empty-note">No Google reviews for this competitor yet.</div>
                    : (
                    <div style={{ paddingTop: 6 }}>
                      {myReviews.slice(0, 5).map((r) => (
                        <div className="comp-rev" key={r.id}>
                          <span className="cm-name">{r.reviewer}</span>
                          <span className="cm-stars">{"★".repeat(r.star_rating)}</span>
                          <div className="cm-txt">{r.comment}</div>
                        </div>
                      ))}
                    </div>
                  )}
                </AsyncSection>
              </div>
            </div>
          </>
        )}
      </AsyncSection>
      <AsyncSection q={analysis}>
        {(a) => (
          <>
            <AiCard title="AI Strategic Recommendations" tag="AI RECOMMENDATIONS"
              sub={`How to beat ${current ?? "your competitors"}, based on their reviews and public activity`}
              style={{ marginBottom: 16 }}>
              <div className="insight-row" style={{ borderTop: "1px solid #F6E3DD" }}>
                <div style={{ flex: 1 }}>
                  <div className="insight-title">Activity summary</div>
                  <div className="insight-body">{a.insights.activity_summary}</div>
                </div>
              </div>
              {a.insights.recommendations.map((r, i) => (
                <div className="insight-row" style={{ borderTop: "1px solid #F6E3DD" }} key={i}>
                  <div style={{ flex: 1 }}>
                    <div className="insight-title">{r.title}</div>
                    <div className="insight-body">{r.detail}</div>
                  </div>
                </div>
              ))}
            </AiCard>
            <SuggestedPosts title="AI Suggested Posts"
              sub={`Beat ${current ?? "your competitors"}, based on their reviews and public activity`}
              titles={a.titles} subLabel="From competitor analysis"
              onGenerate={(title) => onGenerate(title, a.prefill_prompt)} />
          </>
        )}
      </AsyncSection>
    </>
  );
}
