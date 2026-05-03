import { describe, expect, it } from "vitest";
import {
  DEFAULT_PREFERENCES,
  mergeWithDefaults,
  validatePartialPreferences,
} from "./user-preferences";

describe("DEFAULT_PREFERENCES", () => {
  it("matches the migration defaults", () => {
    expect(DEFAULT_PREFERENCES).toEqual({
      autoShowOutline: true,
      defaultWidth: "reading",
    });
  });
});

describe("mergeWithDefaults", () => {
  it("returns the canonical defaults when no row exists", () => {
    expect(mergeWithDefaults(null)).toEqual(DEFAULT_PREFERENCES);
  });

  it("preserves stored values over defaults", () => {
    const result = mergeWithDefaults({
      auto_show_outline: false,
      default_width: "wide",
    });
    expect(result).toEqual({
      autoShowOutline: false,
      defaultWidth: "wide",
    });
  });
});

describe("validatePartialPreferences", () => {
  it("accepts an empty input", () => {
    const result = validatePartialPreferences({});
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.value).toEqual({});
  });

  it("accepts a valid auto_show_outline boolean", () => {
    const result = validatePartialPreferences({ autoShowOutline: false });
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.value.autoShowOutline).toBe(false);
  });

  it("rejects a non-boolean auto_show_outline", () => {
    const result = validatePartialPreferences({
      autoShowOutline: "false" as unknown as boolean,
    });
    expect(result.ok).toBe(false);
  });

  it("accepts default_width 'reading' and 'wide'", () => {
    expect(validatePartialPreferences({ defaultWidth: "reading" }).ok).toBe(
      true,
    );
    expect(validatePartialPreferences({ defaultWidth: "wide" }).ok).toBe(true);
  });

  it("rejects an unknown default_width", () => {
    const result = validatePartialPreferences({
      defaultWidth: "huge" as unknown as "reading",
    });
    expect(result.ok).toBe(false);
  });
});
