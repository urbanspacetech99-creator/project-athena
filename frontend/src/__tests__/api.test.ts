import { afterEach, expect, test, vi } from "vitest";
import { api, ApiError, DATA_LIMIT } from "../api";

afterEach(() => vi.restoreAllMocks());

function okJson(body: unknown) {
  return { ok: true, status: 200, statusText: "OK", json: async () => body };
}

test("data endpoints read the count then fetch the tail window", async () => {
  const f = vi.fn()
    .mockResolvedValueOnce(okJson({ items: [], count: 1200 }))
    .mockResolvedValueOnce(okJson({ items: [], count: 1200 }));
  vi.stubGlobal("fetch", f);
  await api.ownPosts();
  expect(f.mock.calls[0][0]).toBe("/data/own-posts?limit=1&offset=0");
  expect(f.mock.calls[1][0]).toBe(`/data/own-posts?limit=${DATA_LIMIT}&offset=700`);
});

test("tail fetch clamps offset to 0 for small tables", async () => {
  const f = vi.fn()
    .mockResolvedValueOnce(okJson({ items: [], count: 10 }))
    .mockResolvedValueOnce(okJson({ items: [], count: 10 }));
  vi.stubGlobal("fetch", f);
  await api.ownPosts();
  expect(f.mock.calls[1][0]).toBe(`/data/own-posts?limit=${DATA_LIMIT}&offset=0`);
});

test("generatePost POSTs the body", async () => {
  const f = vi.fn().mockResolvedValue(okJson({ options: [] }));
  vi.stubGlobal("fetch", f);
  await api.generatePost({
    platform: "instagram", tone: "friendly", length: "short", prefill_prompt: "hi",
    visual_style: "clean_product", include_hashtags: true, include_cta: true,
    include_emoji: false, include_pricing: false, options: 3,
  });
  const [url, init] = f.mock.calls[0];
  expect(url).toBe("/generate/post");
  expect(init.method).toBe("POST");
  expect(JSON.parse(init.body).prefill_prompt).toBe("hi");
});

test("non-ok responses throw ApiError with status", async () => {
  vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: false, status: 500, statusText: "boom" }));
  await expect(api.weeklyKpi()).rejects.toBeInstanceOf(ApiError);
});

test("204 responses resolve to undefined", async () => {
  vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: true, status: 204, statusText: "No Content" }));
  await expect(api.deleteDraft(1)).resolves.toBeUndefined();
});

test("ApiError message prefers FastAPI's detail", async () => {
  vi.stubGlobal("fetch", vi.fn().mockResolvedValue({
    ok: false, status: 409, statusText: "Conflict",
    json: async () => ({ detail: "keyword already tracked" }),
  }));
  await expect(api.createKeyword("massage")).rejects.toThrow("keyword already tracked");
});
