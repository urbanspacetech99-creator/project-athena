import { useState } from "react";
import { api } from "../api";
import type { EngagementSummary, KpiSnapshot } from "../types";
import { ResultPanel } from "./ResultPanel";

export function HomeTab() {
  const [kpi, setKpi] = useState<KpiSnapshot | null>(null);
  const [eng, setEng] = useState<EngagementSummary | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const run = async () => {
    setLoading(true); setError(null);
    try {
      setKpi(await api.weeklyKpi());
      setEng(await api.weeklyEngagement());
    } catch (e) { setError((e as Error).message); }
    finally { setLoading(false); }
  };

  return (
    <section className="card">
      <div className="row">
        <h3>Weekly Home</h3>
        <button className="action" onClick={run}>Load KPIs + engagement</button>
      </div>
      {loading && <p className="muted">Loading…</p>}
      {error && <p className="err">Error: {error}</p>}
      {kpi && (
        <div className="row">
          <div className="stat"><b>{kpi.views}</b>views</div>
          <div className="stat"><b>{kpi.likes}</b>likes</div>
          <div className="stat"><b>{kpi.interactions}</b>interactions</div>
          <div className="stat"><b>{kpi.posts}</b>posts</div>
        </div>
      )}
      {eng && (
        <div style={{ marginTop: 12 }}>
          <h4>Top post</h4>
          {eng.top_post
            ? <p>{eng.top_post.platform}: {eng.top_post.content} — {eng.top_post.interactions} interactions</p>
            : <p className="muted">No top post this week.</p>}
          <h4>AI comment insights</h4>
          <ResultPanel loading={false} error={null} data={eng.insights} />
        </div>
      )}
    </section>
  );
}
