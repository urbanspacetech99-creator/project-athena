import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, expect, test, vi } from "vitest";
import { HomeTab } from "../HomeTab";

afterEach(() => vi.restoreAllMocks());

test("loads KPIs then engagement and renders both", async () => {
  const f = vi.fn()
    .mockResolvedValueOnce({ ok: true, status: 200, statusText: "OK",
      json: async () => ({ posts: 2, views: 100, likes: 9, interactions: 20 }) })
    .mockResolvedValueOnce({ ok: true, status: 200, statusText: "OK",
      json: async () => ({ top_post: null, insights: { summary: "s", themes: [],
        sentiment: "neutral", recurring_feedback: [] } }) });
  vi.stubGlobal("fetch", f);
  render(<HomeTab />);
  await userEvent.click(screen.getByRole("button", { name: "Load KPIs + engagement" }));
  expect(await screen.findByText("100")).toBeInTheDocument();
  expect(await screen.findByText(/No top post/)).toBeInTheDocument();
});
