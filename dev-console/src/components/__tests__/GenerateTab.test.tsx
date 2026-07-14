import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, expect, test, vi } from "vitest";
import { GenerateTab } from "../GenerateTab";

afterEach(() => vi.restoreAllMocks());

function res(body: unknown) {
  return { ok: true, status: 200, statusText: "OK", json: async () => body };
}

test("generates options and renders an image + Save draft", async () => {
  const f = vi.fn()
    .mockResolvedValueOnce(res({ items: [], count: 0 }))          // initial listDrafts
    .mockResolvedValueOnce(res({ options: [{ caption: "Hello", hashtags: ["selfstorage"],
      image_b64: "QUJD", mime_type: "image/png", canva_edit_url: "https://www.canva.com/design/X/edit",
      visual_style: "clean_product" }] }));                        // generatePost
  vi.stubGlobal("fetch", f);
  render(<GenerateTab prefill="promote units" />);
  await userEvent.click(screen.getByRole("button", { name: "Generate 3 options" }));
  expect(await screen.findByText("Hello")).toBeInTheDocument();
  expect(screen.getByRole("img", { name: "option 1" })).toHaveAttribute(
    "src", "data:image/png;base64,QUJD");
  expect(screen.getByRole("button", { name: "Save draft" })).toBeInTheDocument();
});

test("edits a saved draft's caption via updateDraft (PATCH)", async () => {
  const f = vi.fn()
    .mockResolvedValueOnce(res({ items: [{ id: 7, platform: "instagram", caption: "old",
      image_b64: "", canva_edit_url: "", created_at: "" }], count: 1 }))   // initial listDrafts
    .mockResolvedValueOnce(res({ id: 7, platform: "instagram", caption: "new",
      image_b64: "", canva_edit_url: "", created_at: "" }))                // updateDraft PATCH
    .mockResolvedValueOnce(res({ items: [{ id: 7, platform: "instagram", caption: "new",
      image_b64: "", canva_edit_url: "", created_at: "" }], count: 1 }));  // reload
  vi.stubGlobal("fetch", f);
  render(<GenerateTab prefill="" />);
  await userEvent.click(await screen.findByRole("button", { name: "Edit" }));
  const input = screen.getByDisplayValue("old");
  await userEvent.clear(input);
  await userEvent.type(input, "new");
  await userEvent.click(screen.getByRole("button", { name: "Save" }));
  const patchCall = f.mock.calls.find((c) => (c[1] as RequestInit)?.method === "PATCH");
  expect(patchCall?.[0]).toBe("/generate/drafts/7");
  expect(JSON.parse((patchCall?.[1] as RequestInit).body as string).caption).toBe("new");
});
