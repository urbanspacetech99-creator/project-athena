import { render, screen } from "@testing-library/react";
import { afterEach, expect, test, vi } from "vitest";
import { HomeView } from "../views/HomeView";

afterEach(() => vi.restoreAllMocks());

const ok = (body: unknown) => ({ ok: true, status: 200, statusText: "OK", json: async () => body });

function stubHomeFetch() {
  vi.stubGlobal("fetch", vi.fn((url: string) => {
    if (url.startsWith("/home/weekly-kpi"))
      return Promise.resolve(ok({ posts: 6, views: 11800, likes: 1420, interactions: 3200 }));
    if (url.startsWith("/home/weekly-engagement"))
      return Promise.resolve(ok({
        top_post: { source_id: "p1", platform: "instagram", content: "3 months free promo",
          views: 2140, likes: 300, interactions: 90 },
        insights: { summary: "Storage demand is up.", themes: ["pricing", "access"],
          sentiment: "positive", recurring_feedback: ["show prices upfront"] },
      }));
    if (url.startsWith("/data/own-posts")) // two windows 7 days apart -> deltas render
      return Promise.resolve(ok({ items: [
        { id: 1, source_id: "a", platform: "instagram", title: "", content: "", views: 100,
          likes: 10, interactions: 5, window_date: "2026-07-01T00:00:00Z" },
        { id: 2, source_id: "a", platform: "instagram", title: "", content: "", views: 150,
          likes: 12, interactions: 5, window_date: "2026-07-08T00:00:00Z" },
      ], count: 2 }));
    return Promise.reject(new Error(`unexpected ${url}`));
  }));
}

test("renders real KPIs, top post, insights, and WoW badge", async () => {
  stubHomeFetch();
  render(<HomeView onNavigate={() => {}} />);
  expect(await screen.findByText("11.8k")).toBeInTheDocument();       // views ktile
  expect(await screen.findByText(/3 months free promo/)).toBeInTheDocument();
  expect(await screen.findByText("Storage demand is up.")).toBeInTheDocument();
  expect(await screen.findByText(/\+50%/)).toBeInTheDocument();       // views WoW badge
  expect(screen.getByText("pricing")).toBeInTheDocument();            // theme pill
});
