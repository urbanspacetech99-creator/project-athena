import React, { useRef, useState } from "react";
import { api } from "../../lib/api";
import { AsyncSection } from "../../components/AsyncSection";
import { ProgressBar } from "../../components/ProgressBar";
import { StatusBadge } from "../../components/StatusBadge";
import { SuggestedPosts } from "../../components/SuggestedPosts";
import { TagPill } from "../../components/TagPill";
import { useApi, useCachedApi } from "../../hooks/useApi";
import { CACHE_KEYS } from "../../lib/cacheKeys";
import { useModes } from "../../providers/useModes";
import { Ico } from "../../components/Ico";
import { ChipRow } from "./ChipRow";
import { ToggleChip } from "./ToggleChip";
import { downloadPostPNG } from "../../lib/exportPng";
import { useToast } from "../../providers/useToast";
import type { Draft, GenRequest, PostOption, StreamProgress } from "../../types";

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

// Kept in sync with backend/src/athena/ai/images.py PLACEHOLDER_PNG_B64 — used only to
// detect drafts still showing the failure placeholder, never rendered directly.
const PLACEHOLDER_PNG_B64 = "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR4" +
  "2mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==";

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
  const [manualCaptions, setManualCaptions] = useState<Record<number, string>>({});
  const [autoSavedIndices, setAutoSavedIndices] = useState<Set<number>>(new Set());
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [uploadTargetId, setUploadTargetId] = useState<number | null>(null);
  const [fetchingId, setFetchingId] = useState<number | null>(null);
  const [fetchFailedIds, setFetchFailedIds] = useState<Set<number>>(new Set());
  const [retryingIndex, setRetryingIndex] = useState<number | null>(null);
  const [lightboxSrc, setLightboxSrc] = useState<string | null>(null);

  const doGenerate = async () => {
    setBusy(true);
    setGenProgress(null);
    setManualCaptions({});
    setAutoSavedIndices(new Set());
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

  const saveOption = async (o: PostOption, plat: string, index: number) => {
    const manual = (manualCaptions[index] ?? "").trim();
    if (o.caption_failed && !manual) { toast("Write a caption before saving"); return; }
    try {
      const hashtags = o.hashtags.map((h) => (h.startsWith("#") ? h : `#${h}`));
      const caption = o.caption_failed ? manual : [o.caption, ...hashtags].join(" ");
      await api.createDraft({
        platform: plat.toLowerCase(), caption,
        image_b64: o.image_b64, canva_edit_url: o.canva_edit_url, canva_design_id: o.canva_design_id
      });
      drafts.reload();
      toast("Saved to drafts");
    } catch (e) {
      toast(`Save failed: ${e instanceof Error ? e.message : e}`);
    }
  };

  const autoSaveBeforeCanva = (o: PostOption, plat: string, index: number) => {
  if (autoSavedIndices.has(index)) return;
  setAutoSavedIndices((s) => new Set(s).add(index));
  const manual = (manualCaptions[index] ?? "").trim();
  const hashtags = o.hashtags.map((h) => (h.startsWith("#") ? h : `#${h}`));
  const caption = o.caption_failed ? manual : [o.caption, ...hashtags].join(" ");
  api.createDraft({ platform: plat.toLowerCase(), caption, image_b64: o.image_b64, canva_edit_url: o.canva_edit_url, canva_design_id: o.canva_design_id })
    .then(() => { drafts.reload(); toast("Draft auto-saved"); })
    .catch(() => setAutoSavedIndices((s) => { const n = new Set(s); n.delete(index); return n; }));
};

const triggerUpload = (id: number) => { setUploadTargetId(id); fileInputRef.current?.click(); };

const onFileSelected = (e: React.ChangeEvent<HTMLInputElement>) => {
  const file = e.target.files?.[0];
  e.target.value = "";
  if (!file || uploadTargetId == null) return;
  const targetId = uploadTargetId;
  const reader = new FileReader();
  reader.onload = async () => {
    const base64 = String(reader.result).split(",")[1] ?? "";
    try {
      await api.updateDraft(targetId, { image_b64: base64 });
      drafts.reload();
      toast("Image uploaded");
      setFetchFailedIds((s) => { const n = new Set(s); n.delete(targetId); return n; });
    } catch (err) {
      toast(`Upload failed: ${err instanceof Error ? err.message : err}`);
    }
  };
  reader.readAsDataURL(file);
};

const fetchFromCanva = async (id: number) => {
  setFetchingId(id);
  try {
    await api.fetchCanvaImage(id);
    drafts.reload();
    toast("Image updated from Canva");
    setFetchFailedIds((s) => { const n = new Set(s); n.delete(id); return n; });
  } catch (e) {
    setFetchFailedIds((s) => new Set(s).add(id));
    toast(`Couldn't fetch from Canva: ${e instanceof Error ? e.message : e}`);
  } finally {
    setFetchingId(null);
  }
};

const openCanva = async (draft: Draft) => {
  const win = window.open("", "_blank");
  try {
    const fresh = await api.openCanvaEdit(draft.id);
    if (win) win.location.href = fresh.canva_edit_url; else window.open(fresh.canva_edit_url, "_blank");
    drafts.reload();
  } catch (e) {
    win?.close();
    toast(`Couldn't open Canva: ${e instanceof Error ? e.message : e}`);
  }
};

  const copyCaption = async (text: string) => {
  try {
    await navigator.clipboard.writeText(text);
    toast("Copied to clipboard");
  } catch {
    toast("Copy failed — clipboard access blocked");
  }
};

const retryOption = async (index: number) => {
  setRetryingIndex(index);
  try {
    const prefill = [context, prompt.trim(), `Target audience: ${audience}`]
      .filter(Boolean).join("\n\n");
    const res = await api.generatePostStream({
      platform: platform.toLowerCase(), tone: tone.toLowerCase(), length: length.toLowerCase(),
      prefill_prompt: prefill, visual_style: style,
      include_hashtags: flags.hashtags, include_cta: flags.cta,
      include_emoji: flags.emoji, include_pricing: flags.pricing, options: 1,
    }, () => {});
    const fresh = res.options[0];
    setGenResult((g) => g ? { ...g, options: g.options.map((o, i) => i === index ? fresh : o) } : g);
    setManualCaptions((m) => { const next = { ...m }; delete next[index]; return next; });
    toast(fresh.caption_failed ? "Still failing — try again shortly" : "Regenerated");
  } catch (e) {
    toast(`Retry failed: ${e instanceof Error ? e.message : e}`);
  } finally {
    setRetryingIndex(null);
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
      color: platformColor(plat),
      imageDataUrl: o.image_b64 ? `data:${o.mime_type};base64,${o.image_b64}` : undefined,
      onError: toast,
    });
    toast("Downloading PNG…");
  };

  const anyCaptionFailed = genResult?.options.some((o) => o.caption_failed) ?? false;
  const anyImageFailed = genResult?.options.some((o) => o.image_failed) ?? false;

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
          {(anyCaptionFailed || anyImageFailed) && (
            <div className="gfail-banner" style={{ marginTop: 14 }}>
              <div className="gfail-ico"><Ico k="alert" /></div>
              <div>
                <div className="gfail-title">
                  {anyCaptionFailed && anyImageFailed
                    ? "AI generation failed — showing manual draft editor"
                    : anyCaptionFailed
                    ? "AI caption generation failed — showing manual draft editor"
                    : "AI image generation failed — showing placeholder images"}
                </div>
                <div className="gfail-sub">
                  {anyCaptionFailed && anyImageFailed
                    ? "Both the caption and image requests failed for one or more options. Edit the draft and design in Canva, or try generating again."
                    : anyCaptionFailed
                    ? "The caption request failed for one or more options. Write your own caption below, or try generating again."
                    : "The image request failed for one or more options. Design in Canva to replace the placeholder, or try generating again."}
                </div>
              </div>
            </div>
          )}
          <div className="gdraft-grid" style={{ marginTop: 14 }}>
            {genResult.options.map((o, i) => (
              <div className="gdraft-card" key={i}>
                <div className={`gdraft-hdr${o.image_b64 && !o.image_failed ? " has-img" : ""}`}
                  style={{ background: platformColor(genResult.platform), padding: 0 }}>
                  {o.image_failed ? (
                    <>
                      <Ico k="camera" />
                      <div className="gdraft-hdr-lbl">Image generation unavailable</div>
                    </>
                  ) : o.image_b64 ? (
                    <img src={`data:${o.mime_type};base64,${o.image_b64}`} alt={`Draft ${i + 1} visual`}
                      style={{ width: "100%", height: "100%", objectFit: "cover", cursor: "zoom-in" }}
                      onClick={() => setLightboxSrc(`data:${o.mime_type};base64,${o.image_b64}`)} />
                  ) : (
                    <><Ico k="camera" /><div className="gdraft-hdr-lbl">Draft {i + 1} &middot; {genResult.platform}</div></>
                  )}
                </div>
                <div className="gdraft-body">
                  {o.caption_failed ? (
                    <div>
                      <div className="gform-lbl">AI caption unavailable — write your own</div>
                      <textarea className="gprompt" aria-label="Manual caption" value={manualCaptions[i] ?? ""}
                        onChange={(e) => setManualCaptions((m) => ({ ...m, [i]: e.target.value }))} />
                    </div>
                  ) : (
                    <>
                      <div className="gdraft-txt">{o.caption}</div>
                      <div className="gdraft-tags">{o.hashtags.map((h) => (h.startsWith("#") ? h : `#${h}`)).join(" ")}</div>
                    </>
                  )}
                  <div className="gdraft-actions">
                    <div className="gdraft-actions-primary">
                      {o.image_failed ? (
                        o.canva_edit_url && (
                          <a className="btn btn-blue btn-sm" href={o.canva_edit_url} target="_blank" rel="noreferrer"
                            onClick={() => autoSaveBeforeCanva(o, genResult.platform, i)}>
                            <Ico k="canva" /> Design in Canva
                          </a>
                        )
                      ) : (
                        <button className="btn btn-blue btn-sm"
                          onClick={() => exportOption(o, genResult.platform)}>Download PNG</button>
                      )}
                    </div>
                    <div className="gdraft-actions-secondary">
                      <button className="btn btn-outline btn-sm" onClick={() => saveOption(o, genResult.platform, i)}>Save to draft</button>
                      {!o.caption_failed && (
                        <button className="btn btn-outline btn-sm"
                          onClick={() => copyCaption([o.caption, ...o.hashtags.map((h) => (h.startsWith("#") ? h : `#${h}`))].join(" "))}>
                          Copy
                        </button>
                      )}
                      {(o.caption_failed || o.image_failed) && (
                        <button className="btn btn-outline btn-sm" onClick={() => retryOption(i)} disabled={retryingIndex === i}>
                          <Ico k="refresh" /> {retryingIndex === i ? "Retrying…" : "Retry AI generation"}
                        </button>
                      )}
                      {o.canva_edit_url && !o.image_failed && (
                        <a className="btn btn-outline btn-sm" href={o.canva_edit_url} target="_blank" rel="noreferrer"
                          onClick={() => autoSaveBeforeCanva(o, genResult.platform, i)}>
                          <Ico k="canva" /> Canva
                        </a>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </>
      )}

      <div className="card sdraft-card">
        <div className="sdraft-card-hdr">Saved drafts</div>
        <input ref={fileInputRef} type="file" accept="image/png,image/jpeg" style={{ display: "none" }}
          onChange={onFileSelected} />
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
                      <div style={{ flex: 1, display: "flex", gap: 12, alignItems: "flex-start" }}>
                      {draft.image_b64 && (
                        draft.image_b64 === PLACEHOLDER_PNG_B64 ? (
                          <div className="sdraft-thumb-placeholder"><Ico k="camera" /></div>
                        ) : (
                          <img
                            src={`data:image/png;base64,${draft.image_b64}`}
                            alt="Draft visual"
                            className="sdraft-thumb"
                            onClick={() => setLightboxSrc(`data:image/png;base64,${draft.image_b64}`)}
                          />
                        )
                      )}
                        <div>
                          <div className="sdraft-title">{draft.caption}</div>
                          <div className="sdraft-meta">{draft.platform} · saved {draft.created_at.slice(0, 10)}</div>
                        </div>
                      </div>
                      <div className="sdraft-actions">
                        <div className="sdraft-actions-row">
                          <button className="btn btn-blue-outline btn-sm"
                            onClick={() => { setEditingId(draft.id); setEditCaption(draft.caption); }}>
                            <Ico k="pencil" /> Edit
                          </button>
                          {draft.image_b64 !== PLACEHOLDER_PNG_B64 && (
                            <button className="btn btn-blue-outline btn-sm"
                              onClick={() => { void downloadPostPNG({
                                color: platformColor(draft.platform),
                                imageDataUrl: draft.image_b64 ? `data:image/png;base64,${draft.image_b64}` : undefined,
                                onError: toast }); toast("Downloading PNG…"); }}>
                              Download PNG
                            </button>
                          )}
                          {draft.canva_edit_url && (
                            <button className="btn btn-outline btn-sm" onClick={() => openCanva(draft)}>
                              <Ico k="canva" /> Canva
                            </button>
                          )}
                        </div>
                        <div className="sdraft-actions-row">
                          {draft.canva_design_id && (
                            <button className="btn btn-blue-outline btn-sm" onClick={() => fetchFromCanva(draft.id)}
                              disabled={fetchingId === draft.id}>
                              <Ico k="canva" /> {fetchingId === draft.id ? "Fetching…" : "Fetch latest from Canva"}
                            </button>
                          )}
                          {(fetchFailedIds.has(draft.id) || !draft.canva_design_id) && (
                            <button className="btn btn-outline btn-sm" onClick={() => triggerUpload(draft.id)}>Upload PNG</button>
                          )}
                          <button className="btn btn-outline btn-sm" onClick={() => removeDraft(draft.id)}>
                            <Ico k="trash" /> Delete
                          </button>
                        </div>
                      </div>
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
      {lightboxSrc && (
      <div className="lightbox-overlay" onClick={() => setLightboxSrc(null)}>
        <button className="lightbox-close" onClick={() => setLightboxSrc(null)}>&times;</button>
        <img src={lightboxSrc} alt="Enlarged" className="lightbox-img" onClick={(e) => e.stopPropagation()} />
      </div>
    )}
    </div>
  );
}
