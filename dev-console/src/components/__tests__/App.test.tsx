import { render, screen } from "@testing-library/react";
import App from "../../App";

test("renders the four tab buttons", () => {
  render(<App />);
  for (const label of ["Data & Ingest", "Home", "Research", "Generate"]) {
    expect(screen.getByRole("button", { name: label })).toBeInTheDocument();
  }
});
