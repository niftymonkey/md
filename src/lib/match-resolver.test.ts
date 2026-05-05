import { describe, it, expect } from "vitest";
import { findMatches, type Match } from "./match-resolver";

describe("findMatches — basic cases", () => {
  it("returns an empty array when the query is not found", () => {
    const matches = findMatches("hello world\n", "xyz");
    expect(matches).toEqual([]);
  });

  it("returns a single match with line and column (1-indexed)", () => {
    const content = "line one\nline two\nline three\n";
    const matches = findMatches(content, "two");
    expect(matches).toHaveLength(1);
    const m = matches[0]!;
    expect(m.line).toBe(2);
    expect(m.column).toBe(6); // "line " is 5 chars, "t" at column 6
    expect(m.start).toBe(content.indexOf("two"));
    expect(m.end).toBe(m.start + "two".length);
  });

  it("returns multiple matches in document order", () => {
    const content = "foo bar\nbaz foo\nfoo end\n";
    const matches = findMatches(content, "foo");
    expect(matches).toHaveLength(3);
    expect(matches.map((m) => m.line)).toEqual([1, 2, 3]);
    // First column of "foo" on each line
    expect(matches.map((m) => m.column)).toEqual([1, 5, 1]);
  });

  it("treats query as a literal string (no regex semantics)", () => {
    const content = "a.b.c\na+b+c\n";
    const matches = findMatches(content, "a.b");
    expect(matches).toHaveLength(1);
    expect(matches[0]!.line).toBe(1);
  });
});

describe("findMatches — multi-line query", () => {
  it("finds a query that spans multiple lines", () => {
    const content = "alpha\nbeta\ngamma\n";
    const matches = findMatches(content, "alpha\nbeta");
    expect(matches).toHaveLength(1);
    const m = matches[0]!;
    expect(m.line).toBe(1);
    expect(m.column).toBe(1);
  });

  it("counts line/column at the START of the match", () => {
    const content = "x\nfoo\nbar\nend\n";
    const matches = findMatches(content, "foo\nbar");
    expect(matches[0]!.line).toBe(2);
    expect(matches[0]!.column).toBe(1);
  });
});

describe("findMatches — context", () => {
  it("includes the match line as previewLines by default", () => {
    const content = "one\ntwo\nthree\nfour\nfive\n";
    const matches = findMatches(content, "three");
    expect(matches[0]!.previewLines).toEqual([
      { line: 3, text: "three" },
    ]);
  });

  it("respects context option (lines before/after)", () => {
    const content = "one\ntwo\nthree\nfour\nfive\n";
    const matches = findMatches(content, "three", { context: 1 });
    expect(matches[0]!.previewLines).toEqual([
      { line: 2, text: "two" },
      { line: 3, text: "three" },
      { line: 4, text: "four" },
    ]);
  });

  it("clamps context at document boundaries", () => {
    const content = "one\ntwo\nthree\n";
    const matches = findMatches(content, "one", { context: 2 });
    expect(matches[0]!.previewLines).toEqual([
      { line: 1, text: "one" },
      { line: 2, text: "two" },
      { line: 3, text: "three" },
    ]);
  });

  it("for multi-line matches, includes every match line in previewLines", () => {
    const content = "a\nfoo\nbar\nend\n";
    const matches = findMatches(content, "foo\nbar");
    const lines = matches[0]!.previewLines.map((p) => p.line);
    expect(lines).toContain(2);
    expect(lines).toContain(3);
  });
});

describe("findMatches — guards and edge cases", () => {
  it("returns empty for empty query", () => {
    const matches = findMatches("hello", "");
    expect(matches).toEqual([]);
  });

  it("handles content without trailing newline", () => {
    const content = "no\ntrailing";
    const matches = findMatches(content, "trailing");
    expect(matches).toHaveLength(1);
    expect(matches[0]!.line).toBe(2);
  });

  it("does not double-count overlapping matches", () => {
    // "aaaa" contains "aa" overlappingly at 0,1,2. We use non-overlapping
    // semantics so search advances past each match.
    const matches = findMatches("aaaa", "aa");
    expect(matches).toHaveLength(2);
  });

  it("Match objects expose a stable shape", () => {
    const content = "alpha\nbeta\n";
    const matches: Match[] = findMatches(content, "beta");
    const m = matches[0]!;
    expect(typeof m.start).toBe("number");
    expect(typeof m.end).toBe("number");
    expect(typeof m.line).toBe("number");
    expect(typeof m.column).toBe("number");
    expect(Array.isArray(m.previewLines)).toBe(true);
  });
});
