import { useState } from "react";
import { api } from "../../lib/api";
import type { CompetitorRow } from "../../types";

const PLATFORMS = ["facebook", "instagram"];

export function CompetitorsCard({ competitors, onChanged, onError }: {
  competitors: CompetitorRow[]; onChanged: () => Promise<void>; onError: (m: string) => void;
}) {
  const [platform, setPlatform] = useState(PLATFORMS[0]);
  const [name, setName] = useState("");
  const [externalId, setExternalId] = useState("");

  const add = async () => {
    try {
      await api.createCompetitor({ platform, name, external_id: externalId });
      setName(""); setExternalId("");
      await onChanged();
    } catch (e) { onError((e as Error).message); }
  };
  const toggle = async (row: CompetitorRow) => {
    try { await api.updateCompetitor(row.id, { enabled: !row.enabled }); await onChanged(); }
    catch (e) { onError((e as Error).message); }
  };
  const remove = async (id: number) => {
    try { await api.deleteCompetitor(id); await onChanged(); }
    catch (e) { onError((e as Error).message); }
  };

  return (
    <section className="card">
      <h3>Competitors</h3>
      {competitors.length === 0 ? <p className="muted">No competitors tracked yet.</p> : (
        <table>
          <tbody>
            {competitors.map((c) => (
              <tr key={c.id}>
                <td>{c.platform}</td>
                <td>{c.name}</td>
                <td>{c.external_id || "—"}</td>
                <td>
                  <label><input type="checkbox" checked={c.enabled}
                    onChange={() => toggle(c)} />enabled</label>
                </td>
                <td><button className="danger" onClick={() => remove(c.id)}>Delete</button></td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
      <div className="row" style={{ marginTop: 8 }}>
        <select value={platform} onChange={(e) => setPlatform(e.target.value)}>
          {PLATFORMS.map((p) => <option key={p} value={p}>{p}</option>)}
        </select>
        <input placeholder="Name" value={name} onChange={(e) => setName(e.target.value)} />
        <input placeholder="External ID" value={externalId}
          onChange={(e) => setExternalId(e.target.value)} />
        <button className="action" disabled={!name} onClick={add}>Add</button>
      </div>
    </section>
  );
}
