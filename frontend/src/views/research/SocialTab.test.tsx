import { render, screen } from "@testing-library/react";
import { afterEach, expect, test, vi } from "vitest";
import { SocialTab } from "./SocialTab";

afterEach(() => vi.restoreAllMocks());
const ok = (body: unknown) => ({ ok: true, status: 200, statusText: "OK", json: async () => body });
const post = (id: number, platform: string, content: string, views: number, likes: number, interactions: number) => ({
  id, source_id: `p${id}`, platform, title: "", content, views, likes,
  interactions, window_date: "2026-07-08T00:00:00Z",
});

test("ranks own posts per platform by interactions, lists comments and reviews with avg rating", async () => {
  vi.stubGlobal("fetch", vi.fn((url: string) => {
    if (url.startsWith("/research/social-reviews"))
      return Promise.resolve(ok({ views: 11800,
        insights: { comment_topics: ["pricing", "access"], review_summary: "Mostly positive." },
        titles: ["Show your price upfront"], prefill_prompt: "Social context" }));
    if (url.startsWith("/data/own-posts"))
      return Promise.resolve(ok({ items: [
        // realistic: the Meta adapter has no Facebook views metric, so every facebook row has views: 0
        post(1, "facebook", "FB low", 0, 5, 2), post(2, "facebook", "FB high", 0, 50, 50),
        post(3, "instagram", "IG post", 500, 30, 12),
      ], count: 3 }));
    if (url.startsWith("/data/post-comments"))
      return Promise.resolve(ok({ items: [
        { id: 1, source_id: "c1", post_source_id: "p1", text: "Prices please!", window_date: "2026-07-08T00:00:00Z" },
      ], count: 1 }));
    if (url.startsWith("/data/google-reviews"))
      return Promise.resolve(ok({ items: [
        { id: 1, source_id: "r1", star_rating: 5, comment: "Great!", reviewer: "Priya R.", window_date: "2026-07-08T00:00:00Z" },
        { id: 2, source_id: "r2", star_rating: 4, comment: "Good.", reviewer: "Tan JW", window_date: "2026-07-08T00:00:00Z" },
      ], count: 2 }));
    return Promise.reject(new Error(`unexpected ${url}`));
  }));
  render(<SocialTab onGenerate={() => {}} />);
  const high = await screen.findByText("FB high");
  const low = screen.getByText("FB low");
  // FB high (50 interactions) must rank above FB low (2): both have views 0, so a views sort would misorder.
  expect(high.compareDocumentPosition(low) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  expect(screen.getAllByText("Interactions")).toHaveLength(2);     // FB + IG rank headers
  expect(await screen.findByText("Prices please!")).toBeInTheDocument();
  expect(await screen.findByText("Priya R.")).toBeInTheDocument();
  expect(await screen.findByText("★4.5 · 2")).toBeInTheDocument(); // avg of 5 and 4 · count of the same fetched window
  expect(await screen.findByText("Mostly positive.")).toBeInTheDocument();
  expect(await screen.findByText("pricing")).toBeInTheDocument();
});
