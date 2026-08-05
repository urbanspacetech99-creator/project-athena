import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, expect, test, vi } from "vitest";
import { cacheGet, cacheSet } from "../../lib/cache";
import { CACHE_KEYS } from "../../lib/cacheKeys";
import { ToastProvider } from "../../providers/ToastProvider";
import { ResearchView } from "./ResearchView";

// setupTests.ts already clears localStorage after each test.
afterEach(() => vi.restoreAllMocks());

/** Every tab card's accessible name is its title AND its description, so match on a prefix. */
const tab = (label: string) => screen.getByRole("button", { name: new RegExp(`^${label}`) });

const renderView = () => {
  vi.stubGlobal("fetch", vi.fn(() => new Promise(() => {}))); // tabs stay loading — fine
  render(<ToastProvider><ResearchView onGenerate={() => {}} /></ToastProvider>);
};

test("shows all four topics with Internet Trends active by default", () => {
  renderView();
  for (const label of ["Internet Trends", "Customer Chats", "Social Media", "Competitor Analysis"])
    expect(tab(label)).toBeInTheDocument();
  expect(tab("Internet Trends").className).toContain("on");
  for (const label of ["Customer Chats", "Social Media", "Competitor Analysis"])
    expect(tab(label).className).not.toContain("on");
});

test("picking a topic mounts that tab and unmounts the previous one", async () => {
  renderView();

  await userEvent.click(tab("Social Media"));
  expect(tab("Social Media").className).toContain("on");
  expect(tab("Internet Trends").className).not.toContain("on");
  expect(screen.getByText("Engagement")).toBeInTheDocument();       // SocialTab's own heading

  await userEvent.click(tab("Customer Chats"));
  expect(screen.getByText("About this data")).toBeInTheDocument();  // CustomerTab's banner
  expect(screen.queryByText("Engagement")).toBeNull();              // SocialTab is gone, not hidden
});

test("Refresh clears only the active topic's cached AI response", async () => {
  renderView();
  // Real response shapes: a cache hit is fed straight to the tab, which renders it.
  const trends = { keywords: [], titles: [], prefill_prompt: "" };
  const social = { views: 0, insights: { comment_topics: [], review_summary: "" }, titles: [], prefill_prompt: "" };
  const customer = { insights: { top_services: [], top_features: [], top_promotions: [], summary: "" }, titles: [], prefill_prompt: "" };
  cacheSet(CACHE_KEYS.internetTrends, trends);
  cacheSet(CACHE_KEYS.socialReviews, social);
  cacheSet(CACHE_KEYS.customerInsights, customer);

  // Internet Trends is active on mount, so only its key is busted.
  await userEvent.click(screen.getByRole("button", { name: /refresh/i }));
  expect(cacheGet(CACHE_KEYS.internetTrends)).toBeUndefined();
  expect(cacheGet(CACHE_KEYS.socialReviews)).toEqual(social);
  expect(cacheGet(CACHE_KEYS.customerInsights)).toEqual(customer);

  // Refresh follows the active tab rather than clearing everything.
  await userEvent.click(tab("Social Media"));
  await userEvent.click(screen.getByRole("button", { name: /refresh/i }));
  expect(cacheGet(CACHE_KEYS.socialReviews)).toBeUndefined();
  expect(cacheGet(CACHE_KEYS.customerInsights)).toEqual(customer);
});
