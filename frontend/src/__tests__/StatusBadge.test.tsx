import { render, screen } from "@testing-library/react";
import { afterEach, expect, test, vi } from "vitest";
import { StatusBadge } from "../components/StatusBadge";
import { ModesProvider } from "../modes";

afterEach(() => vi.restoreAllMocks());

const MODES = {
  sources: { meta: "fixture", google_reviews: "fixture", google_ads: "live", zoho: "live" },
  ai: { llm: "fake", image: "fake", canva: "fake" },
};

const ok = (body: unknown) => ({ ok: true, status: 200, statusText: "OK", json: async () => body });

test("renders data and AI badges from /config/modes", async () => {
  vi.stubGlobal("fetch", vi.fn(() => Promise.resolve(ok(MODES))));
  render(
    <ModesProvider>
      <StatusBadge kind="data" source="google_ads" />
      <StatusBadge kind="data" source="meta" />
      <StatusBadge kind="ai" />
    </ModesProvider>,
  );
  expect(await screen.findByText("Live")).toBeInTheDocument();
  expect(screen.getByText("Fixture")).toBeInTheDocument();
  expect(screen.getByText("Sample AI")).toBeInTheDocument();
});

test("renders nothing when the modes fetch fails", async () => {
  vi.stubGlobal("fetch", vi.fn(() => Promise.reject(new Error("down"))));
  const { container } = render(
    <ModesProvider><StatusBadge kind="data" source="meta" /></ModesProvider>,
  );
  // give the rejected fetch a tick to settle
  await new Promise((r) => setTimeout(r, 0));
  expect(container.querySelector(".stat-badge")).toBeNull();
});
