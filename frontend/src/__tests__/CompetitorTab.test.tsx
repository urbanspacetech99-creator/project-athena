import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, expect, test, vi } from "vitest";
import { CompetitorTab } from "../views/research/CompetitorTab";

afterEach(() => vi.restoreAllMocks());
beforeEach(() => localStorage.clear());   // per-competitor cache must not bleed across tests
const ok = (body: unknown) => ({ ok: true, status: 200, statusText: "OK", json: async () => body });

function stub() {
  vi.stubGlobal("fetch", vi.fn((url: string) => {
    if (url.startsWith("/config/modes"))
      return Promise.resolve(ok({ sources: { meta: "fixture", google_reviews: "fixture",
        google_ads: "fixture", zoho: "fixture", google_places: "fixture" },
        ai: { llm: "fake", image: "fake", canva: "fake" } }));
    if (url.startsWith("/config/competitors"))
      return Promise.resolve(ok({ items: [
        { id: 1, platform: "facebook", name: "BigBox", external_id: "", enabled: true, created_at: "", updated_at: "" },
        { id: 2, platform: "instagram", name: "BigBox", external_id: "bigbox_sg", enabled: true, created_at: "", updated_at: "" },
        { id: 3, platform: "google", name: "BigBox", external_id: "", enabled: true, created_at: "", updated_at: "" },
      ], count: 3 }));
    if (url.startsWith("/research/competitor"))
      return Promise.resolve(ok({ insights: { activity_summary: "Promo-heavy.",
        recommendations: [{ title: "Publish prices", detail: "They hide pricing." }] },
        titles: ["Beat them on price"], prefill_prompt: "Competitor context" }));
    if (url.startsWith("/data/competitor-posts"))
      return Promise.resolve(ok({ items: [
        { id: 1, source_id: "a", competitor: "BigBox", platform: "facebook",
          text: "BigBox FB promo", like_count: 5, comment_count: 4, window_date: "2026-07-08T00:00:00Z" },
        { id: 2, source_id: "b", competitor: "bigbox_sg", platform: "instagram",
          text: "BigBox IG reel", like_count: 9, comment_count: 6, window_date: "2026-07-07T00:00:00Z" },
      ], count: 2 }));
    if (url.startsWith("/data/competitor-reviews"))
      return Promise.resolve(ok({ items: [
        { id: 1, source_id: "r1", competitor: "BigBox", star_rating: 3, comment: "Queues at peak.",
          reviewer: "Ong K.", place_rating: 4.4, place_review_count: 210, window_date: "2026-07-06T00:00:00Z" },
      ], count: 1 }));
    return Promise.reject(new Error(`unexpected ${url}`));
  }));
}

test("renders per-platform cards, comment counts, reviews and recommendations", async () => {
  stub();
  const onGenerate = vi.fn();
  render(<CompetitorTab onGenerate={onGenerate} />);

  expect(await screen.findByText("BigBox FB promo")).toBeInTheDocument();      // FB recent post
  expect(await screen.findByText("BigBox IG reel")).toBeInTheDocument();       // IG recent post (alias-joined)
  expect(screen.getByText("4 comments")).toBeInTheDocument();                  // FB comment-count header
  expect(screen.getByText("6 comments")).toBeInTheDocument();                  // IG comment-count header
  expect(await screen.findByText("Ong K.")).toBeInTheDocument();               // Google review
  expect(screen.getByText("★4.4 · 210")).toBeInTheDocument();                  // place rating + total
  expect(await screen.findByText("Publish prices")).toBeInTheDocument();       // recommendation title

  await userEvent.click(screen.getByRole("button", { name: /generate/i }));
  expect(onGenerate).toHaveBeenCalledWith("Beat them on price", "Competitor context");
});

test("shows empty state when no competitors", async () => {
  vi.stubGlobal("fetch", vi.fn((url: string) => {
    if (url.startsWith("/config/modes")) return Promise.resolve(ok({ sources: {}, ai: {} }));
    if (url.startsWith("/config/competitors")) return Promise.resolve(ok({ items: [], count: 0 }));
    if (url.startsWith("/research/competitor")) return Promise.resolve(ok({ insights: { activity_summary: "", recommendations: [] }, titles: [], prefill_prompt: "" }));
    if (url.startsWith("/data/competitor-posts")) return Promise.resolve(ok({ items: [], count: 0 }));
    if (url.startsWith("/data/competitor-reviews")) return Promise.resolve(ok({ items: [], count: 0 }));
    return Promise.reject(new Error(`unexpected ${url}`));
  }));
  render(<CompetitorTab onGenerate={vi.fn()} />);
  expect(await screen.findByText(/No competitors tracked yet/)).toBeInTheDocument();
});
