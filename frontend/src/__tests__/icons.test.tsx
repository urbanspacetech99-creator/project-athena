import { render } from "@testing-library/react";
import { expect, test } from "vitest";
import { Ico, ICO } from "../icons";

test("exposes the prototype icon set and renders inline svg", () => {
  for (const k of ["sparkle", "refresh", "arrowR", "heart", "eye", "pencil", "trash", "check"]) {
    expect(ICO[k as keyof typeof ICO]).toContain("<svg");
  }
  const { container } = render(<Ico k="sparkle" />);
  expect(container.querySelector("svg")).not.toBeNull();
});
