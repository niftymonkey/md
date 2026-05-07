import { describe, expect, it } from "vitest";
import {
  TAG_MAX_LENGTH,
  TAGS_MAX_COUNT,
  parseTagFilter,
  parseTags,
  parseTagsFilter,
} from "./tags";

describe("parseTags", () => {
  it("returns [] for null/undefined", () => {
    expect(parseTags(undefined)).toEqual({ ok: true, value: [] });
    expect(parseTags(null)).toEqual({ ok: true, value: [] });
  });

  it("rejects non-array input", () => {
    const result = parseTags("auth");
    expect(result.ok).toBe(false);
  });

  it("rejects non-string entries", () => {
    const result = parseTags(["auth", 42]);
    expect(result.ok).toBe(false);
  });

  it("trims, lowercases, drops empties", () => {
    expect(parseTags(["  Auth ", "", "  ", "Postgres"])).toEqual({
      ok: true,
      value: ["auth", "postgres"],
    });
  });

  it("dedupes case-insensitively", () => {
    expect(parseTags(["auth", "Auth", "AUTH"])).toEqual({
      ok: true,
      value: ["auth"],
    });
  });

  it("rejects whitespace inside a tag", () => {
    const result = parseTags(["foo bar"]);
    expect(result.ok).toBe(false);
  });

  it("rejects tags over the per-tag length cap", () => {
    const tooLong = "a".repeat(TAG_MAX_LENGTH + 1);
    const result = parseTags([tooLong]);
    expect(result.ok).toBe(false);
  });

  it("rejects more than the total-count cap", () => {
    const tags = Array.from({ length: TAGS_MAX_COUNT + 1 }, (_, i) => `t${i}`);
    const result = parseTags(tags);
    expect(result.ok).toBe(false);
  });
});

describe("parseTagsFilter", () => {
  it("returns [] for missing/empty/null", () => {
    expect(parseTagsFilter(undefined)).toEqual({ ok: true, value: [] });
    expect(parseTagsFilter(null)).toEqual({ ok: true, value: [] });
    expect(parseTagsFilter("")).toEqual({ ok: true, value: [] });
  });

  it("splits comma-separated values, trims, lowercases, dedupes", () => {
    expect(parseTagsFilter("Auth,postgres, AUTH , ")).toEqual({
      ok: true,
      value: ["auth", "postgres"],
    });
  });

  it("rejects whitespace inside an entry", () => {
    const result = parseTagsFilter("foo,foo bar");
    expect(result.ok).toBe(false);
  });

  it("rejects entries over the per-tag length cap", () => {
    const tooLong = "a".repeat(TAG_MAX_LENGTH + 1);
    const result = parseTagsFilter(`auth,${tooLong}`);
    expect(result.ok).toBe(false);
  });

  it("rejects more than the total-count cap", () => {
    const csv = Array.from({ length: TAGS_MAX_COUNT + 1 }, (_, i) => `t${i}`).join(",");
    const result = parseTagsFilter(csv);
    expect(result.ok).toBe(false);
  });
});

describe("parseTagFilter", () => {
  it("returns null for missing/empty", () => {
    expect(parseTagFilter(undefined)).toEqual({ ok: true, value: null });
    expect(parseTagFilter(null)).toEqual({ ok: true, value: null });
    expect(parseTagFilter("")).toEqual({ ok: true, value: null });
    expect(parseTagFilter("  ")).toEqual({ ok: true, value: null });
  });

  it("normalizes case and surrounding whitespace", () => {
    expect(parseTagFilter("  Auth ")).toEqual({ ok: true, value: "auth" });
  });

  it("rejects whitespace inside the tag", () => {
    const result = parseTagFilter("foo bar");
    expect(result.ok).toBe(false);
  });

  it("rejects non-string input", () => {
    const result = parseTagFilter(["auth"]);
    expect(result.ok).toBe(false);
  });
});
