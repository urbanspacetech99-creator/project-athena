import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, expect, test, vi } from "vitest";
import { SettingsTab } from "../SettingsTab";

afterEach(() => vi.restoreAllMocks());

function res(body: unknown) {
  return { ok: true, status: 200, statusText: "OK", json: async () => body };
}

test("loads and renders competitors, keywords, agents and skills", async () => {
  const f = vi.fn()
    .mockResolvedValueOnce(res({ items: [{ id: 1, platform: "instagram", name: "StorHub",
      external_id: "storhub_sg", enabled: true, created_at: "", updated_at: "" }], count: 1 }))
    .mockResolvedValueOnce(res({ items: [{ id: 1, keyword: "self storage singapore",
      enabled: true, created_at: "" }], count: 1 }))
    .mockResolvedValueOnce(res({ items: [{ id: 1, key: "caption_writer", name: "Caption writer",
      system_prompt: "Write captions", skill_keys: [], updated_at: "" }], count: 1 }))
    .mockResolvedValueOnce(res({ items: [{ id: 1, key: "tone-of-voice", name: "Tone of voice",
      content: "Friendly and concise.", updated_at: "" }], count: 1 }));
  vi.stubGlobal("fetch", f);

  render(<SettingsTab />);

  expect(await screen.findByText("StorHub")).toBeInTheDocument();
  expect(screen.getByText("self storage singapore")).toBeInTheDocument();
  expect(screen.getByDisplayValue("Write captions")).toBeInTheDocument();
  const skillsCard = screen.getByRole("heading", { name: "Skills" }).closest("section") as HTMLElement;
  expect(within(skillsCard).getByText("Tone of voice")).toBeInTheDocument();
});

test("adding a keyword calls createKeyword and reloads the list", async () => {
  const f = vi.fn()
    .mockResolvedValueOnce(res({ items: [], count: 0 }))   // initial listCompetitors
    .mockResolvedValueOnce(res({ items: [], count: 0 }))   // initial listKeywords
    .mockResolvedValueOnce(res({ items: [], count: 0 }))   // initial listAgents
    .mockResolvedValueOnce(res({ items: [], count: 0 }))   // initial listSkills
    .mockResolvedValueOnce(res({ id: 5, keyword: "new keyword", enabled: true, created_at: "" }))
    .mockResolvedValueOnce(res({ items: [], count: 0 }))   // reload listCompetitors
    .mockResolvedValueOnce(res({ items: [{ id: 5, keyword: "new keyword", enabled: true,
      created_at: "" }], count: 1 }))                       // reload listKeywords
    .mockResolvedValueOnce(res({ items: [], count: 0 }))   // reload listAgents
    .mockResolvedValueOnce(res({ items: [], count: 0 }));  // reload listSkills
  vi.stubGlobal("fetch", f);

  render(<SettingsTab />);
  await screen.findByText("No keywords tracked yet.");

  const keywordsCard = screen.getByText("Tracked keywords").closest("section") as HTMLElement;
  await userEvent.type(within(keywordsCard).getByPlaceholderText("Keyword"), "new keyword");
  await userEvent.click(within(keywordsCard).getByRole("button", { name: "Add" }));

  expect(await screen.findByText("new keyword")).toBeInTheDocument();
  const postCall = f.mock.calls.find((c) => (c[1] as RequestInit)?.method === "POST");
  expect(postCall?.[0]).toBe("/config/keywords");
  expect(JSON.parse((postCall?.[1] as RequestInit).body as string)).toEqual({ keyword: "new keyword" });
});

test("unsaved agent prompt edits survive a sibling mutation reload", async () => {
  const agent = { id: 1, key: "caption_writer", name: "Caption writer",
    system_prompt: "P", skill_keys: [], updated_at: "" };
  const f = vi.fn()
    .mockResolvedValueOnce(res({ items: [], count: 0 }))       // initial listCompetitors
    .mockResolvedValueOnce(res({ items: [], count: 0 }))       // initial listKeywords
    .mockResolvedValueOnce(res({ items: [agent], count: 1 }))  // initial listAgents
    .mockResolvedValueOnce(res({ items: [], count: 0 }))       // initial listSkills
    .mockResolvedValueOnce(res({ id: 9, keyword: "kw", enabled: true, created_at: "" }))
    .mockResolvedValueOnce(res({ items: [], count: 0 }))       // reload listCompetitors
    .mockResolvedValueOnce(res({ items: [{ id: 9, keyword: "kw", enabled: true,
      created_at: "" }], count: 1 }))                           // reload listKeywords
    .mockResolvedValueOnce(res({ items: [agent], count: 1 }))  // reload listAgents
    .mockResolvedValueOnce(res({ items: [], count: 0 }));      // reload listSkills
  vi.stubGlobal("fetch", f);

  render(<SettingsTab />);
  const prompt = await screen.findByDisplayValue("P");
  await userEvent.type(prompt, " edited");

  const keywordsCard = screen.getByText("Tracked keywords").closest("section") as HTMLElement;
  await userEvent.type(within(keywordsCard).getByPlaceholderText("Keyword"), "kw");
  await userEvent.click(within(keywordsCard).getByRole("button", { name: "Add" }));

  await screen.findByText("kw");  // reload has landed
  expect(screen.getByDisplayValue("P edited")).toBeInTheDocument();
});
