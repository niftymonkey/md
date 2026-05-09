import { describe, expect, it } from "vitest";
import { resolveSection } from "./section-addresser";

describe("resolveSection — single-level heading", () => {
  it("locates a top-level heading and includes everything until the next heading of the same level", () => {
    const md = [
      "# Intro",
      "intro body",
      "",
      "# API",
      "api line 1",
      "api line 2",
      "",
      "# Other",
      "other body",
      "",
    ].join("\n");
    const result = resolveSection(md, ["API"]);
    expect(result.ok).toBe(true);
    if (!result.ok) throw new Error("unreachable");
    expect(result.fromLine).toBe(4);
    expect(result.toLine).toBe(7);
  });

  it("returns end-of-doc as toLine when the matched section is the last one", () => {
    const md = ["# Intro", "intro", "", "# Final", "final body"].join("\n");
    const result = resolveSection(md, ["Final"]);
    expect(result.ok).toBe(true);
    if (!result.ok) throw new Error("unreachable");
    expect(result.fromLine).toBe(4);
    expect(result.toLine).toBe(5);
  });
});

describe("resolveSection — nested headings", () => {
  const md = [
    "# API", // 1
    "blurb", // 2
    "", // 3
    "## Errors", // 4
    "error body", // 5
    "", // 6
    "## Auth", // 7
    "auth body", // 8
    "", // 9
    "# Other", // 10
    "other body", // 11
  ].join("\n");

  it("a parent section spans through its descendants", () => {
    const result = resolveSection(md, ["API"]);
    expect(result.ok).toBe(true);
    if (!result.ok) throw new Error("unreachable");
    expect(result.fromLine).toBe(1);
    expect(result.toLine).toBe(9);
  });

  it("a child section ends at its next sibling, not at the parent's boundary", () => {
    const result = resolveSection(md, ["API", "Errors"]);
    expect(result.ok).toBe(true);
    if (!result.ok) throw new Error("unreachable");
    expect(result.fromLine).toBe(4);
    expect(result.toLine).toBe(6);
  });

  it("a child section ends at a higher-level heading (less # chars) when there's no sibling", () => {
    const result = resolveSection(md, ["API", "Auth"]);
    expect(result.ok).toBe(true);
    if (!result.ok) throw new Error("unreachable");
    expect(result.fromLine).toBe(7);
    expect(result.toLine).toBe(9);
  });
});

describe("resolveSection — heading text matching", () => {
  it("matches the rendered text, ignoring inline markdown formatting", () => {
    const md = ["# **Bold** API", "body"].join("\n");
    const result = resolveSection(md, ["Bold API"]);
    expect(result.ok).toBe(true);
  });

  it("trims whitespace around the heading text and the path component", () => {
    const md = ["#   API   ", "body"].join("\n");
    const result = resolveSection(md, ["API"]);
    expect(result.ok).toBe(true);
  });

  it("is case-sensitive", () => {
    const md = ["# API", "body"].join("\n");
    const result = resolveSection(md, ["api"]);
    expect(result.ok).toBe(false);
    if (result.ok) throw new Error("unreachable");
    expect(result.error.kind).toBe("heading_not_found");
  });
});

describe("resolveSection — error cases", () => {
  it("returns heading_not_found when no heading matches the path", () => {
    const md = ["# Intro", "body"].join("\n");
    const result = resolveSection(md, ["Missing"]);
    expect(result.ok).toBe(false);
    if (result.ok) throw new Error("unreachable");
    expect(result.error.kind).toBe("heading_not_found");
  });

  it("returns heading_not_found when the parent heading exists but the child doesn't", () => {
    const md = ["# API", "body", "## Errors", "more"].join("\n");
    const result = resolveSection(md, ["API", "Auth"]);
    expect(result.ok).toBe(false);
    if (result.ok) throw new Error("unreachable");
    expect(result.error.kind).toBe("heading_not_found");
  });

  it("returns ambiguous_heading when two siblings share the same text under the same parent", () => {
    const md = [
      "# API",
      "## Errors",
      "first errors body",
      "## Auth",
      "auth body",
      "## Errors",
      "second errors body",
    ].join("\n");
    const result = resolveSection(md, ["API", "Errors"]);
    expect(result.ok).toBe(false);
    if (result.ok) throw new Error("unreachable");
    if (result.error.kind !== "ambiguous_heading") {
      throw new Error(`expected ambiguous_heading, got ${result.error.kind}`);
    }
    expect(result.error.matchCount).toBe(2);
  });

  it("returns ambiguous_heading when a top-level heading text appears twice", () => {
    const md = ["# API", "first", "# API", "second"].join("\n");
    const result = resolveSection(md, ["API"]);
    expect(result.ok).toBe(false);
    if (result.ok) throw new Error("unreachable");
    if (result.error.kind !== "ambiguous_heading") {
      throw new Error(`expected ambiguous_heading, got ${result.error.kind}`);
    }
    expect(result.error.matchCount).toBe(2);
  });
});

describe("resolveSection — markdown edge cases", () => {
  it("ignores '#' inside fenced code blocks", () => {
    const md = [
      "# Real Heading", // 1
      "intro", // 2
      "", // 3
      "```", // 4
      "# This is code, not a heading", // 5
      "more code", // 6
      "```", // 7
      "after code", // 8
    ].join("\n");
    const result = resolveSection(md, ["Real Heading"]);
    expect(result.ok).toBe(true);
    if (!result.ok) throw new Error("unreachable");
    expect(result.fromLine).toBe(1);
    expect(result.toLine).toBe(8);
  });

  it("does not match a heading inside a fenced code block", () => {
    const md = [
      "# Outer",
      "```",
      "# Fake",
      "```",
      "after",
    ].join("\n");
    const result = resolveSection(md, ["Fake"]);
    expect(result.ok).toBe(false);
    if (result.ok) throw new Error("unreachable");
    expect(result.error.kind).toBe("heading_not_found");
  });

  it("treats a deeper child like H4 under H1 as still in the parent's section", () => {
    const md = [
      "# API",
      "blurb",
      "#### Deep note",
      "deep body",
      "# Other",
      "other body",
    ].join("\n");
    const result = resolveSection(md, ["API"]);
    expect(result.ok).toBe(true);
    if (!result.ok) throw new Error("unreachable");
    expect(result.fromLine).toBe(1);
    expect(result.toLine).toBe(4);
  });
});

describe("resolveSection — invalid input", () => {
  it("returns heading_not_found for an empty doc", () => {
    const result = resolveSection("", ["Anything"]);
    expect(result.ok).toBe(false);
    if (result.ok) throw new Error("unreachable");
    expect(result.error.kind).toBe("heading_not_found");
  });

  it("returns heading_not_found for a doc with no headings", () => {
    const result = resolveSection("just prose\nno headings here\n", ["Anything"]);
    expect(result.ok).toBe(false);
    if (result.ok) throw new Error("unreachable");
    expect(result.error.kind).toBe("heading_not_found");
  });
});
