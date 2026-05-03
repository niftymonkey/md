import { describe, expect, it } from "vitest";
import { maskEmail } from "./mask-email";

describe("maskEmail", () => {
  it("keeps the first character of the local part and replaces the rest with asterisks", () => {
    expect(maskEmail("mark.d.lozano@gmail.com")).toBe("m************@gmail.com");
  });

  it("preserves a single-character local part by emitting only the first char (no asterisks)", () => {
    expect(maskEmail("a@x.io")).toBe("a@x.io");
  });

  it("handles a two-character local part with one asterisk", () => {
    expect(maskEmail("ab@x.io")).toBe("a*@x.io");
  });

  it("preserves the domain casing", () => {
    expect(maskEmail("Foo.Bar@Example.COM")).toBe("F******@Example.COM");
  });

  it("returns the original string when there is no @", () => {
    expect(maskEmail("not-an-email")).toBe("not-an-email");
  });

  it("returns the original string when the local part is empty", () => {
    expect(maskEmail("@example.com")).toBe("@example.com");
  });
});
