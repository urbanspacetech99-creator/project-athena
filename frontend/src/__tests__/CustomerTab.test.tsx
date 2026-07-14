import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, expect, test, vi } from "vitest";
import { CustomerTab } from "../views/research/CustomerTab";

afterEach(() => vi.restoreAllMocks());
const ok = (body: unknown) => ({ ok: true, status: 200, statusText: "OK", json: async () => body });

test("renders questions, ranked services, chat count, summary, and handoff", async () => {
  vi.stubGlobal("fetch", vi.fn((url: string) => {
    if (url.startsWith("/research/customer-questions"))
      return Promise.resolve(ok({ questions: ["How much per month?", "Any CCTV?"] }));
    if (url.startsWith("/research/customer-insights"))
      return Promise.resolve(ok({
        insights: { top_services: ["Self storage units", "Fulfilment"], top_features: ["24/7 access"],
          top_promotions: ["3 months free"], summary: "Price transparency dominates." },
        titles: ["All-in pricing"], prefill_prompt: "Chat context",
      }));
    if (url.startsWith("/data/zoho-chats"))
      return Promise.resolve(ok({ items: [], count: 143 }));
    return Promise.reject(new Error(`unexpected ${url}`));
  }));
  const onGenerate = vi.fn();
  render(<CustomerTab onGenerate={onGenerate} />);
  expect(await screen.findByText("How much per month?")).toBeInTheDocument();
  expect(await screen.findByText(/Self storage units/)).toBeInTheDocument();
  expect(await screen.findByText(/143 customer chats/)).toBeInTheDocument();
  expect(await screen.findByText("Price transparency dominates.")).toBeInTheDocument();
  await userEvent.click(screen.getByRole("button", { name: /generate/i }));
  expect(onGenerate).toHaveBeenCalledWith("All-in pricing", "Chat context");
});

test("hides feature/promotion rows when empty and gates lower block on insights", async () => {
  vi.stubGlobal("fetch", vi.fn((url: string) => {
    if (url.startsWith("/research/customer-questions"))
      return Promise.resolve(ok({ questions: ["Any CCTV?"] }));
    if (url.startsWith("/research/customer-insights"))
      return Promise.resolve(ok({
        insights: { top_services: ["Self storage units"], top_features: [],
          top_promotions: [], summary: "Price transparency dominates." },
        titles: ["All-in pricing"], prefill_prompt: "Chat context",
      }));
    if (url.startsWith("/data/zoho-chats"))
      return Promise.resolve(ok({ items: [], count: 12 }));
    return Promise.reject(new Error(`unexpected ${url}`));
  }));
  render(<CustomerTab onGenerate={vi.fn()} />);
  expect(await screen.findByText("Price transparency dominates.")).toBeInTheDocument();
  expect(screen.queryByText("Most-requested features")).toBeNull();
  expect(screen.queryByText("Promotions customers ask about")).toBeNull();
});
