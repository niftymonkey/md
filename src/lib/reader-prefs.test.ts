import { describe, expect, it } from "vitest";
import { resolveReaderPrefsFromPrefs } from "./reader-prefs";
import { DEFAULT_PREFERENCES } from "./user-preferences";

describe("resolveReaderPrefsFromPrefs", () => {
  it("falls back to reading width and shows outline when prefs are null and the doc is auto-show eligible", () => {
    expect(resolveReaderPrefsFromPrefs(null, true)).toEqual({
      initialWidth: "reading",
      initialOutlineShown: true,
    });
  });

  it("keeps outline closed by default when the doc is not auto-show eligible, regardless of preference", () => {
    expect(
      resolveReaderPrefsFromPrefs(DEFAULT_PREFERENCES, false),
    ).toEqual({ initialWidth: "reading", initialOutlineShown: false });
  });

  it("respects defaultWidth=wide", () => {
    const prefs = { ...DEFAULT_PREFERENCES, defaultWidth: "wide" as const };
    expect(resolveReaderPrefsFromPrefs(prefs, true).initialWidth).toBe("wide");
  });

  it("hides the outline by default when autoShowOutline is off, even on eligible docs", () => {
    const prefs = { ...DEFAULT_PREFERENCES, autoShowOutline: false };
    expect(resolveReaderPrefsFromPrefs(prefs, true).initialOutlineShown).toBe(
      false,
    );
  });

  it("shows outline by default when autoShowOutline is on and the doc is eligible", () => {
    expect(
      resolveReaderPrefsFromPrefs(DEFAULT_PREFERENCES, true).initialOutlineShown,
    ).toBe(true);
  });
});
