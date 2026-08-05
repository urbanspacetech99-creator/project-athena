import { useState } from "react";
import { api } from "../../lib/api";
import type { TrackedKeyword } from "../../types";

export function KeywordsCard({ keywords, onChanged, onError }: {
  keywords: TrackedKeyword[]; onChanged: () => Promise<void>; onError: (m: string) => void;
}) {
  const [keyword, setKeyword] = useState("");

  const add = async () => {
    try { await api.createKeyword(keyword); setKeyword(""); await onChanged(); }
    catch (e) { onError((e as Error).message); }
  };
  const toggle = async (row: TrackedKeyword) => {
    try { await api.updateKeyword(row.id, { enabled: !row.enabled }); await onChanged(); }
    catch (e) { onError((e as Error).message); }
  };
  const remove = async (id: number) => {
    try { await api.deleteKeyword(id); await onChanged(); }
    catch (e) { onError((e as Error).message); }
  };

  return (
    <section className="card">
      <h3>Tracked keywords</h3>
      {keywords.length === 0 ? <p className="muted">No keywords tracked yet.</p> : (
        <table>
          <tbody>
            {keywords.map((k) => (
              <tr key={k.id}>
                <td>{k.keyword}</td>
                <td>
                  <label><input type="checkbox" checked={k.enabled}
                    onChange={() => toggle(k)} />enabled</label>
                </td>
                <td><button className="danger" onClick={() => remove(k.id)}>Delete</button></td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
      <div className="row" style={{ marginTop: 8 }}>
        <input placeholder="Keyword" value={keyword} onChange={(e) => setKeyword(e.target.value)} />
        <button className="action" disabled={!keyword} onClick={add}>Add</button>
      </div>
    </section>
  );
}
