import { api } from "../../api";
import { AsyncSection } from "../../components/AsyncSection";
import { StatusBadge } from "../../components/StatusBadge";
import { SuggestedPosts } from "../../components/SuggestedPosts";
import { useApi, useCachedApi } from "../../hooks/useApi";
import { CACHE_KEYS } from "../../lib/cacheKeys";
import { keywordChanges, type KeywordChange } from "../../lib/derive";

function ChangeTag({ ch }: { ch: KeywordChange | undefined }) {
  if (!ch) return null;
  if (ch.kind === "new") return <span className="mini-tag riser">NEW</span>;
  return (
    <span className={`kw-pct ${ch.pct < 0 ? "chg-dn" : "chg-up"}`}>
      {ch.pct >= 0 ? "+" : ""}{ch.pct}%
    </span>
  );
}

export function TrendsTab({ onGenerate }: { onGenerate: (title: string, context: string) => void }) {
  const trends = useCachedApi(CACHE_KEYS.internetTrends, api.internetTrends);
  const history = useApi(api.keywordVolumes);

  return (
    <AsyncSection q={trends}>
      {(t) => {
        const changes = keywordChanges(history.data?.items ?? []);
        // The API may return one row per (keyword, week); keep each keyword once, highest volume wins.
        const byKeyword = new Map<string, (typeof t.keywords)[number]>();
        for (const k of [...t.keywords].sort((a, b) => a.weekly_search_volume - b.weekly_search_volume)) byKeyword.set(k.keyword, k);
        const sorted = [...byKeyword.values()].sort((a, b) => b.weekly_search_volume - a.weekly_search_volume);
        const mx = Math.max(1, ...sorted.map((k) => k.weekly_search_volume));
        if (sorted.length === 0)
          return <div className="empty-note">No keyword data yet — tracked keywords appear after the weekly ingest runs.</div>;
        return (
          <>
            <div className="ct-card" style={{ marginBottom: 16 }}>
              <div className="ct-title">Weekly Search Volume in Singapore <StatusBadge kind="data" source="google_ads" /></div>
              <div className="ct-sub">Google search volume · tracked keywords{changes ? " · % change is week-over-week" : ""}</div>
              {sorted.map((k) => (
                <div className="bar-row" key={k.keyword}>
                  <div className="bar-lbl">{k.keyword}</div>
                  <div className="bar-track">
                    <div className="bar-fill" style={{
                      width: `${Math.max(8, Math.round((100 * k.weekly_search_volume) / mx))}%`,
                      background: "var(--ora)",
                    }}>
                      <span>{k.weekly_search_volume.toLocaleString()}</span>
                    </div>
                  </div>
                  <div className="bar-chg"><ChangeTag ch={changes?.get(k.keyword)} /></div>
                </div>
              ))}
            </div>
            <div className="ct-card" style={{ marginBottom: 16 }}>
              <div className="ct-title">Keyword ranking <StatusBadge kind="data" source="google_ads" /></div>
              <div className="ct-sub">Exact search volume for each tracked keyword</div>
              {sorted.map((k, i) => (
                <div className="kw-row" key={k.keyword}>
                  <div className="kw-num">{i + 1}</div>
                  <div style={{ flex: 1 }}>
                    <div className="kw-title-row"><span className="kw-title">{k.keyword}</span></div>
                  </div>
                  <div className="kw-right">
                    <div className="kw-val">{k.weekly_search_volume.toLocaleString()}/wk</div>
                    <ChangeTag ch={changes?.get(k.keyword)} />
                  </div>
                </div>
              ))}
            </div>
            <SuggestedPosts title="AI Suggested Posts" sub="Post ideas generated from this week's search trends"
              titles={t.titles} subLabel="From this week's internet trends"
              onGenerate={(title) => onGenerate(title, t.prefill_prompt)} />
          </>
        );
      }}
    </AsyncSection>
  );
}
