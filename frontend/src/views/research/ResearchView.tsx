import { useState } from "react";
import { ASSET } from "../../assets";
import { Ico } from "../../icons";
import { cacheDeletePrefix } from "../../lib/cache";
import { CACHE_KEYS } from "../../lib/cacheKeys";
import { TagPill } from "../../components/TagPill";
import { CompetitorTab } from "./CompetitorTab";
import { CustomerTab } from "./CustomerTab";
import { SocialTab } from "./SocialTab";
import { TrendsTab } from "./TrendsTab";

export type TopicId = "tr" | "zo" | "so" | "cp";

const TOPICS: Array<{ id: TopicId; label: string; img: string; col1: string; col2: string; desc: string }> = [
  { id: "tr", label: "Internet Trends", img: ASSET.PAT_TREND, col1: "#EE8A2E", col2: "#E8651A",
    desc: "Top Google search trends, keyword rankings, and AI-suggested posts." },
  { id: "zo", label: "Customer Chats", img: ASSET.PAT_CHAT, col1: "#5AA6D6", col2: "#3F7FB8",
    desc: "ZOHO chat analysis — questions, service demand, AI patterns." },
  { id: "so", label: "Social Media", img: ASSET.PAT_SOCIAL, col1: "#3E9450", col2: "#2A6E38",
    desc: "Facebook, Instagram, and Google post performance & sentiment." },
  { id: "cp", label: "Competitor Analysis", img: ASSET.PAT_COMP, col1: "#CB5142", col2: "#A93526",
    desc: "Tracked competitors — posts, activity, AI strategy." },
];

/** AI cache key busted by the header Refresh (lib/cacheKeys.ts, see the spec §3). */
const TAB_CACHE_KEY: Record<TopicId, string> = {
  tr: CACHE_KEYS.internetTrends, zo: CACHE_KEYS.customerInsights,
  so: CACHE_KEYS.socialReviews, cp: CACHE_KEYS.competitor,
};

export function ResearchView({ onGenerate }: { onGenerate: (title: string, context: string) => void }) {
  const [mode, setMode] = useState<"selector" | "tabs">("selector");
  const [enabled, setEnabled] = useState<Record<TopicId, boolean>>({ tr: true, zo: true, so: true, cp: true });
  const [active, setActive] = useState<TopicId>("tr");
  const [refreshKey, setRefreshKey] = useState(0);

  const count = Object.values(enabled).filter(Boolean).length;

  const toggle = (id: TopicId) => setEnabled({ ...enabled, [id]: !enabled[id] });

  const openTabs = () => {
    setActive((prev) => (enabled[prev] ? prev : TOPICS.find((t) => enabled[t.id])?.id ?? "tr"));
    setMode("tabs");
  };

  if (mode === "selector") {
    return (
      <div className="pgwrap">
        <div>
          <div className="pg-title" style={{ fontSize: 34 }}>Research</div>
          <div className="pg-sub">AI-powered market intelligence for UrbanSpace — updated weekly.</div>
        </div>
        <div className="rs-heading">What are we researching today?</div>
        <div className="rs-banner">
          <div className="rs-banner-ico"><Ico k="sparkle" /></div>
          <div className="rs-banner-txt">Turn on the data sources relevant to your session. You can change this at any time.</div>
        </div>
        <div className="rs-grid">
          {TOPICS.map((t) => (
            <div key={t.id} className={`rs-card ${enabled[t.id] ? "" : "off"}`}
              style={{ background: `linear-gradient(135deg,${t.col1},${t.col2})` }} onClick={() => toggle(t.id)}>
              <div className="rs-card-ico" style={{ backgroundImage: `url(${t.img})` }} />
              <div>
                <div className="rs-card-title">{t.label}</div>
                <div className="rs-card-desc">{t.desc}</div>
              </div>
              <div className={`rs-check ${enabled[t.id] ? "on" : ""}`} style={{ color: t.col2 }}>
                {enabled[t.id] && <Ico k="check" />}
              </div>
            </div>
          ))}
        </div>
        <div className="rs-foot">
          <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
            <TagPill style={{ background: "var(--ora-l)", color: "var(--ora-d)", padding: "7px 14px", fontSize: 11 }}>
              {count} of 4 sources selected
            </TagPill>
            <button className="btn-underline" onClick={() => setEnabled({ tr: false, zo: false, so: false, cp: false })}>
              Clear all
            </button>
          </div>
          <button className="btn btn-ora" onClick={openTabs} disabled={count === 0}>
            <Ico k="check" /> View Research
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="pgwrap">
      <div className="res-hdr-row">
        <div>
          <div className="pg-title" style={{ fontSize: 34 }}>Research</div>
          <div className="pg-sub">AI-powered market intelligence for UrbanSpace — updated weekly.</div>
        </div>
        <div style={{ display: "flex", gap: 10 }}>
          <button className="btn btn-white" onClick={() => setMode("selector")}><Ico k="hand" /> Change Sources</button>
          <button className="btn btn-white"
            onClick={() => { cacheDeletePrefix(TAB_CACHE_KEY[active]); setRefreshKey((k) => k + 1); }}>
            <Ico k="refresh" /> Refresh
          </button>
        </div>
      </div>
      <div className="subtab-row">
        {TOPICS.filter((t) => enabled[t.id]).map((t) => (
          <button key={t.id} className={`subtab ${active === t.id ? "on" : ""}`} onClick={() => setActive(t.id)}>
            {t.label}
          </button>
        ))}
      </div>
      {/* bump refreshKey to remount the active tab so Refresh re-runs its fetches */}
      <div key={refreshKey}>
        {active === "tr" && <TrendsTab onGenerate={onGenerate} />}
        {active === "zo" && <CustomerTab onGenerate={onGenerate} />}
        {active === "so" && <SocialTab onGenerate={onGenerate} />}
        {active === "cp" && <CompetitorTab onGenerate={onGenerate} />}
      </div>
    </div>
  );
}
