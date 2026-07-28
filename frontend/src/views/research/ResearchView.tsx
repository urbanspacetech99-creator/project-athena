import { useState } from "react";
import { ASSET } from "../../assets";
import { cacheDeletePrefix } from "../../lib/cache";
import { CACHE_KEYS } from "../../lib/cacheKeys";
import { Ico } from "../../icons";
import { CompetitorTab } from "./CompetitorTab";
import { CustomerTab } from "./CustomerTab";
import { SocialTab } from "./SocialTab";
import { TrendsTab } from "./TrendsTab";

export type TopicId = "tr" | "zo" | "so" | "cp";

const TOPICS: Array<{ id: TopicId; label: string; img: string; col1: string; col2: string; desc: string }> = [
  { id: "tr", label: "Internet Trends", img: ASSET.PAT_TREND, col1: "#EE8A2E", col2: "#E8651A",
    desc: "Top Google search trends, keyword rankings, and AI-suggested posts." },
  { id: "zo", label: "Customer Chats", img: ASSET.PAT_CHAT, col1: "#5AA6D6", col2: "#3F7FB8",
    desc: "ZOHO WhatsApp chat analysis — questions, service demand, AI patterns." },
  { id: "so", label: "Social Media", img: ASSET.PAT_SOCIAL, col1: "#3E9450", col2: "#2A6E38",
    desc: "Facebook, Instagram, and Google post performance & sentiment." },
  { id: "cp", label: "Competitor Analysis", img: ASSET.PAT_COMP, col1: "#CB5142", col2: "#A93526",
    desc: "BigBox, StorePlus SG, SpaceUrban & SafeStore SG — posts, AI strategy." },
];

/** AI cache key busted by the header Refresh (lib/cacheKeys.ts, see the spec §3). */
const TAB_CACHE_KEY: Record<TopicId, string> = {
  tr: CACHE_KEYS.internetTrends, zo: CACHE_KEYS.customerInsights,
  so: CACHE_KEYS.socialReviews, cp: CACHE_KEYS.competitor,
};

export function ResearchView({ onGenerate }: { onGenerate: (title: string, context: string) => void }) {
  const [active, setActive] = useState<TopicId>("tr");
  const [refreshKey, setRefreshKey] = useState(0);

  return (
    <div className="pgwrap">
      <div className="res-hdr-row">
        <div>
          <div className="pg-title" style={{ fontSize: 34 }}>Research</div>
          <div className="pg-sub">AI-powered market intelligence for Urban Space — updated weekly.</div>
        </div>
        <button className="btn btn-white"
          onClick={() => { cacheDeletePrefix(TAB_CACHE_KEY[active]); setRefreshKey((k) => k + 1); }}>
          <Ico k="refresh" /> Refresh
        </button>
      </div>
      <div className="rs-tab-row">
        {TOPICS.map((t) => (
          <button key={t.id} className={`rs-tab-card ${active === t.id ? "on" : ""}`}
            style={{ background: `linear-gradient(135deg,${t.col1},${t.col2})` }}
            onClick={() => setActive(t.id)}>
            <div className="rs-tab-ico" style={{ backgroundImage: `url(${t.img})` }} />
            <div style={{ minWidth: 0 }}>
              <div className="rs-tab-title">{t.label}</div>
              <div className="rs-tab-desc">{t.desc}</div>
            </div>
            {active === t.id && <div className="rs-tab-check"><Ico k="check" /></div>}
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