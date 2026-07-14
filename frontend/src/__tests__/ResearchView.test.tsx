import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, expect, test, vi } from "vitest";
import { ToastProvider } from "../toast";
import { ResearchView } from "../views/research/ResearchView";

afterEach(() => vi.restoreAllMocks());

test("selector toggles topics, enforces at least one, and opens tabs", async () => {
  vi.stubGlobal("fetch", vi.fn(() => new Promise(() => {}))); // tabs stay loading — fine
  render(<ToastProvider><ResearchView onGenerate={() => {}} /></ToastProvider>);
  expect(screen.getByText(/What are we researching today/)).toBeInTheDocument();
  expect(screen.getByText("4 of 4 sources selected")).toBeInTheDocument();

  await userEvent.click(screen.getByText("Customer Chats"));
  expect(screen.getByText("3 of 4 sources selected")).toBeInTheDocument();

  await userEvent.click(screen.getByRole("button", { name: /clear all/i }));
  expect(screen.getByText("1 of 4 sources selected")).toBeInTheDocument();

  await userEvent.click(screen.getByRole("button", { name: /view research/i }));
  // tabs page: only the enabled sub-tab button shows
  expect(screen.getByRole("button", { name: "Internet Trends" })).toBeInTheDocument();
  expect(screen.queryByRole("button", { name: "Customer Chats" })).toBeNull();
  expect(screen.getByRole("button", { name: /change sources/i })).toBeInTheDocument();
});

test("cannot disable the last enabled source", async () => {
  vi.stubGlobal("fetch", vi.fn(() => new Promise(() => {})));
  render(<ToastProvider><ResearchView onGenerate={() => {}} /></ToastProvider>);

  await userEvent.click(screen.getByRole("button", { name: /clear all/i }));
  expect(screen.getByText("1 of 4 sources selected")).toBeInTheDocument();

  await userEvent.click(screen.getByText("Internet Trends"));
  expect(screen.getByText("1 of 4 sources selected")).toBeInTheDocument();
  expect(screen.getByText("At least one source must stay selected")).toBeInTheDocument();
});

test("keeps the active tab across a no-change Change Sources round-trip", async () => {
  vi.stubGlobal("fetch", vi.fn(() => new Promise(() => {})));
  render(<ToastProvider><ResearchView onGenerate={() => {}} /></ToastProvider>);

  await userEvent.click(screen.getByRole("button", { name: /view research/i }));
  await userEvent.click(screen.getByRole("button", { name: "Social Media" }));
  await userEvent.click(screen.getByRole("button", { name: /change sources/i }));
  await userEvent.click(screen.getByRole("button", { name: /view research/i }));
  expect(screen.getByRole("button", { name: "Social Media" }).className).toContain("on");
});
