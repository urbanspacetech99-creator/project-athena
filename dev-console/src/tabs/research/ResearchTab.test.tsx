import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, expect, test, vi } from "vitest";
import { ResearchTab } from "./ResearchTab";

afterEach(() => vi.restoreAllMocks());

test("Internet Trends result exposes Send-to-Generate with the prefill prompt", async () => {
  vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: true, status: 200, statusText: "OK",
    json: async () => ({ keywords: [], titles: ["A", "B"], prefill_prompt: "make a post" }) }));
  const onSend = vi.fn();
  render(<ResearchTab onSendToGenerate={onSend} />);
  await userEvent.click(screen.getByRole("button", { name: "Internet Trends" }));
  const sendButtons = await screen.findAllByRole("button", { name: "Send to Generate" });
  expect(sendButtons).toHaveLength(2);
  await userEvent.click(sendButtons[0]);
  expect(onSend).toHaveBeenCalledWith("make a post");
});
