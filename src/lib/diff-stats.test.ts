import { describe, expect, it } from "vitest";
import { computeDiff } from "./diff-stats";

describe("computeDiff", () => {
  it("returns zero deltas for identical strings", () => {
    expect(computeDiff("hello", "hello")).toEqual({
      bytesAdded: 0,
      bytesRemoved: 0,
    });
  });

  it("returns zero deltas for two empty strings", () => {
    expect(computeDiff("", "")).toEqual({ bytesAdded: 0, bytesRemoved: 0 });
  });

  it("counts bytes added when content grows from empty", () => {
    expect(computeDiff("", "hello")).toEqual({
      bytesAdded: 5,
      bytesRemoved: 0,
    });
  });

  it("counts bytes removed when content shrinks to empty", () => {
    expect(computeDiff("hello", "")).toEqual({
      bytesAdded: 0,
      bytesRemoved: 5,
    });
  });

  it("counts both sides of a substitution", () => {
    // "hello" → "world" share an "o" and "l", so the diff algorithm reports
    // smaller counts than 5/5. The point is that both sides are non-zero.
    const stats = computeDiff("hello", "world");
    expect(stats.bytesAdded).toBeGreaterThan(0);
    expect(stats.bytesRemoved).toBeGreaterThan(0);
    expect(stats.bytesAdded).toBeLessThanOrEqual(5);
    expect(stats.bytesRemoved).toBeLessThanOrEqual(5);
  });

  it("counts only the changed portion when the rest matches", () => {
    // " world" is shared; "hello" becomes "howdy".
    const stats = computeDiff("hello world", "howdy world");
    expect(stats.bytesAdded).toBeGreaterThan(0);
    expect(stats.bytesRemoved).toBeGreaterThan(0);
    // The unchanged " world" (6 bytes) should not be counted on either side.
    expect(stats.bytesAdded).toBeLessThanOrEqual(5);
    expect(stats.bytesRemoved).toBeLessThanOrEqual(5);
  });

  it("counts UTF-8 byte length, not code unit length, for multibyte chars", () => {
    // "café" → bytes_added should be 5 (c=1, a=1, f=1, é=2), not 4.
    const stats = computeDiff("", "café");
    expect(stats.bytesAdded).toBe(5);
  });

  it("counts emoji as their full UTF-8 byte length", () => {
    // "🚀" is a single user-perceived char, 4 UTF-8 bytes.
    const stats = computeDiff("", "🚀");
    expect(stats.bytesAdded).toBe(4);
  });

  it("handles a typical markdown edit", () => {
    const before = "# Title\n\nSome text here.\n";
    const after = "# Title\n\nSome updated text here.\n";
    // The unchanged prefix and suffix should not inflate either count.
    const stats = computeDiff(before, after);
    expect(stats.bytesAdded).toBe(8); // "updated "
    expect(stats.bytesRemoved).toBe(0);
  });
});
