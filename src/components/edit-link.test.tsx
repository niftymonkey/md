// @vitest-environment happy-dom
import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import { EditLink } from "./edit-link";

describe("EditLink", () => {
  it("renders an accessible link to the doc's edit route", () => {
    render(<EditLink slug="abc123" title="Sample doc" />);
    const link = screen.getByRole("link", { name: /edit sample doc/i });
    expect(link).toBeInTheDocument();
    expect(link).toHaveAttribute("href", "/edit/abc123");
  });
});
