import { useState } from "react";
import { api } from "../api";
import { AsyncSection } from "../components/AsyncSection";
import { ProgressBar } from "../components/ProgressBar";
import { StatusBadge } from "../components/StatusBadge";
import { SuggestedPosts } from "../components/SuggestedPosts";
import { TagPill } from "../components/TagPill";
import { useApi, useCachedApi } from "../hooks/useApi";
import { CACHE_KEYS } from "../lib/cacheKeys";
import { useModes } from "../modes";
import { Ico } from "../icons";
import { downloadPostPNG } from "../lib/exportPng";
import { useToast } from "../toast";
import type { GenRequest, PostOption, StreamProgress } from "../types";

const PLATFORMS = ["Instagram", "Facebook"] as const;
const TONES = ["Friendly", "Professional", "Urgent", "Funny"] as const;
const LENGTHS = ["Short", "Medium", "Long"] as const;
const AUDIENCES = ["Homeowners", "E-commerce Sellers", "Startups/SMEs", "Businesses"] as const;
const STYLES: Array<{ label: string; value: string }> = [
  { label: "Before/After", value: "before_after" },
  { label: "Product", value: "clean_product" },
  { label: "Lifestyle", value: "lifestyle" },
  { label: "Text-forward", value: "text_forward" },
];
const PLATFORM_COLOR: Record<string, string> = { instagram: "#E8651A", facebook: "#4A87BE" };
const platformColor = (p: string) => PLATFORM_COLOR[p.toLowerCase()] ?? "#E8651A";

function ChipRow<T extends string>({ options, value, onPick, disabled }: {
  options: readonly T[]; value: T; onPick: (v: T) => void; disabled?: boolean;
}) {
  return (
    <div className="gchip-row">
      {options.map((o) => (
        <button key={o} className={`gchip ${value === o ? "on" : ""}`}
          onClick={() => onPick(o)} disabled={disabled}>{o}</button>
      ))}
    </div>
  );
}

function ToggleChip({ label, on, onToggle, disabled }: { label: string; on: boolean; onToggle: () => void; disabled: boolean }) {
  return <button className={`gchip ${on ? "on" : ""}`} disabled={disabled} onClick={onToggle}>{label}</button>;
}

export function GenerateView({ request }: { request: GenRequest | null }) {
  const toast = useToast();
  const drafts = useApi(api.listDrafts);
  const [recoProgress, setRecoProgress] = useState<StreamProgress | null>(null);
  const recos = useCachedApi(CACHE_KEYS.recommendations, () => api.recommendationsStream(setRecoProgress));
  const modes = useModes();

  const [platform, setPlatform] = useState<(typeof PLATFORMS)[number]>("Instagram");
  const [tone, setTone] = useState<(typeof TONES)[number]>("Friendly");
  const [length, setLength] = useState<(typeof LENGTHS)[number]>("Short");
  const [audience, setAudience] = useState<(typeof AUDIENCES)[number]>("Homeowners");
  const [style, setStyle] = useState(STYLES[0].value);
  const [prompt, setPrompt] = useState(request?.title ?? "");
  const [context, setContext] = useState(request?.context ?? "");
  const [flags, setFlags] = useState({ hashtags: true, cta: true, emoji: false, pricing: false });
  // Snapshot of the last generation: options stay labeled/saved/exported under the
  // platform they were generated for; the live chip only affects the NEXT generation.
  const [genResult, setGenResult] =
    useState<{ platform: (typeof PLATFORMS)[number]; options: PostOption[] } | null>(null);
  const [busy, setBusy] = useState(false);
  const [genProgress, setGenProgress] = useState<StreamProgress | null>(null);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [editCaption, setEditCaption] = useState("");

  const doGenerate = async () => {
    setBusy(true);
    setGenProgress(null);
    try {
      const prefill = [context, prompt.trim(), `Target audience: ${audience}`]
        .filter(Boolean).join("\n\n");
      const res = await api.generatePostStream({
        platform: platform.toLowerCase(), tone: tone.toLowerCase(), length: length.toLowerCase(),
        prefill_prompt: prefill, visual_style: style,
        include_hashtags: flags.hashtags, include_cta: flags.cta,
        include_emoji: flags.emoji, include_pricing: flags.pricing, options: 3,
      }, setGenProgress);
      setGenResult({ platform, options: res.options });
      toast(`Generated ${res.options.length} options`);
    } catch (e) {
      toast(`Generation failed: ${e instanceof Error ? e.message : e}`);
    } finally {
      setBusy(false);
      setGenProgress(null);
    }
  };

  const saveOption = async (o: PostOption, plat: string) => {
    try {
      await api.createDraft({
        platform: plat.toLowerCase(),
        caption: [o.caption, ...o.hashtags].join(" "),
        image_b64: o.image_b64, canva_edit_url: o.canva_edit_url,
      });
      drafts.reload();
      toast("Saved to drafts");
    } catch (e) {
      toast(`Save failed: ${e instanceof Error ? e.message : e}`);
    }
  };

  const removeDraft = async (id: number) => {
    try { await api.deleteDraft(id); drafts.reload(); toast("Draft deleted"); }
    catch (e) { toast(`Delete failed: ${e instanceof Error ? e.message : e}`); }
  };

  const saveCaption = async (id: number) => {
    try {
      await api.updateDraft(id, { caption: editCaption });
      setEditingId(null);
      drafts.reload();
      toast("Draft updated");
    } catch (e) {
      toast(`Update failed: ${e instanceof Error ? e.message : e}`);
    }
  };

  const exportOption = (o: PostOption, plat: string) => {
    void downloadPostPNG({
      text: o.caption, color: platformColor(plat), platform: plat,
      imageDataUrl: o.image_b64 ? `data:${o.mime_type};base64,${o.image_b64}` : undefined,
      onError: toast,
    });
    toast("Downloading PNG…");
  };

  return (
    <div className="pgwrap">
      <div>
        <div className="pg-title" style={{ fontSize: 34 }}>Generate</div>
        <div className="pg-sub">Create a post — AI writes it in UrbanSpace's brand voice.</div>
      </div>

      <div className="card">
        <div className="card-hdr-row" style={{ marginBottom: 18 }}>
          <div className="ai-star-ico" style={{ background: "var(--blue)" }}><Ico k="sparkle" /></div>
          <div>
            <div className="card-title" style={{ fontSize: 17 }}>What do you want to make?</div>
            <div className="card-sub">AI drafts it in your brand voice</div>
          </div>
        </div>
        <div className="gfield-block">
          <div className="gform-lbl">Platform</div>
          <ChipRow options={PLATFORMS} value={platform} onPick={setPlatform} disabled={busy}/>
        </div>
        <div className="gfield-block">
          <div className="gform-lbl">Topic / Prompt</div>
          <textarea className="gprompt" aria-label="Topic or prompt" value={prompt} disabled={busy}
            onChange={(e) => setPrompt(e.target.value)}
            placeholder="e.g. 3 months free promo — move in before July and lock in our best rate" />
          {context && (
            <div style={{ marginTop: 6 }}>
              <TagPill style={{ background: "var(--ai-l)", color: "var(--ai-d)" }}>
                Research context attached
              </TagPill>
              <button className="btn-underline" style={{ marginLeft: 8 }} onClick={() => setContext("")}>
                Remove
              </button>
            </div>
          )}
        </div>
        <div className="g2col gfield-block">
          <div><div className="gform-lbl">Tone</div><ChipRow options={TONES} value={tone} onPick={setTone} disabled={busy}/></div>
          <div><div className="gform-lbl">Length</div><ChipRow options={LENGTHS} value={length} onPick={setLength} disabled={busy}/></div>
        </div>
        <div className="g2col gfield-block">
          <div><div className="gform-lbl">Target Audience</div><ChipRow options={AUDIENCES} value={audience} onPick={setAudience} disabled={busy}/></div>
          <div>
            <div className="gform-lbl">Visual Style</div>
            <div className="gchip-row">
              {STYLES.map((s) => (
                <button key={s.value} className={`gchip ${style === s.value ? "on" : ""}`}
                  onClick={() => setStyle(s.value)}disabled={busy}>{s.label}</button>
              ))}
            </div>
          </div>
        </div>
        <div className="gfield-block">
          <div className="gform-lbl">Include</div>
          <div className="gchip-row">
            <ToggleChip label="Hashtags" on={flags.hashtags} onToggle={() => setFlags({ ...flags, hashtags: !flags.hashtags })} disabled={busy} />
            <ToggleChip label="Call to action" on={flags.cta} onToggle={() => setFlags({ ...flags, cta: !flags.cta })} disabled={busy} />
            <ToggleChip label="Emoji" on={flags.emoji} onToggle={() => setFlags({ ...flags, emoji: !flags.emoji })} disabled={busy} />
            <ToggleChip label="Pricing" on={flags.pricing} onToggle={() => setFlags({ ...flags, pricing: !flags.pricing })} disabled={busy} />
          </div>
        </div>
        <button className="btn btn-blue" onClick={doGenerate} disabled={busy}>
          <Ico k="sparkle" /> {busy ? "Generating…" : "Generate 3 options"}
        </button>
        {busy && <ProgressBar progress={genProgress} />}
      </div>

      {genResult && (
        <>
          <div className="res-hdr-row" style={{ alignItems: "center" }}>
            <div>
              <div className="card-title" style={{ fontSize: 19 }}>
                Generated options <StatusBadge kind="ai" />
                {modes && modes.ai.image !== "live" && (
                  <TagPill style={{ background: "var(--gold-l)", color: "var(--gold-d)", marginLeft: 8 }}>
                    Sample images
                  </TagPill>
                )}
              </div>
              <div className="card-sub">Save, download as PNG, or open in Canva to edit</div>
            </div>
            <button className="btn btn-white btn-sm" onClick={doGenerate} disabled={busy}>
              <Ico k="refresh" /> Regenerate all
            </button>
          </div>
          <div className="gdraft-grid" style={{ marginTop: 14 }}>
            {genResult.options.map((o, i) => (
              <div className="gdraft-card" key={i}>
                <div className={`gdraft-hdr${o.image_b64 ? " has-img" : ""}`}
                  style={{ background: platformColor(genResult.platform), padding: 0 }}>
                  {o.image_b64
                    ? <img src={`data:${o.mime_type};base64,${o.image_b64}`} alt={`Draft ${i + 1} visual`}
                        style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                    : <><Ico k="camera" /><div className="gdraft-hdr-lbl">Draft {i + 1} &middot; {genResult.platform}</div></>}
                </div>
                <div className="gdraft-body">
                  <div className="gdraft-txt">{o.caption}</div>
                  <div className="gdraft-tags">{o.hashtags.join(" ")}</div>
                  <div className="gdraft-actions">
                    <button className="btn btn-blue btn-sm" style={{ flex: 1, justifyContent: "center" }}
                      onClick={() => exportOption(o, genResult.platform)}>Download PNG</button>
                    <button className="btn btn-outline btn-sm" onClick={() => saveOption(o, genResult.platform)}>Save to draft</button>
                    {o.canva_edit_url && (
                      <a className="btn btn-outline btn-sm" href={o.canva_edit_url} target="_blank" rel="noreferrer">
                        <Ico k="canva" /> Canva
                      </a>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </>
      )}

      <div className="card sdraft-card">
        <div className="sdraft-card-hdr">Saved drafts</div>
        <AsyncSection q={drafts}>
          {(d) => d.items.length === 0
            ? <div className="empty-note">No saved drafts yet. Generate posts and click "Save to draft" to store them here.</div>
            : <>{d.items.map((draft) => (
                <div className="sdraft-row" style={{ paddingLeft: 22, paddingRight: 22 }} key={draft.id}>
                  {editingId === draft.id ? (
                    <div style={{ flex: 1 }}>
                      <textarea className="gprompt" aria-label="Edit draft caption" value={editCaption}
                        onChange={(e) => setEditCaption(e.target.value)} disabled={busy}/>
                      <div style={{ display: "flex", gap: 8, marginTop: 6 }}>
                        <button className="btn btn-ora btn-sm" onClick={() => saveCaption(draft.id)}>Save</button>
                        <button className="btn btn-white btn-sm" onClick={() => setEditingId(null)}>Cancel</button>
                      </div>
                    </div>
                  ) : (
                    <>
                      <div style={{ flex: 1 }}>
                        <div className="sdraft-title">{draft.caption}</div>
                        <div className="sdraft-meta">{draft.platform} · saved {draft.created_at.slice(0, 10)}</div>
                      </div>
                      <button className="btn btn-blue-outline btn-sm"
                        onClick={() => { setEditingId(draft.id); setEditCaption(draft.caption); }}>
                        <Ico k="pencil" /> Edit
                      </button>
                      <button className="btn btn-blue-outline btn-sm"
                        onClick={() => { void downloadPostPNG({ text: draft.caption,
                          color: platformColor(draft.platform), platform: draft.platform,
                          imageDataUrl: draft.image_b64 ? `data:image/png;base64,${draft.image_b64}` : undefined,
                          onError: toast }); toast("Downloading PNG…"); }}>
                        Download PNG
                      </button>
                      {draft.canva_edit_url && (
                        <a className="btn btn-outline btn-sm" href={draft.canva_edit_url} target="_blank" rel="noreferrer">
                          <Ico k="canva" /> Canva
                        </a>
                      )}
                      <button className="btn btn-outline btn-sm" onClick={() => removeDraft(draft.id)}>
                        <Ico k="trash" /> Delete
                      </button>
                    </>
                  )}
                </div>
              ))}</>}
        </AsyncSection>
      </div>

      <AsyncSection q={recos} progress={recoProgress}>
        {(r) => (
          <SuggestedPosts title="AI Recommendations — one-click prefill"
            sub={r.rationale} titles={r.titles} subLabel="From this week's research"
            onGenerate={(title) => { setPrompt(title); setContext(r.prefill_prompt); }}
            onRefresh={() => { setRecoProgress(null); recos.reload(); }} />
        )}
      </AsyncSection>
    </div>
  );
}
