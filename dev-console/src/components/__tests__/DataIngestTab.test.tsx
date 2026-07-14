import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, expect, test, vi } from "vitest";
import { DataIngestTab } from "../DataIngestTab";

afterEach(() => vi.restoreAllMocks());

test("Load fetches the selected resource and renders JSON", async () => {
  const f = vi.fn().mockResolvedValue({ ok: true, status: 200, statusText: "OK",
    json: async () => ({ items: [{ id: 1 }], count: 1 }) });
  vi.stubGlobal("fetch", f);
  render(<DataIngestTab />);
  await userEvent.click(screen.getByRole("button", { name: "Load" }));
  expect(f).toHaveBeenCalledWith("/data/own-posts?limit=50&offset=0", expect.anything());
  expect(await screen.findByText(/"count": 1/)).toBeInTheDocument();
});
