import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, expect, test, vi } from "vitest";
import { App } from "./App";

afterEach(() => vi.restoreAllMocks());

test("renders sidebar and switches views", async () => {
  vi.stubGlobal("fetch", vi.fn(() => new Promise(() => {}))); // home fetches hang: loading state
  render(<App />);
  expect(screen.getByText("Marketing Agent")).toBeInTheDocument();
  expect(screen.getByText(/Hello, UrbanSpace team/)).toBeInTheDocument();
  await userEvent.click(screen.getByRole("button", { name: /settings/i }));
  expect(await screen.findByText(/Configure tracked competitors/)).toBeInTheDocument();
});
