import { useState } from "react";
import { api } from "../../api";
import { AiCard } from "../../components/AiCard";
import { AsyncSection } from "../../components/AsyncSection";
import { SuggestedPosts } from "../../components/SuggestedPosts";
import { useApi } from "../../hooks/useApi";
import { competitorActivity, newestFirst } from "../../lib/derive";

export function CompetitorTab({ onGenerate }: { onGenerate: (title: string, context: string) => void }) {
  const competitors = useApi(api.listCompetitors);
  const analysis = useApi(api.competitor);
  const posts = useApi(api.competitorPosts);
  const [selected, setSelected] = useState<string | null>(null);

  const rows = competitors.data?.items ?? [];
  const enabled = rows.filter((c) => c.enabled);
  // Unique enabled competitor display names (a name may exist once per platform).
  const names = [...new Set(enabled.map((c) => c.name))];
  // Ingested posts are attributed by the platform (IG username / FB page name), which may be
  // the config row's external_id rather than its display name — join on both.
  const aliasToName = new Map<string, string>();
  for (const c of enabled) {
    aliasToName.set(c.name, c.name);
    if (c.external_id) aliasToName.set(c.external_id, c.name);
  }
  const allPosts = (posts.data?.items ?? []).map((p) =>
    aliasToName.has(p.competitor) ? { ...p, competitor: aliasToName.get(p.competitor)! } : p,
  );
  const unmatched = allPosts.filter((p) => !names.includes(p.competitor)).length;
  const current = selected !== null && names.includes(selected) ? selected : names[0] ?? null;
  const acts = competitorActivity(allPosts, names);
  const act = acts.find((a) => a.name === current);
  const recent = current
    ? newestFirst(allPosts.filter((p) => p.competitor === current)).slice(0, 6)
    : [];

  return (
    <>
      <div className="ct-title" style={{ marginBottom: 2 }}>Your Competitors</div>
      <div className="ct-sub" style={{ marginBottom: 14 }}>
        Posting activity of tracked competitors, from Facebook and Instagram public pages
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
            <AsyncSection q={posts}>
              {() => act ? (
                <>
                  <div className="kpi-list" style={{ marginBottom: 20 }}>
                    <div className="ktile fill">
                      <div><div className="kval">{act.total}</div><div className="klbl">Posts tracked</div></div>
                    </div>
                    <div className="ktile plain">
                      <div><div className="kval">{act.facebook} / {act.instagram}</div><div className="klbl">Facebook / Instagram</div></div>
                    </div>
                    <div className="ktile fill">
                      <div><div className="kval">{act.last30}</div><div className="klbl">Posts last 30 days</div></div>
                    </div>
                    <div className="ktile plain">
                      <div>
                        <div className="kval">{act.lastActive ? act.lastActive.slice(0, 10) : "—"}</div>
                        <div className="klbl">Last active</div>
                      </div>
                    </div>
                  </div>
                  <div className="ct-card" style={{ marginBottom: 20 }}>
                    <div className="ct-title">Activity share</div>
                    <div className="ct-sub">Share of tracked competitor posts · latest {allPosts.length} fetched</div>
                    {acts.map((a) => (
                      <div className="bar-row" key={a.name}>
                        <div className="bar-lbl">{a.name}</div>
                        <div className="bar-track">
                          <div className="bar-fill" style={{
                            width: `${Math.max(4, a.sharePct)}%`,
                            background: a.name === current ? "var(--ora)" : "var(--gold)",
                          }}>
                            <span>{a.sharePct}%</span>
                          </div>
                        </div>
                      </div>
                    ))}
                    {unmatched > 0 && (
                      <div className="empty-note">{unmatched} fetched {unmatched === 1 ? "post" : "posts"} could not be matched to a tracked competitor and {unmatched === 1 ? "is" : "are"} not shown.</div>
                    )}
                  </div>
                  <div className="ct-card" style={{ marginBottom: 20 }}>
                    <div className="ct-title">Recent posts — {current}</div>
                    <div className="ct-sub">Latest public posts from this competitor</div>
                    {recent.length === 0
                      ? <div className="empty-note">No posts ingested for this competitor yet.</div>
                      : recent.map((p) => (
                          <div className="comp-post-title" key={p.id}>
                            {p.text} <span style={{ color: "var(--faint)" }}>· {p.platform} · {p.window_date.slice(0, 10)}</span>
                          </div>
                        ))}
                  </div>
                </>
              ) : null}
            </AsyncSection>
          </>
        )}
      </AsyncSection>
      <AsyncSection q={analysis}>
        {(a) => (
          <>
            <AiCard title="AI Strategic Recommendations" tag="AI RECOMMENDATIONS"
              sub="How to beat your competitors, based on their public activity" style={{ marginBottom: 16 }}>
              <div className="insight-row" style={{ borderTop: "1px solid #F6E3DD" }}>
                <div style={{ flex: 1 }}>
                  <div className="insight-title">Activity summary</div>
                  <div className="insight-body">{a.insights.activity_summary}</div>
                </div>
              </div>
              {a.insights.weaknesses.map((w, i) => (
                <div className="insight-row" style={{ borderTop: "1px solid #F6E3DD" }} key={`w${i}`}>
                  <div style={{ flex: 1 }}>
                    <div className="insight-title">Competitor weakness</div>
                    <div className="insight-body">{w}</div>
                  </div>
                </div>
              ))}
              {a.insights.gaps.map((g, i) => (
                <div className="insight-row" style={{ borderTop: "1px solid #F6E3DD" }} key={`g${i}`}>
                  <div style={{ flex: 1 }}>
                    <div className="insight-title">Content gap</div>
                    <div className="insight-body">{g}</div>
                  </div>
                </div>
              ))}
            </AiCard>
            <SuggestedPosts title="AI Suggested Posts" sub="Beat your competitors, based on their public activity"
              titles={a.titles} subLabel="From competitor analysis"
              onGenerate={(title) => onGenerate(title, a.prefill_prompt)} />
          </>
        )}
      </AsyncSection>
    </>
  );
}
