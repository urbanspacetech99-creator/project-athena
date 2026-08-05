import { render, screen } from "@testing-library/react";
import { expect, test } from "vitest";
import { ProgressBar } from "./ProgressBar";

test("renders indeterminate with generic label when no progress given", () => {
  render(<ProgressBar />);
  expect(screen.getByText("Loading…")).toBeInTheDocument();
});

test("renders determinate width, label, and step count", () => {
  const { container } = render(
    <ProgressBar progress={{ step: 3, total: 12, label: "Option 1: image generated" }} />);
  expect(screen.getByText("Option 1: image generated · 3 of 12")).toBeInTheDocument();
  const fill = container.querySelector(".pbar-fill") as HTMLElement;
  expect(fill.style.width).toBe("25%");  // round(100*3/12)
});
