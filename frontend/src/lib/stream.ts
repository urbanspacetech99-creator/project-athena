import type { StreamProgress } from "../types";

interface StreamEvent {
  event: "progress" | "result" | "error";
  step?: number; total?: number; label?: string;
  data?: unknown; detail?: string;
}

/** Consume an NDJSON streaming endpoint: forwards progress events to `onProgress`,
 *  resolves with the terminal result event's data, rejects on error events,
 *  transport failure, or a stream that ends without a result. */
export async function streamNdjson<T>(url: string, init: RequestInit,
                                      onProgress: (p: StreamProgress) => void): Promise<T> {
  const res = await fetch(url, init);
  if (!res.ok || !res.body) throw new Error(`${res.status} ${res.statusText}`);
  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  let result: T | undefined;
  let gotResult = false;
  const handle = (line: string) => {
    if (!line.trim()) return;
    const ev = JSON.parse(line) as StreamEvent;
    if (ev.event === "error") throw new Error(ev.detail || "stream failed");
    if (ev.event === "result") { result = ev.data as T; gotResult = true; }
    if (ev.event === "progress")
      onProgress({ step: ev.step ?? 0, total: ev.total ?? 1, label: ev.label ?? "" });
  };
  try {
    for (;;) {
      const chunk = await reader.read();
      if (chunk.done) break;
      buffer += decoder.decode(chunk.value, { stream: true });
      const lines = buffer.split("\n");
      buffer = lines.pop() ?? "";
      for (const line of lines) handle(line);
    }
    handle(buffer);
  } catch (e) {
    await reader.cancel(e).catch(() => {});
    throw e;
  } finally {
    reader.releaseLock();
  }
  if (!gotResult) throw new Error("stream ended without a result");
  return result as T;
}
