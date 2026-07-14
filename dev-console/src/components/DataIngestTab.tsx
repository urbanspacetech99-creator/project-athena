import { useState } from "react";
import { api } from "../api";
import type { DataResource, IngestSource } from "../types";
import { ResultPanel } from "./ResultPanel";

const RESOURCES: DataResource[] = ["own-posts", "post-comments", "competitor-posts",
  "google-reviews", "keyword-volumes", "zoho-chats"];
const SOURCES: IngestSource[] = ["meta", "competitor", "google_reviews", "google_ads", "zoho"];

export function DataIngestTab() {
  const [resource, setResource] = useState<DataResource>("own-posts");
  const [source, setSource] = useState<IngestSource>("meta");
  const [data, setData] = useState<unknown>(null);
  const [ingest, setIngest] = useState<unknown>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = async () => {
    setLoading(true); setError(null);
    try { setData(await api.listData(resource)); }
    catch (e) { setError((e as Error).message); }
    finally { setLoading(false); }
  };
  const runIngest = async () => {
    setError(null);
    try { setIngest(await api.ingest(source)); await load(); }
    catch (e) { setError((e as Error).message); }
  };

  return (
    <>
      <section className="card">
        <h3>Browse ingested data</h3>
        <div className="row">
          <select value={resource} onChange={(e) => setResource(e.target.value as DataResource)}>
            {RESOURCES.map((r) => <option key={r} value={r}>{r}</option>)}
          </select>
          <button className="action" onClick={load}>Load</button>
        </div>
        <ResultPanel loading={loading} error={error} data={data} />
      </section>
      <section className="card">
        <h3>Trigger ingestion</h3>
        <div className="row">
          <select value={source} onChange={(e) => setSource(e.target.value as IngestSource)}>
            {SOURCES.map((s) => <option key={s} value={s}>{s}</option>)}
          </select>
          <button className="action" onClick={runIngest}>Ingest</button>
        </div>
        {ingest ? <pre>{JSON.stringify(ingest, null, 2)}</pre> : <p className="muted">
          Runs the source in its configured live|fixture mode.</p>}
      </section>
    </>
  );
}
