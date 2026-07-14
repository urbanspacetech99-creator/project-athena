import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, expect, test, vi } from "vitest";
import { ToastProvider } from "../toast";
import { SettingsView } from "../views/SettingsView";

afterEach(() => vi.restoreAllMocks());
const ok = (body: unknown) => ({ ok: true, status: 200, statusText: "OK", json: async () => body });

function stubFetch() {
  const calls: Array<{ url: string; init?: RequestInit }> = [];
  vi.stubGlobal("fetch", vi.fn((url: string, init?: RequestInit) => {
    calls.push({ url, init });
    if (url.startsWith("/config/competitors") && init?.method === "POST")
      return Promise.resolve(ok({ id: 9, platform: "facebook", name: "NewCo", external_id: "",
        enabled: true, created_at: "", updated_at: "" }));
    if (url.startsWith("/config/competitors"))
      return Promise.resolve(ok({ items: [{ id: 1, platform: "facebook", name: "BigBox",
        external_id: "bb1", enabled: true, created_at: "", updated_at: "" }], count: 1 }));
    if (url.startsWith("/config/keywords"))
      return Promise.resolve(ok({ items: [{ id: 1, keyword: "self storage", enabled: true,
        created_at: "" }], count: 1 }));
    if (url.startsWith("/config/agents/") && init?.method === "PATCH")
      return Promise.resolve(ok({ id: 1, key: "research", name: "Research Agent",
        system_prompt: "New prompt.", skill_keys: [], updated_at: "" }));
    if (url.startsWith("/config/agents"))
      return Promise.resolve(ok({ items: [{ id: 1, key: "research", name: "Research Agent",
        system_prompt: "You are a researcher.", skill_keys: ["brand-voice"], updated_at: "" }], count: 1 }));
    if (url.startsWith("/config/skills/") && init?.method === "DELETE")
      return Promise.resolve(ok({ deleted: "brand-voice", detached_from: ["research"] }));
    if (url.startsWith("/config/skills"))
      return Promise.resolve(ok({ items: [{ id: 1, key: "brand-voice", name: "Brand Voice",
        content: "Warm, direct.", updated_at: "" }], count: 1 }));
    return Promise.reject(new Error(`unexpected ${url}`));
  }));
  return calls;
}

test("renders all four config sections with data", async () => {
  stubFetch();
  render(<ToastProvider><SettingsView /></ToastProvider>);
  expect(await screen.findByText("BigBox")).toBeInTheDocument();
  expect(await screen.findByText("self storage")).toBeInTheDocument();
  expect(await screen.findByText("Research Agent")).toBeInTheDocument();
  expect(await screen.findByText("Brand Voice")).toBeInTheDocument();
});

test("adds a competitor", async () => {
  const calls = stubFetch();
  render(<ToastProvider><SettingsView /></ToastProvider>);
  const section = (await screen.findByText("Competitors")).closest(".card")!;
  await userEvent.type(within(section as HTMLElement).getByPlaceholderText(/name/i), "NewCo");
  await userEvent.click(within(section as HTMLElement).getByRole("button", { name: /add/i }));
  const post = calls.find((c) => c.url === "/config/competitors" && c.init?.method === "POST");
  expect(post).toBeDefined();
  expect(JSON.parse(post!.init!.body as string).name).toBe("NewCo");
});

test("edits an agent and saves prompt + skills", async () => {
  const calls = stubFetch();
  render(<ToastProvider><SettingsView /></ToastProvider>);
  const section = (await screen.findByText("Research Agent")).closest(".card") as HTMLElement;
  await userEvent.click(within(section).getByRole("button", { name: /edit/i }));
  const ta = within(section).getByLabelText("Agent system prompt");
  await userEvent.clear(ta);
  await userEvent.type(ta, "New prompt.");
  await userEvent.click(within(section).getByRole("button", { name: "Brand Voice" })); // starts attached — toggles OFF
  await userEvent.click(within(section).getByRole("button", { name: /^save$/i }));
  const patch = calls.find((c) => c.url === "/config/agents/research" && c.init?.method === "PATCH");
  expect(patch).toBeDefined();
  const body = JSON.parse(patch!.init!.body as string);
  expect(body.system_prompt).toBe("New prompt.");
  expect(body.skill_keys).toEqual([]);
  await waitFor(() => expect(screen.queryByText(/System prompt — Research Agent/)).toBeNull());
});

test("skill delete surfaces detached agents in one toast", async () => {
  stubFetch();
  render(<ToastProvider><SettingsView /></ToastProvider>);
  const section = (await screen.findByText("Brand Voice")).closest(".card") as HTMLElement;
  await userEvent.click(within(section).getByRole("button", { name: /delete/i }));
  expect(await screen.findByText(/Skill deleted — detached from: research/)).toBeInTheDocument();
});
