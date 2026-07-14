import { useState } from "react";
import { api } from "../api";

type Handoff = { titles: string[]; prefill_prompt: string };

export function ResearchTab({ onSendToGenerate }: { onSendToGenerate: (prompt: string) => void }) {
  const [data, setData] = useState<unknown>(null);
  const [handoff, setHandoff] = useState<Handoff | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const run = async (name: string, fn: () => Promise<unknown>) => {
    setBusy(true); setError(null); setHandoff(null);
    try {
      const res = await fn();
      setData({ [name]: res });
      const r = res as Partial<Handoff>;
      if (Array.isArray(r.titles) && typeof r.prefill_prompt === "string") {
        setHandoff({ titles: r.titles, prefill_prompt: r.prefill_prompt });
      }
    } catch (e) { setError((e as Error).message); }
    finally { setBusy(false); }
  };

  const calls: { label: string; fn: () => Promise<unknown> }[] = [
    { label: "Internet Trends", fn: api.internetTrends },
    { label: "Customer Questions", fn: api.customerQuestions },
    { label: "Customer Insights", fn: api.customerInsights },
    { label: "Social & Reviews", fn: api.socialReviews },
    { label: "Competitor", fn: api.competitor },
  ];

  return (
    <section className="card">
      <h3>Research</h3>
      <div className="row">
        {calls.map((c) => (
          <button key={c.label} className="action" disabled={busy}
                  onClick={() => run(c.label, c.fn)}>{c.label}</button>
        ))}
      </div>
      {error && <p className="err">Error: {error}</p>}
      {handoff && (
        <div style={{ marginTop: 12 }}>
          <h4>Suggested titles → Generate</h4>
          {handoff.titles.map((t, i) => (
            <div key={i} className="row">
              <span className="tag">{t}</span>
              <button className="ghost" onClick={() => onSendToGenerate(handoff.prefill_prompt)}>
                Send to Generate</button>
            </div>
          ))}
        </div>
      )}
      {data ? <pre>{JSON.stringify(data, null, 2)}</pre> : null}
    </section>
  );
}
