import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, expect, test, vi } from "vitest";
import { CompetitorTab } from "../views/research/CompetitorTab";

afterEach(() => vi.restoreAllMocks());
const ok = (body: unknown) => ({ ok: true, status: 200, statusText: "OK", json: async () => body });

test("pills select competitor; activity stats and posts filter; aggregate AI analysis shows", async () => {
  vi.stubGlobal("fetch", vi.fn((url: string) => {
    if (url.startsWith("/config/competitors"))
      return Promise.resolve(ok({ items: [
        { id: 1, platform: "facebook", name: "BigBox", external_id: "", enabled: true,
          created_at: "", updated_at: "" },
        { id: 2, platform: "instagram", name: "StorePlus", external_id: "storeplus_sg", enabled: true,
          created_at: "", updated_at: "" },
        { id: 3, platform: "facebook", name: "Disabled Co", external_id: "", enabled: false,
          created_at: "", updated_at: "" },
      ], count: 3 }));
    if (url.startsWith("/research/competitor"))
      return Promise.resolve(ok({ insights: { activity_summary: "Competitors push promos.",
        weaknesses: ["No pricing shown"], gaps: ["No B2B content"] },
        titles: ["Beat them on price"], prefill_prompt: "Competitor context" }));
    if (url.startsWith("/data/competitor-posts"))
      return Promise.resolve(ok({ items: [
        { id: 1, source_id: "a", competitor: "BigBox", platform: "facebook",
          text: "BigBox promo post", window_date: "2026-07-08T00:00:00Z" },
        // Attributed by platform username (= the config row's external_id), not the display name.
        { id: 2, source_id: "b", competitor: "storeplus_sg", platform: "instagram",
          text: "StorePlus post", window_date: "2026-07-07T00:00:00Z" },
      ], count: 2 }));
    return Promise.reject(new Error(`unexpected ${url}`));
  }));
  const onGenerate = vi.fn();
  render(<CompetitorTab onGenerate={onGenerate} />);

  expect(await screen.findByText("Competitors push promos.")).toBeInTheDocument();
  expect(screen.queryByText("Disabled Co")).toBeNull();               // disabled pill hidden
  expect(await screen.findByText("BigBox promo post")).toBeInTheDocument();
  expect(screen.queryByText("StorePlus post")).toBeNull();            // filtered to selection

  await userEvent.click(screen.getByRole("button", { name: "StorePlus" }));
  expect(await screen.findByText("StorePlus post")).toBeInTheDocument(); // alias-joined via external_id
  expect(screen.queryByText("BigBox promo post")).toBeNull();
  expect(screen.getAllByText("50%").length).toBe(2);                  // 1 post each after alias join → equal share

  await userEvent.click(screen.getByRole("button", { name: /generate/i }));
  expect(onGenerate).toHaveBeenCalledWith("Beat them on price", "Competitor context");
});

test("shows empty state when no competitors", async () => {
  vi.stubGlobal("fetch", vi.fn((url: string) => {
    if (url.startsWith("/config/competitors"))
      return Promise.resolve(ok({ items: [], count: 0 }));
    if (url.startsWith("/research/competitor"))
      return Promise.resolve(ok({ insights: { activity_summary: "Competitors push promos.",
        weaknesses: [], gaps: [] }, titles: [], prefill_prompt: "Competitor context" }));
    if (url.startsWith("/data/competitor-posts"))
      return Promise.resolve(ok({ items: [], count: 0 }));
    return Promise.reject(new Error(`unexpected ${url}`));
  }));
  render(<CompetitorTab onGenerate={vi.fn()} />);
  expect(await screen.findByText(/No competitors tracked yet/)).toBeInTheDocument();
});
