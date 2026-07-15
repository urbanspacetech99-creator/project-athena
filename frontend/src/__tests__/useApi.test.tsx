import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { expect, test, vi } from "vitest";
import { AsyncSection } from "../components/AsyncSection";
import { useApi, useCachedApi } from "../hooks/useApi";
import { cacheGet, cacheSet } from "../lib/cache";

function Probe({ fn }: { fn: () => Promise<string> }) {
  const q = useApi(fn);
  return <AsyncSection q={q}>{(d) => <div>value: {d}</div>}</AsyncSection>;
}

test("renders data on success", async () => {
  render(<Probe fn={() => Promise.resolve("hello")} />);
  expect(await screen.findByText("value: hello")).toBeInTheDocument();
});

test("renders error with a retry button that refetches", async () => {
  let calls = 0;
  const fn = () => (++calls === 1 ? Promise.reject(new Error("boom")) : Promise.resolve("ok"));
  render(<Probe fn={fn} />);
  expect(await screen.findByText(/boom/)).toBeInTheDocument();
  await userEvent.click(screen.getByRole("button", { name: /retry/i }));
  expect(await screen.findByText("value: ok")).toBeInTheDocument();
});

function CachedProbe({ k, fn }: { k: string; fn: () => Promise<unknown> }) {
  const q = useCachedApi(k, fn);
  return (
    <div>
      {q.loading ? "loading" : q.error !== undefined ? `error:${q.error}` : `data:${JSON.stringify(q.data)}`}
      <button onClick={q.reload}>reload</button>
    </div>
  );
}

test("useCachedApi: fresh cache serves without calling fn", async () => {
  cacheSet("k1", { n: 1 });
  const fn = vi.fn(() => Promise.resolve({ n: 2 }));
  render(<CachedProbe k="k1" fn={fn} />);
  expect(await screen.findByText('data:{"n":1}')).toBeInTheDocument();
  expect(fn).not.toHaveBeenCalled();
});

test("useCachedApi: miss fetches and stores", async () => {
  const fn = vi.fn(() => Promise.resolve({ n: 2 }));
  render(<CachedProbe k="k2" fn={fn} />);
  expect(await screen.findByText('data:{"n":2}')).toBeInTheDocument();
  expect(cacheGet("k2")).toEqual({ n: 2 });
});

test("useCachedApi: reload bypasses and rewrites the cache", async () => {
  cacheSet("k3", { n: 1 });
  const fn = vi.fn(() => Promise.resolve({ n: 9 }));
  render(<CachedProbe k="k3" fn={fn} />);
  await screen.findByText('data:{"n":1}');
  await userEvent.click(screen.getByRole("button", { name: "reload" }));
  expect(await screen.findByText('data:{"n":9}')).toBeInTheDocument();
  expect(fn).toHaveBeenCalledTimes(1);
  expect(cacheGet("k3")).toEqual({ n: 9 });
});
