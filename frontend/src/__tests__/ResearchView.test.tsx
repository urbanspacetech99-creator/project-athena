import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, expect, test, vi } from "vitest";
import { ToastProvider } from "../toast";
import { ResearchView } from "../views/research/ResearchView";

afterEach(() => vi.restoreAllMocks());

test("clear all selects none and disables View Research", async () => {
  vi.stubGlobal("fetch", vi.fn(() => new Promise(() => {}))); // tabs stay loading — fine
  render(<ToastProvider><ResearchView onGenerate={() => {}} /></ToastProvider>);
  expect(screen.getByText("4 of 4 sources selected")).toBeInTheDocument();

  await userEvent.click(screen.getByRole("button", { name: /clear all/i }));
  expect(screen.getByText("0 of 4 sources selected")).toBeInTheDocument();
  expect(screen.getByRole("button", { name: /view research/i })).toBeDisabled();

  // re-enable one source and enter tabs: only that sub-tab shows
  await userEvent.click(screen.getByText("Customer Chats"));
  await userEvent.click(screen.getByRole("button", { name: /view research/i }));
  expect(screen.getByRole("button", { name: "Customer Chats" })).toBeInTheDocument();
  expect(screen.queryByRole("button", { name: "Internet Trends" })).toBeNull();
});

test("every source can be deselected — no forced minimum", async () => {
  vi.stubGlobal("fetch", vi.fn(() => new Promise(() => {})));
  render(<ToastProvider><ResearchView onGenerate={() => {}} /></ToastProvider>);
  for (const label of ["Internet Trends", "Customer Chats", "Social Media", "Competitor Analysis"])
    await userEvent.click(screen.getByText(label));
  expect(screen.getByText("0 of 4 sources selected")).toBeInTheDocument();
  expect(screen.queryByText("At least one source must stay selected")).toBeNull();
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
