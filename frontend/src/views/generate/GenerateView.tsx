import { useState } from "react";
import { Ico } from "../../components/Ico";
import { AsyncSection } from "../../components/AsyncSection";
import { ProgressBar } from "../../components/ProgressBar";
import { StatusBadge } from "../../components/StatusBadge";
import { SuggestedPosts } from "../../components/SuggestedPosts";
import { TagPill } from "../../components/TagPill";
import { useModes } from "../../providers/useModes";
import { useGenerate } from "../../providers/useGenerate";
import { PLATFORMS, TONES, LENGTHS, AUDIENCES, STYLES,
  platformColor, PLACEHOLDER_PNG_B64 } from "../../providers/GenerateProvider";
import { ChipRow } from "./ChipRow";
import { ToggleChip } from "./ToggleChip";
import { downloadPostPNG } from "../../lib/exportPng";
import type { Draft } from "../../types";

export function GenerateView() {
  const modes = useModes();
  const {
    drafts, recos, recoProgress, setRecoProgress,toast,
    platform, setPlatform, tone, setTone, length, setLength, audience, setAudience,
    style, setStyle, prompt, setPrompt, context, setContext, flags, setFlags,
    genResult, busy, genProgress,
    editingId, setEditingId, editCaption, setEditCaption,
    manualCaptions, setManualCaptions,
    fileInputRef, fetchingId, fetchFailedIds, pushingId, retryingIndex,
    lightboxSrc, setLightboxSrc,
    doGenerate, saveOption, autoSaveBeforeCanva, triggerUpload, onFileSelected,
    fetchFromCanva, openCanva, pushToCanva, copyCaption, retryOption,
    removeDraft, saveCaption, exportOption,
  } = useGenerate();

  const [heroIgId, setHeroIgId] = useState<number | null>(null);
  const [heroFbId, setHeroFbId] = useState<number | null>(null);

  const renderDraftActions = (hero: Draft) => (
    <div className="hero-actions">
      <div className="hero-actions-row">
        <button className="btn btn-blue-outline btn-sm"
          onClick={() => { setEditingId(hero.id); setEditCaption(hero.caption); }}>
          <Ico k="pencil" /> Edit
        </button>
        {hero.image_b64 !== PLACEHOLDER_PNG_B64 && (
          <button className="btn btn-blue-outline btn-sm" onClick={() => { void downloadPostPNG({
            color: platformColor(hero.platform),
            imageDataUrl: hero.image_b64 ? `data:image/png;base64,${hero.image_b64}` : undefined, onError: toast }); }}>
            Download PNG
          </button>
        )}
        {hero.canva_edit_url && (
          <button className="btn btn-outline btn-sm" onClick={() => openCanva(hero)}>
            <Ico k="canva" /> Canva
          </button>
        )}
      </div>
      <div className="hero-actions-row">
        {hero.canva_design_id && (
          <button className="btn btn-blue-outline btn-sm" disabled={fetchingId === hero.id}
            onClick={() => fetchFromCanva(hero.id)}>
            <Ico k="canva" /> {fetchingId === hero.id ? "Fetching…" : "Fetch latest from Canva"}
          </button>
        )}
        {hero.image_b64 !== PLACEHOLDER_PNG_B64 && (
          <button className="btn btn-blue-outline btn-sm" disabled={pushingId === hero.id}
            onClick={() => pushToCanva(hero.id)}>
            <Ico k="canva" /> {pushingId === hero.id ? "Pushing…" : "Push to Canva"}
          </button>
        )}
        {(fetchFailedIds.has(hero.id) || !hero.canva_design_id) && (
          <button className="btn btn-outline btn-sm" onClick={() => triggerUpload(hero.id)}>Upload PNG</button>
        )}
        <button className="btn btn-outline btn-sm" onClick={() => removeDraft(hero.id)}>
          <Ico k="trash" /> Delete
        </button>
      </div>
    </div>
  );

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
        <div style={{ padding: 22 }}>
          <AsyncSection q={drafts}>
            {(d) => {
              if (d.items.length === 0) {
                return <div className="empty-note">No saved drafts yet. Generate posts and click "Save to draft" to store them here.</div>;
              }
              const igDrafts = d.items.filter((x) => x.platform.toLowerCase() === "instagram");
              const fbDrafts = d.items.filter((x) => x.platform.toLowerCase() === "facebook");
              const igHero = igDrafts.find((x) => x.id === heroIgId) ?? igDrafts[0];
              const fbHero = fbDrafts.find((x) => x.id === heroFbId) ?? fbDrafts[0];
              return (
                <div className="hsplit-grid">
                                    <div className="hsplit-col">
                    <div className="hsplit-plat-lbl">Instagram</div>
                    {igHero ? (
                      <>
                        <div className="hero-block">
                          <div className="hero-row">
                            <div className="hero-ig">
                            <div className="hero-ig-hdr">
                              <div className="hero-ig-avatar"><Ico k="social" /></div>
                              <div className="hero-ig-handle">urbanspace.sg</div>
                            </div>
                            <div className="hero-ig-img">
                              {igHero.image_b64 && igHero.image_b64 !== PLACEHOLDER_PNG_B64 ? (
                                <img src={`data:image/png;base64,${igHero.image_b64}`} alt="Draft visual"
                                  onClick={() => setLightboxSrc(`data:image/png;base64,${igHero.image_b64}`)} />
                              ) : (
                                <Ico k="camera" />
                              )}
                            </div>
                            <div className="hero-ig-icons">
                              <Ico k="heart" /><Ico k="msg" /><Ico k="send" />
                              <div style={{ flex: 1 }} />
                              <Ico k="bookmark" />
                            </div>
                            <div className="hero-ig-body">
                              {editingId === igHero.id ? (
                                <div>
                                  <textarea className="gprompt" aria-label="Edit draft caption" value={editCaption}
                                    onChange={(e) => setEditCaption(e.target.value)} />
                                  <div style={{ display: "flex", gap: 8, marginTop: 6 }}>
                                    <button className="btn btn-ora btn-sm" onClick={() => saveCaption(igHero.id)}>Save</button>
                                    <button className="btn btn-white btn-sm" onClick={() => setEditingId(null)}>Cancel</button>
                                  </div>
                                </div>
                              ) : (
                                <><b>urbanspace.sg</b> {igHero.caption}</>
                              )}
                            </div>
                          </div>
                          <div className="hero-rail-vert">
                            {igDrafts.map((dr) => (
                              <div key={dr.id} className={`hero-thumb ${dr.id === igHero.id ? "on" : ""}`}
                                onClick={() => setHeroIgId(dr.id)}>
                                {dr.image_b64 && dr.image_b64 !== PLACEHOLDER_PNG_B64
                                  ? <img src={`data:image/png;base64,${dr.image_b64}`} alt="" />
                                  : <Ico k="camera" />}
                              </div>
                            ))}
                          </div>
                          </div>
                          {renderDraftActions(igHero)}
                        </div>
                      </>
                    ) : (
                      <div className="hero-empty">No Instagram drafts yet — save one to see it here.</div>
                    )}
                  </div>

                  <div className="hsplit-col">
                    <div className="hsplit-plat-lbl">Facebook</div>
                    {fbHero ? (
                      <>
                      <div className="hero-block"> 
                        <div className="hero-row">
                          <div className="hero-fb">
                            <div className="hero-fb-hdr">
                              <div className="hero-fb-avatar"><Ico k="social" /></div>
                              <div style={{ flex: 1 }}>
                                <div className="hero-fb-name">UrbanSpace Self Storage</div>
                                <div className="hero-fb-meta">saved {fbHero.created_at.slice(0, 10)} <Ico k="world" /></div>
                              </div>
                            </div>
                            {editingId === fbHero.id ? (
                              <div style={{ padding: "0 13px 12px" }}>
                                <textarea className="gprompt" aria-label="Edit draft caption" value={editCaption}
                                  onChange={(e) => setEditCaption(e.target.value)} />
                                <div style={{ display: "flex", gap: 8, marginTop: 6 }}>
                                  <button className="btn btn-ora btn-sm" onClick={() => saveCaption(fbHero.id)}>Save</button>
                                  <button className="btn btn-white btn-sm" onClick={() => setEditingId(null)}>Cancel</button>
                                </div>
                              </div>
                            ) : (
                              <div className="hero-fb-cap">{fbHero.caption}</div>
                            )}
                            <div className="hero-fb-img">
                              {fbHero.image_b64 && fbHero.image_b64 !== PLACEHOLDER_PNG_B64 ? (
                                <img src={`data:image/png;base64,${fbHero.image_b64}`} alt="Draft visual"
                                  onClick={() => setLightboxSrc(`data:image/png;base64,${fbHero.image_b64}`)} />
                              ) : (
                                <Ico k="camera" />
                              )}
                            </div>
                            <div className="hero-fb-actionbar">
                              <div className="hero-fb-action"><Ico k="thumbUp" /> Like</div>
                              <div className="hero-fb-action"><Ico k="msg" /> Comment</div>
                              <div className="hero-fb-action"><Ico k="share" /> Share</div>
                            </div>
                          </div>
                          <div className="hero-rail-vert">
                            {fbDrafts.map((dr) => (
                              <div key={dr.id} className={`hero-thumb ${dr.id === fbHero.id ? "on" : ""}`}
                                onClick={() => setHeroFbId(dr.id)}>
                                {dr.image_b64 && dr.image_b64 !== PLACEHOLDER_PNG_B64
                                  ? <img src={`data:image/png;base64,${dr.image_b64}`} alt="" />
                                  : <Ico k="camera" />}
                              </div>
                            ))}
                          </div>
                        </div>
                        {renderDraftActions(fbHero)}
                      </div>
                      </>
                    ) : (
                      <div className="hero-empty">No Facebook drafts yet — save one to see it here.</div>
                    )}
                  </div>
                </div>
              );
            }}
          </AsyncSection>
        </div>
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