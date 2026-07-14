import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { expect, test } from "vitest";
import { AsyncSection } from "../components/AsyncSection";
import { useApi } from "../hooks/useApi";

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
