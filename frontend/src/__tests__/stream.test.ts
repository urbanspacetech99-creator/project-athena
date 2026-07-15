import { afterEach, expect, test, vi } from "vitest";
import { streamNdjson } from "../lib/stream";
import type { StreamProgress } from "../types";

afterEach(() => vi.restoreAllMocks());

const ndjsonBody = (lines: unknown[]) =>
  new ReadableStream<Uint8Array>({
    start(controller) {
      const enc = new TextEncoder();
      for (const l of lines) controller.enqueue(enc.encode(JSON.stringify(l) + "\n"));
      controller.close();
    },
  });

const stubStream = (lines: unknown[], ok = true) =>
  vi.stubGlobal("fetch", vi.fn(() => Promise.resolve(
    { ok, status: ok ? 200 : 500, statusText: ok ? "OK" : "ERR", body: ndjsonBody(lines) })));

test("reports progress events then resolves with the result data", async () => {
  stubStream([
    { event: "progress", step: 0, total: 2, label: "Starting…" },
    { event: "progress", step: 1, total: 2, label: "half" },
    { event: "result", data: { x: 1 } },
  ]);
  const seen: StreamProgress[] = [];
  const out = await streamNdjson<{ x: number }>("/p", {}, (p) => seen.push(p));
  expect(out).toEqual({ x: 1 });
  expect(seen.map((s) => s.step)).toEqual([0, 1]);
  expect(seen[1].label).toBe("half");
});

test("an error event rejects with its detail", async () => {
  stubStream([{ event: "progress", step: 0, total: 2, label: "Starting…" },
              { event: "error", detail: "llm exploded" }]);
  await expect(streamNdjson("/p", {}, () => {})).rejects.toThrow("llm exploded");
});

test("a stream that ends without a result rejects", async () => {
  stubStream([{ event: "progress", step: 0, total: 2, label: "Starting…" }]);
  await expect(streamNdjson("/p", {}, () => {})).rejects.toThrow(/without a result/);
});

test("a non-ok response rejects", async () => {
  stubStream([], false);
  await expect(streamNdjson("/p", {}, () => {})).rejects.toThrow("500 ERR");
});

test("reassembles a line split across chunks and multiple lines in one chunk", async () => {
  const enc = new TextEncoder();
  vi.stubGlobal("fetch", vi.fn(() => Promise.resolve({
    ok: true, status: 200, statusText: "OK",
    body: new ReadableStream<Uint8Array>({
      start(controller) {
        controller.enqueue(enc.encode('{"event":"progress","step":0,"total":3,"la'));
        controller.enqueue(enc.encode('bel":"Starting…"}\n'));
        controller.enqueue(enc.encode(
          '{"event":"progress","step":1,"total":3,"label":"one"}\n{"event":"result","data":{"ok":true}}\n'));
        controller.close();
      },
    }),
  })));
  const seen: StreamProgress[] = [];
  const out = await streamNdjson<{ ok: boolean }>("/p", {}, (p) => seen.push(p));
  expect(out).toEqual({ ok: true });
  expect(seen.map((s) => s.label)).toEqual(["Starting…", "one"]);
});
