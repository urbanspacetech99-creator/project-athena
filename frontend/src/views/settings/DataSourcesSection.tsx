import { useState } from "react";
import { api } from "../../lib/api";
import { useToast } from "../../providers/useToast";
import type { IngestSource } from "../../types";
import { SectionCard } from "./SectionCard";

const INGEST_SOURCES: IngestSource[] = ["meta", "competitor", "google_reviews",
  "google_ads", "zoho", "competitor_reviews"];

export function DataSourcesSection() {
  const toast = useToast();
  const [results, setResults] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState<string | null>(null);

  const runOne = async (source: IngestSource) => {
    setBusy(source);
    try {
      const r = await api.ingest(source);
      if (r.skipped) {
        // Degenerate single-DB live config (no fixture DB): the backend refuses to
        // write fixture rows into the live DB. With a fixture DB configured, sources
        // are routed there instead and never skip. Not an error — run-all keeps going.
        setResults((m) => ({ ...m, [source]: "skipped (no fixture DB configured)" }));
        toast(`Skipped ${source}`);
      } else {
        const failed = r.failed.length ? ` · failed: ${r.failed.join(", ")}` : "";
        setResults((m) => ({ ...m, [source]: `${r.inserted} new, ${r.updated} updated${failed}` }));
        toast(`Ingested ${source}`);
      }
    } catch (e) {
      toast(`Failed: ${e instanceof Error ? e.message : e}`);
    } finally {
      setBusy(null);
    }
  };
  // Sequential so a shared DB/adapter isn't hit by six concurrent ingests.
  const runAll = async () => { for (const s of INGEST_SOURCES) await runOne(s); };

  return (
    <SectionCard title="Data Sources"
      sub="Pull the latest data from each source into the active database (live or fixture, per SOURCE_MODE).">
      {INGEST_SOURCES.map((s) => (
        <div className="sdraft-row" key={s}>
          <div style={{ flex: 1 }}>
            <div className="sdraft-title">{s}</div>
            {results[s] && <div className="sdraft-meta">{results[s]}</div>}
          </div>
          <button className="btn btn-outline btn-sm" disabled={busy !== null}
            onClick={() => runOne(s)}>
            {busy === s ? "Ingesting…" : "Ingest"}
          </button>
        </div>
      ))}
      <div style={{ marginTop: 12 }}>
        <button className="btn btn-ora btn-sm" disabled={busy !== null} onClick={runAll}>
          Ingest all
        </button>
      </div>
    </SectionCard>
  );
}
