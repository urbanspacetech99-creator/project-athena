import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, expect, test, vi } from "vitest";
import { ToastProvider } from "../../providers/ToastProvider";
import { GenerateView } from "./GenerateView";

afterEach(() => vi.restoreAllMocks());
const ok = (body: unknown) => ({ ok: true, status: 200, statusText: "OK", json: async () => body });

/** Streaming endpoints return NDJSON over a ReadableStream body (see lib/stream.ts). */
const ndjson = (events: unknown[]) => ({
  ok: true, status: 200, statusText: "OK",
  body: new ReadableStream<Uint8Array>({
    start(controller) {
      const enc = new TextEncoder();
      for (const e of events) controller.enqueue(enc.encode(JSON.stringify(e) + "\n"));
      controller.close();
    },
  }),
});

const POST_OPTION = {
  caption: "Real AI caption", hashtags: ["#UrbanSpaceSG"], image_b64: "aGk=",
  mime_type: "image/png", canva_edit_url: "https://canva.example/edit/1",
  visual_style: "clean_product",
};

function stubFetch(overrides: Record<string, unknown> = {}) {
  const calls: Array<{ url: string; init?: RequestInit }> = [];
  vi.stubGlobal("fetch", vi.fn((url: string, init?: RequestInit) => {
    calls.push({ url, init });
    if (url.startsWith("/generate/post/stream"))
      return Promise.resolve(ndjson([
        { event: "progress", step: 0, total: 12, label: "Starting…" },
        { event: "result", data: overrides["/generate/post/stream"] ?? { options: [POST_OPTION] } },
      ]));
    if (url.startsWith("/generate/recommendations/stream"))
      return Promise.resolve(ndjson([
        { event: "progress", step: 0, total: 5, label: "Starting…" },
        { event: "result", data: { titles: ["3 months free"], prefill_prompt: "Reco context",
                                    rationale: "Promo interest is highest." } },
      ]));
    if (url.startsWith("/generate/drafts") && init?.method === "POST")
      return Promise.resolve(ok({ id: 8, platform: "instagram", caption: "new", image_b64: "",
        canva_edit_url: "", created_at: "2026-07-13T00:00:00Z" }));
    if (url.startsWith("/generate/drafts") && init?.method === "PATCH")
      return Promise.resolve(ok({ id: 7, platform: "instagram", caption: "Edited caption", image_b64: "",
        canva_edit_url: "", created_at: "2026-07-10T00:00:00Z" }));
    if (url.startsWith("/generate/drafts") && init?.method === "DELETE")
      return Promise.resolve({ ok: true, status: 204, statusText: "No Content" });
    if (url.startsWith("/generate/drafts"))
      return Promise.resolve(ok({ items: [
        { id: 7, platform: "instagram", caption: "Saved caption", image_b64: "",
          canva_edit_url: "", created_at: "2026-07-10T00:00:00Z" },
      ], count: 1 }));
    return Promise.reject(new Error(`unexpected ${url}`));
  }));
  return calls;
}

test("prefills prompt from handoff, generates with combined prefill_prompt", async () => {
  const calls = stubFetch();
  render(<ToastProvider>
    <GenerateView request={{ title: "Beat them on price", context: "Competitor context" }} />
  </ToastProvider>);
  expect(await screen.findByDisplayValue("Beat them on price")).toBeInTheDocument();

  await userEvent.click(screen.getByRole("button", { name: /generate 3 options/i }));
  expect(await screen.findByText("Real AI caption")).toBeInTheDocument();
  expect(screen.getByText("#UrbanSpaceSG")).toBeInTheDocument();
  expect(screen.getByRole("link", { name: /canva/i })).toHaveAttribute("href", "https://canva.example/edit/1");

  const gen = calls.find((c) => c.url === "/generate/post/stream")!;
  const body = JSON.parse(gen.init!.body as string);
  expect(body.prefill_prompt).toContain("Competitor context");
  expect(body.prefill_prompt).toContain("Beat them on price");
  expect(body.prefill_prompt).toContain("Target audience: Homeowners");
  expect(body.platform).toBe("instagram");
  expect(body.options).toBe(3);
});

test("lists persisted drafts and saves an option as a draft", async () => {
  const calls = stubFetch();
  render(<ToastProvider><GenerateView request={null} /></ToastProvider>);
  expect(await screen.findByText("Saved caption")).toBeInTheDocument();

  await userEvent.click(screen.getByRole("button", { name: /generate 3 options/i }));
  await screen.findByText("Real AI caption");
  await userEvent.click(screen.getByRole("button", { name: /save to draft/i }));
  const post = calls.find((c) => c.url === "/generate/drafts" && c.init?.method === "POST")!;
  expect(JSON.parse(post.init!.body as string).caption).toContain("Real AI caption");
});

test("shows AI recommendations with rationale", async () => {
  stubFetch();
  render(<ToastProvider><GenerateView request={null} /></ToastProvider>);
  expect(await screen.findByText("3 months free")).toBeInTheDocument();
  expect(await screen.findByText(/Promo interest is highest/)).toBeInTheDocument();
});

test("saving keeps the platform the options were generated for", async () => {
  const calls = stubFetch();
  render(<ToastProvider><GenerateView request={null} /></ToastProvider>);
  await userEvent.click(screen.getByRole("button", { name: /generate 3 options/i }));
  await screen.findByText("Real AI caption");
  // switching the platform chip AFTER generating must not relabel or mis-save the options
  await userEvent.click(screen.getByRole("button", { name: "Facebook" }));
  await userEvent.click(screen.getByRole("button", { name: /save to draft/i }));
  const post = calls.find((c) => c.url === "/generate/drafts" && c.init?.method === "POST")!;
  expect(JSON.parse(post.init!.body as string).platform).toBe("instagram");
});

test("edits a saved draft's caption via PATCH", async () => {
  const calls = stubFetch();
  render(<ToastProvider><GenerateView request={null} /></ToastProvider>);
  await screen.findByText("Saved caption");
  await userEvent.click(screen.getByRole("button", { name: /edit/i }));
  const box = screen.getByDisplayValue("Saved caption");
  await userEvent.clear(box);
  await userEvent.type(box, "Edited caption");
  await userEvent.click(screen.getByRole("button", { name: /^save$/i }));
  const patch = calls.find((c) => c.url === "/generate/drafts/7" && c.init?.method === "PATCH")!;
  expect(JSON.parse(patch.init!.body as string).caption).toBe("Edited caption");
});

test("generated image renders in a square card header", async () => {
  stubFetch();
  render(<ToastProvider><GenerateView request={null} /></ToastProvider>);
  await userEvent.click(screen.getByRole("button", { name: /generate 3 options/i }));
  const img = await screen.findByAltText("Draft 1 visual");
  expect(img.closest(".gdraft-hdr")!.className).toContain("has-img");
});

test("recommendations served from cache on remount — no refetch", async () => {
  stubFetch();
  const first = render(<ToastProvider><GenerateView request={null} /></ToastProvider>);
  expect(await screen.findByText("3 months free")).toBeInTheDocument();
  first.unmount();

  const calls = stubFetch(); // fresh mock: any recommendations call would be recorded here
  render(<ToastProvider><GenerateView request={null} /></ToastProvider>);
  expect(await screen.findByText("3 months free")).toBeInTheDocument();
  expect(calls.some((c) => c.url.startsWith("/generate/recommendations"))).toBe(false);
});

test("refresh on AI Recommendations busts cache and re-streams", async () => {
  const calls = stubFetch();
  render(<ToastProvider><GenerateView request={null} /></ToastProvider>);
  expect(await screen.findByText("3 months free")).toBeInTheDocument();
  const before = calls.filter((c) => c.url.startsWith("/generate/recommendations/stream")).length;
  await userEvent.click(screen.getByRole("button", { name: /refresh/i }));
  await screen.findByText("3 months free");
  const after = calls.filter((c) => c.url.startsWith("/generate/recommendations/stream")).length;
  expect(after).toBe(before + 1);
});
