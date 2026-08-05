import { useEffect, useState } from "react";
import { api } from "../../lib/api";
import type { Draft, GeneratePostIn, PostOption, Recommendations } from "../../types";

const PLATFORMS = ["instagram", "facebook", "story"];
const STYLES = ["clean_product", "before_after", "lifestyle", "text_forward"];

export function GenerateTab({ prefill }: { prefill: string }) {
  const [form, setForm] = useState<GeneratePostIn>({
    platform: "instagram", tone: "friendly", length: "short", prefill_prompt: prefill,
    visual_style: "clean_product", include_hashtags: true, include_cta: true,
    include_emoji: false, include_pricing: false, options: 3,
  });
  const [options, setOptions] = useState<PostOption[]>([]);
  const [drafts, setDrafts] = useState<Draft[]>([]);
  const [recs, setRecs] = useState<Recommendations | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [editText, setEditText] = useState("");

  useEffect(() => { setForm((f) => ({ ...f, prefill_prompt: prefill })); }, [prefill]);

  const loadDrafts = async () => {
    try { setDrafts((await api.listDrafts()).items); }
    catch (e) { setError((e as Error).message); }
  };
  useEffect(() => { void loadDrafts(); }, []);

  const generate = async () => {
    setBusy(true); setError(null);
    try { setOptions((await api.generatePost(form)).options); }
    catch (e) { setError((e as Error).message); }
    finally { setBusy(false); }
  };
  const save = async (o: PostOption) => {
    try {
      await api.createDraft({ platform: form.platform, caption: o.caption,
        image_b64: o.image_b64, canva_edit_url: o.canva_edit_url });
      await loadDrafts();
    } catch (e) { setError((e as Error).message); }
  };
  const remove = async (id: number) => {
    try { await api.deleteDraft(id); await loadDrafts(); }
    catch (e) { setError((e as Error).message); }
  };
  const startEdit = (d: Draft) => { setEditingId(d.id); setEditText(d.caption); };
  const saveEdit = async (id: number) => {
    try { await api.updateDraft(id, { caption: editText }); setEditingId(null); await loadDrafts(); }
    catch (e) { setError((e as Error).message); }
  };

  return (
    <>
      <section className="card">
        <h3>Post Generator</h3>
        <div className="row">
          <label>Platform
            <select value={form.platform}
                    onChange={(e) => setForm({ ...form, platform: e.target.value })}>
              {PLATFORMS.map((p) => <option key={p}>{p}</option>)}
            </select></label>
          <label>Style
            <select value={form.visual_style}
                    onChange={(e) => setForm({ ...form, visual_style: e.target.value })}>
              {STYLES.map((s) => <option key={s}>{s}</option>)}
            </select></label>
          <label><input type="checkbox" checked={form.include_hashtags}
            onChange={(e) => setForm({ ...form, include_hashtags: e.target.checked })} />hashtags</label>
          <label><input type="checkbox" checked={form.include_cta}
            onChange={(e) => setForm({ ...form, include_cta: e.target.checked })} />CTA</label>
        </div>
        <textarea style={{ width: "100%", marginTop: 8 }} rows={2} placeholder="Prefill prompt"
          value={form.prefill_prompt}
          onChange={(e) => setForm({ ...form, prefill_prompt: e.target.value })} />
        <div className="row" style={{ marginTop: 8 }}>
          <button className="action" disabled={busy} onClick={generate}>
            {busy ? "Generating…" : "Generate 3 options"}</button>
        </div>
        {error && <p className="err">Error: {error}</p>}
        <div className="options" style={{ marginTop: 12 }}>
          {options.map((o, i) => (
            <div key={i} className="option card">
              <img alt={`option ${i + 1}`} src={`data:${o.mime_type};base64,${o.image_b64}`} />
              <p>{o.caption}</p>
              <div>{o.hashtags.map((h, i) => <span key={i} className="tag">#{h}</span>)}</div>
              <div className="row" style={{ marginTop: 6 }}>
                <a className="ghost" href={o.canva_edit_url} target="_blank"
                   rel="noreferrer">Open in Canva</a>
                <button className="action" onClick={() => save(o)}>Save draft</button>
              </div>
            </div>
          ))}
        </div>
      </section>

      <section className="card">
        <div className="row"><h3>Saved drafts</h3>
          <button className="ghost" onClick={loadDrafts}>Refresh</button></div>
        {drafts.length === 0 ? <p className="muted">No drafts saved.</p> : drafts.map((d) => (
          <div key={d.id} className="row" style={{ justifyContent: "space-between" }}>
            {editingId === d.id ? (
              <>
                <input style={{ flex: 1 }} value={editText}
                       onChange={(e) => setEditText(e.target.value)} />
                <button className="action" onClick={() => saveEdit(d.id)}>Save</button>
                <button className="ghost" onClick={() => setEditingId(null)}>Cancel</button>
              </>
            ) : (
              <>
                <span>#{d.id} [{d.platform}] {d.caption.slice(0, 60)}</span>
                <button className="ghost" onClick={() => startEdit(d)}>Edit</button>
                <button className="danger" onClick={() => remove(d.id)}>Delete</button>
              </>
            )}
          </div>
        ))}
      </section>

      <section className="card">
        <div className="row"><h3>Aggregated recommendations</h3>
          <button className="action" onClick={async () => {
            try { setRecs(await api.recommendations()); }
            catch (e) { setError((e as Error).message); }
          }}>Recommend</button></div>
        {recs && <div>
          {recs.titles.map((t, i) => <span key={i} className="tag">{t}</span>)}
          <p className="muted">{recs.rationale}</p>
        </div>}
      </section>
    </>
  );
}
