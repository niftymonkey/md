import { describe, expect, it } from "vitest";
import { formatSource, shouldShowSourceLabel } from "./revision-display";

describe("formatSource", () => {
  it("maps the four source enum values to user-facing labels", () => {
    expect(formatSource("manual")).toBe("Edit");
    expect(formatSource("cli")).toBe("API");
    expect(formatSource("agent")).toBe("Agent");
    expect(formatSource("restore")).toBe("Restored");
  });
});

describe("shouldShowSourceLabel", () => {
  it("hides the source label on restore rows since the summary already says 'Restored from rv_…'", () => {
    expect(shouldShowSourceLabel("restore")).toBe(false);
  });

  it("shows the source label on every other source", () => {
    expect(shouldShowSourceLabel("manual")).toBe(true);
    expect(shouldShowSourceLabel("cli")).toBe(true);
    expect(shouldShowSourceLabel("agent")).toBe(true);
  });
});
