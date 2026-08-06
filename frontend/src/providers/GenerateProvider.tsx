import { createContext, useEffect, useRef, useState,
  type ChangeEvent, type Dispatch, type ReactNode, type RefObject, type SetStateAction } from "react";
import { api } from "../lib/api";
import { useApi, useCachedApi, type Query } from "../hooks/useApi";
import { CACHE_KEYS } from "../lib/cacheKeys";
import { downloadPostPNG } from "../lib/exportPng";
import { useToast } from "./useToast";
import type { Draft, ListResponse, PostOption, Recommendations, StreamProgress } from "../types";

export const PLATFORMS = ["Instagram", "Facebook"] as const;
export const TONES = ["Friendly", "Professional", "Urgent", "Funny"] as const;
export const LENGTHS = ["Short", "Medium", "Long"] as const;
export const AUDIENCES = ["Homeowners", "E-commerce Sellers", "Startups/SMEs", "Businesses"] as const;
export const STYLES: Array<{ label: string; value: string }> = [
  { label: "Before/After", value: "before_after" },
  { label: "Product", value: "clean_product" },
  { label: "Lifestyle", value: "lifestyle" },
  { label: "Text-forward", value: "text_forward" },
];
const PLATFORM_COLOR: Record<string, string> = { instagram: "#E8651A", facebook: "#4A87BE" };
export const platformColor = (p: string) => PLATFORM_COLOR[p.toLowerCase()] ?? "#E8651A";

// Kept in sync with backend/src/athena/ai/images.py PLACEHOLDER_PNG_B64 — used only to
// detect drafts still showing the failure placeholder, never rendered directly.
export const PLACEHOLDER_PNG_B64 = "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR4" +
  "2mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==";

//const MAX_PERSIST_BYTES = 2_000_000; // ~2MB — conservative slice of localStorage's ~5-10MB budget
const GEN_RESULT_KEY = "athena_genResult";

export interface GenerateContextValue {
  drafts: Query<ListResponse<Draft>>;
  recos: Query<Recommendations>;
  recoProgress: StreamProgress | null;
  setRecoProgress: (p: StreamProgress | null) => void;
  toast: (msg: string) => void;

  platform: (typeof PLATFORMS)[number]; setPlatform: (p: (typeof PLATFORMS)[number]) => void;
  tone: (typeof TONES)[number]; setTone: (t: (typeof TONES)[number]) => void;
  length: (typeof LENGTHS)[number]; setLength: (l: (typeof LENGTHS)[number]) => void;
  audience: (typeof AUDIENCES)[number]; setAudience: (a: (typeof AUDIENCES)[number]) => void;
  style: string; setStyle: (s: string) => void;
  prompt: string; setPrompt: (p: string) => void;
  context: string; setContext: (c: string) => void;
  flags: { hashtags: boolean; cta: boolean; emoji: boolean; pricing: boolean };
  setFlags: (f: { hashtags: boolean; cta: boolean; emoji: boolean; pricing: boolean }) => void;

  genResult: { platform: (typeof PLATFORMS)[number]; options: PostOption[] } | null;
  busy: boolean;
  genProgress: StreamProgress | null;
  editingId: number | null; setEditingId: (id: number | null) => void;
  editCaption: string; setEditCaption: (c: string) => void;
  manualCaptions: Record<number, string>; setManualCaptions: Dispatch<SetStateAction<Record<number, string>>>;
  fileInputRef: RefObject<HTMLInputElement>;
  fetchingId: number | null;
  fetchFailedIds: Set<number>;
  pushingId: number | null;
  retryingIndex: number | null;
  lightboxSrc: string | null; setLightboxSrc: (s: string | null) => void;

  doGenerate: () => Promise<void>;
  saveOption: (o: PostOption, plat: string, index: number) => Promise<void>;
  autoSaveBeforeCanva: (o: PostOption, plat: string, index: number) => void;
  triggerUpload: (id: number) => void;
  onFileSelected: (e: ChangeEvent<HTMLInputElement>) => void;
  fetchFromCanva: (id: number) => Promise<void>;
  openCanva: (draft: Draft) => Promise<void>;
  pushToCanva: (id: number) => Promise<void>;
  copyCaption: (text: string) => Promise<void>;
  retryOption: (index: number) => Promise<void>;
  removeDraft: (id: number) => Promise<void>;
  saveCaption: (id: number) => Promise<void>;
  exportOption: (o: PostOption, plat: string) => void;
  loadPrefill: (title: string, context: string) => void;
}

export const GenerateContext = createContext<GenerateContextValue | undefined>(undefined);

export function GenerateProvider({ children }: { children: ReactNode }) {
  const toast = useToast();
  const drafts = useApi(api.listDrafts);
  const [recoProgress, setRecoProgress] = useState<StreamProgress | null>(null);
  const recos = useCachedApi(CACHE_KEYS.recommendations, () => api.recommendationsStream(setRecoProgress));

  const [platform, setPlatform] = useState<(typeof PLATFORMS)[number]>("Instagram");
  const [tone, setTone] = useState<(typeof TONES)[number]>("Friendly");
  const [length, setLength] = useState<(typeof LENGTHS)[number]>("Short");
  const [audience, setAudience] = useState<(typeof AUDIENCES)[number]>("Homeowners");
  const [style, setStyle] = useState(STYLES[0].value);
  const [prompt, setPrompt] = useState("");
  const [context, setContext] = useState("");
  const [flags, setFlags] = useState({ hashtags: true, cta: true, emoji: false, pricing: false });
  const [genResult, setGenResult] = useState<{ platform: (typeof PLATFORMS)[number]; options: PostOption[] } | null>(() => {
    try {
        const saved = localStorage.getItem(GEN_RESULT_KEY);
        return saved ? JSON.parse(saved) : null;
    } catch {
        return null;
    }
    });
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
  const [pushingId, setPushingId] = useState<number | null>(null);
  const [retryingIndex, setRetryingIndex] = useState<number | null>(null);
  const [lightboxSrc, setLightboxSrc] = useState<string | null>(null);

  useEffect(() => {
    if (!busy) return;
    const handler = (e: BeforeUnloadEvent) => { e.preventDefault(); e.returnValue = ""; };
    window.addEventListener("beforeunload", handler);
    return () => window.removeEventListener("beforeunload", handler);
    }, [busy]);

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
        image_b64: o.image_b64, canva_edit_url: o.canva_edit_url, canva_design_id: o.canva_design_id,
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

  const onFileSelected = (e: ChangeEvent<HTMLInputElement>) => {
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

  const pushToCanva = async (id: number) => {
    setPushingId(id);
    try {
      await api.pushToCanva(id);
      drafts.reload();
      toast("Pushed to Canva");
    } catch (e) {
      toast(`Couldn't push to Canva: ${e instanceof Error ? e.message : e}`);
    } finally {
      setPushingId(null);
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

  const loadPrefill = (title: string, ctx: string) => {
    setPrompt(title);
    setContext(ctx);
    setGenResult(null);
    setManualCaptions({});
    setAutoSavedIndices(new Set());
  };

  const value: GenerateContextValue = {
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
    removeDraft, saveCaption, exportOption, loadPrefill,
  };

  return <GenerateContext.Provider value={value}>{children}</GenerateContext.Provider>;
}