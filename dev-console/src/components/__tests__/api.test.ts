import { afterEach, expect, test, vi } from "vitest";
import { api, ApiError } from "../../api";

function mockFetch(status: number, body: unknown) {
  return vi.fn().mockResolvedValue({
    ok: status >= 200 && status < 300, status, statusText: "OK",
    json: async () => body,
  });
}

afterEach(() => vi.restoreAllMocks());

test("listData builds the query URL", async () => {
  const f = mockFetch(200, { items: [], count: 0 });
  vi.stubGlobal("fetch", f);
  await api.listData("own-posts", 10, 5);
  expect(f).toHaveBeenCalledWith("/data/own-posts?limit=10&offset=5", expect.anything());
});

test("ingest issues a POST", async () => {
  const f = mockFetch(200, { source: "meta", inserted: 0, updated: 0, total: 0 });
  vi.stubGlobal("fetch", f);
  await api.ingest("meta");
  expect(f).toHaveBeenCalledWith("/ingest/meta", expect.objectContaining({ method: "POST" }));
});

test("generatePost sends a JSON body", async () => {
  const f = mockFetch(200, { options: [] });
  vi.stubGlobal("fetch", f);
  await api.generatePost({ platform: "instagram", tone: "friendly", length: "short",
    prefill_prompt: "x", visual_style: "clean_product", include_hashtags: true,
    include_cta: true, include_emoji: false, include_pricing: false, options: 3 });
  const [, init] = f.mock.calls[0];
  expect(init.method).toBe("POST");
  expect(JSON.parse(init.body).platform).toBe("instagram");
});

test("updateDraft issues a PATCH with a JSON body", async () => {
  const f = mockFetch(200, { id: 1, platform: "instagram", caption: "new", image_b64: "",
    canva_edit_url: "", created_at: "" });
  vi.stubGlobal("fetch", f);
  await api.updateDraft(1, { caption: "new" });
  const [url, init] = f.mock.calls[0];
  expect(url).toBe("/generate/drafts/1");
  expect(init.method).toBe("PATCH");
  expect(JSON.parse(init.body).caption).toBe("new");
});

test("deleteDraft tolerates 204 with no body", async () => {
  const f = vi.fn().mockResolvedValue({ ok: true, status: 204, statusText: "No Content" });
  vi.stubGlobal("fetch", f);
  await expect(api.deleteDraft(1)).resolves.toBeUndefined();
});

test("non-2xx throws ApiError", async () => {
  vi.stubGlobal("fetch", mockFetch(404, {}));
  await expect(api.listData("own-posts")).rejects.toBeInstanceOf(ApiError);
});
