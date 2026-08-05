import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { expect, test, vi } from "vitest";
import { SuggestedPosts } from "./SuggestedPosts";

test("renders numbered titles and fires onGenerate with the title", async () => {
  const onGenerate = vi.fn();
  render(<SuggestedPosts title="AI Suggested Posts" sub="From trends"
    titles={["Post idea one", "Post idea two"]} subLabel="From this week's internet trends"
    onGenerate={onGenerate} />);
  expect(screen.getByText("Post idea one")).toBeInTheDocument();
  expect(screen.getByText("2")).toBeInTheDocument();
  const buttons = screen.getAllByRole("button", { name: /generate/i });
  await userEvent.click(buttons[1]);
  expect(onGenerate).toHaveBeenCalledWith("Post idea two");
});
