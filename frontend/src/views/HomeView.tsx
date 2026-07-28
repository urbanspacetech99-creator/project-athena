import type { ReactNode } from "react";
import { api } from "../api";
import { ASSET } from "../assets";
import { AsyncSection } from "../components/AsyncSection";
import { StatusBadge } from "../components/StatusBadge";
import { TagPill } from "../components/TagPill";
import { useApi, useCachedApi } from "../hooks/useApi";
import { CACHE_KEYS } from "../lib/cacheKeys";
import { Ico, type IcoKey } from "../icons";
import { kpiDeltas, type KpiDeltas } from "../lib/derive";
import { fmt } from "../lib/fmt";
import type { View } from "../App";

const deltaBadge = (pct: number | null) =>
  pct === null || pct === 0 ? null : (
    <div className="ksub">{pct >= 0 ? "↑" : "↓"} {pct >= 0 ? "+" : ""}{pct}% vs last week</div>
  );

function Ktile({ fill, value, label, delta, icon }: {
  fill: boolean; value: string; label: string; delta: number | null; icon: IcoKey;
}) {
  return (
    <div className={`ktile ${fill ? "fill" : "plain"}`}>
      <div>
        <div className="kval">{value}</div>
        <div className="klbl">{label}</div>
        {deltaBadge(delta)}
      </div>
      <div className="kicowrap"><Ico k={icon} /></div>
    </div>
  );
}

function NotifRow({ color, tag, title, sub }: { color: "red" | "ora" | "green"; tag: string; title: string; sub: ReactNode }) {
  const c = { red: ["var(--red)", "var(--red-l)", "var(--red-d)"],
              ora: ["var(--ora)", "var(--ora-l)", "var(--ora-d)"],
              green: ["var(--green)", "var(--green-l)", "var(--green-d)"] }[color];
  return (
    <div className="notif-row">
      <div className="notif-dot" style={{ background: c[0] }} />
      <div style={{ flex: 1 }}>
        <TagPill style={{ background: c[1], color: c[2] }}>{tag}</TagPill>
        <div className="notif-title" style={{ marginTop: 6 }}>{title}</div>
        <div className="notif-sub">{sub}</div>
      </div>
    </div>
  );
}

/** Splits a caption into body text and the trailing hashtag block, so they
 *  can render on separate lines instead of running together inline. */
function splitHashtags(content: string) {
  const idx = content.search(/#\S+/);
  if (idx === -1) return { body: content, tags: "" };
  return { body: content.slice(0, idx).trimEnd(), tags: content.slice(idx).trim() };
}

/** WoW rows for the AI summary feed: WIN on gains, ANOMALY on drops (>=10% either way). */
function deltaRows(d: KpiDeltas | null) {
  if (!d) return [];
  const metrics: Array<[string, number | null]> = [
    ["Views", d.views], ["Likes", d.likes], ["Interactions", d.interactions]];
  return metrics
    .filter((m): m is [string, number] => m[1] !== null && Math.abs(m[1]) >= 10)
    .slice(0, 2)
    .map(([name, pctVal]) => ({
      color: (pctVal > 0 ? "green" : "red") as "green" | "red",
      tag: pctVal > 0 ? "WIN" : "ANOMALY",
      title: `${name} ${pctVal > 0 ? "up" : "down"} ${Math.abs(pctVal)}% vs last week`,
      sub: "Computed from weekly ingestion snapshots.",
    }));
}

export function HomeView({ onNavigate }: { onNavigate: (v: View) => void }) {
  const kpi = useApi(api.weeklyKpi);
  const engagement = useCachedApi(CACHE_KEYS.weeklyEngagement, api.weeklyEngagement);
  const ownPosts = useApi(api.ownPosts);
  const deltas = kpiDeltas(ownPosts.data?.items ?? []);

  return (
    <div className="pgwrap">
      <div>
        <div className="pg-title">Hello, UrbanSpace team.</div>
        <div className="pg-sub">Marketing overview for UrbanSpace Self Storage - this week.</div>
      </div>
      <div className="hero-grid">
        <div className="hero-card research" onClick={() => onNavigate("research")}>
          <img className="hero-illust" src={ASSET.RECT_RESEARCH} alt="" />
          <div className="hero-scrim" />
          <div className="hero-title">Research</div>
          <div className="hero-desc">Trends, ZOHO Chat Analysis, Social Accounts and Competitor Analysis</div>
          <div className="hero-btn">Go to Research <Ico k="arrowR" /></div>
        </div>
        <div className="hero-card generate" onClick={() => onNavigate("generate")}>
          <img className="hero-illust" src={ASSET.RECT_GENERATE} alt="" />
          <div className="hero-scrim" />
          <div className="hero-title">Generate</div>
          <div className="hero-desc">Create Instagram &amp; Facebook posts with AI in UrbanSpace brand voice.</div>
          <div className="hero-btn">Go to Generate <Ico k="arrowR" /></div>
        </div>
      </div>
      <div className="bot-grid">
        <div className="card">
          <div className="card-hdr-row">
            <div className="card-ico" style={{ background: "var(--ora-l)", color: "var(--ora)" }}><Ico k="eye" /></div>
            <div><div className="card-title">KPI <StatusBadge kind="data" source="meta" /></div><div className="card-sub">Performance metrics for this week</div></div>
          </div>
          <AsyncSection q={kpi}>
            {(k) => (
              <div className="kpi-list">
                <Ktile fill value={fmt(k.views)} label="Total Views" delta={deltas?.views ?? null} icon="eye" />
                <Ktile fill={false} value={fmt(k.likes)} label="Likes" delta={deltas?.likes ?? null} icon="heart" />
                <Ktile fill value={fmt(k.interactions)} label="Interactions" delta={deltas?.interactions ?? null} icon="msg" />
                <Ktile fill={false} value={String(k.posts)} label="Posts This Week" delta={deltas?.posts ?? null} icon="doc" />
              </div>
            )}
          </AsyncSection>
        </div>
        <div className="ai-card">
          <div className="ai-card-hdr">
            <div className="ai-card-title-row">
              <div className="ai-star-ico"><Ico k="sparkle" /></div>
              <div>
                <div className="card-title">AI Weekly Summary <StatusBadge kind="ai" /></div>
                <div className="card-sub">Auto-generated from this week's performance data</div>
              </div>
            </div>
            <button className="btn btn-white btn-sm" onClick={engagement.reload} aria-label="Refresh AI summary">
              <Ico k="refresh" />
            </button>
          </div>
          <AsyncSection q={engagement}>
            {(e) => (
              <>
                {deltaRows(deltas).map((r, i) => <NotifRow key={i} {...r} />)}
                {e.top_post && (() => {
                  const { body, tags } = splitHashtags(e.top_post.content);
                  return (
                    <NotifRow color="green" tag="WIN"
                      title={`Top post this week — ${fmt(e.top_post.views)} views on ${e.top_post.platform}`}
                      sub={<>{body}{tags && <><br /><br />{tags}</>}</>} />
                  );
                })()}
                <NotifRow color="ora" tag="AI SUMMARY" title={e.insights.summary}
                  sub={`Sentiment: ${e.insights.sentiment}`} />
                {e.insights.recurring_feedback.map((f, i) => (
                  <NotifRow key={i} color="ora" tag="RECURRING FEEDBACK" title={f}
                    sub="Mentioned repeatedly in this week's comments." />
                ))}
                <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginTop: 10 }}>
                  {e.insights.themes.map((t) => (
                    <TagPill key={t} style={{ background: "var(--ai-l)", color: "var(--ai-d)" }}>{t}</TagPill>
                  ))}
                </div>
              </>
            )}
          </AsyncSection>
        </div>
      </div>
    </div>
  );
}
