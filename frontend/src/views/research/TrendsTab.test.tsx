import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, expect, test, vi } from "vitest";
import { ModesProvider } from "../../providers/ModesProvider";
import { TrendsTab } from "./TrendsTab";

afterEach(() => vi.restoreAllMocks());
const ok = (body: unknown) => ({ ok: true, status: 200, statusText: "OK", json: async () => body });

test("renders volume bars, WoW tags, and hands off suggestions", async () => {
  vi.stubGlobal("fetch", vi.fn((url: string) => {
    if (url.startsWith("/research/internet-trends"))
      return Promise.resolve(ok({
        keywords: [{ keyword: "self storage", weekly_search_volume: 9800 },
                   { keyword: "fulfilment", weekly_search_volume: 4900 },
                   // duplicate row: the API may return one row per week a keyword ranked top-5
                   { keyword: "self storage", weekly_search_volume: 7000 }],
        titles: ["Storage made simple"], prefill_prompt: "Trend context",
      }));
    if (url.startsWith("/data/keyword-volumes"))
      return Promise.resolve(ok({ items: [
        { id: 1, source_id: "a", keyword: "self storage", weekly_search_volume: 7000, window_date: "2026-07-01T00:00:00Z" },
        { id: 2, source_id: "b", keyword: "self storage", weekly_search_volume: 9800, window_date: "2026-07-08T00:00:00Z" },
        { id: 3, source_id: "c", keyword: "fulfilment", weekly_search_volume: 4900, window_date: "2026-07-08T00:00:00Z" },
      ], count: 3 }));
    return Promise.reject(new Error(`unexpected ${url}`));
  }));
  const onGenerate = vi.fn();
  render(<TrendsTab onGenerate={onGenerate} />);
  expect((await screen.findAllByText("self storage")).length).toBeGreaterThan(0);
  expect((await screen.findAllByText("+40%")).length).toBeGreaterThan(0); // 7000 -> 9800
  expect((await screen.findAllByText("NEW")).length).toBeGreaterThan(0);  // fulfilment
  // deduped ranking: "self storage" appears once at #1 with its highest volume
  expect(screen.getAllByText("9,800/wk")).toHaveLength(1);
  expect(screen.queryByText("7,000/wk")).toBeNull();
  await userEvent.click(screen.getByRole("button", { name: /generate/i }));
  expect(onGenerate).toHaveBeenCalledWith("Storage made simple", "Trend context");
});

// A source switched to live before its first ingest has zero rows. The empty state must
// not take the Live/Fixture badge down with it — that badge is what tells the reader the
// blank card is a live source with no data yet, rather than a broken one.
test("keeps the google_ads badge when the live source has no rows yet", async () => {
  vi.stubGlobal("fetch", vi.fn((url: string) => {
    if (url.startsWith("/config/modes"))
      return Promise.resolve(ok({
        sources: { meta: "live", google_reviews: "live", google_ads: "live", zoho: "live", google_places: "live" },
        ai: { llm: "fake", image: "fake", canva: "fake" },
      }));
    if (url.startsWith("/research/internet-trends"))
      return Promise.resolve(ok({ keywords: [], titles: ["unused"], prefill_prompt: "" }));
    if (url.startsWith("/data/keyword-volumes")) return Promise.resolve(ok({ items: [], count: 0 }));
    return Promise.reject(new Error(`unexpected ${url}`));
  }));
  render(<ModesProvider><TrendsTab onGenerate={() => {}} /></ModesProvider>);
  expect(await screen.findByText(/No keyword data yet/)).toBeInTheDocument();
  expect(await screen.findByText("Live")).toBeInTheDocument();
});
