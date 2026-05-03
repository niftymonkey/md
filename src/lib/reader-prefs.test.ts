import { describe, expect, it } from "vitest";
import { resolveReaderPrefsFromPrefs } from "./reader-prefs";
import { DEFAULT_PREFERENCES } from "./user-preferences";

describe("resolveReaderPrefsFromPrefs", () => {
  it("falls back to reading width and shows outline when prefs are null and the doc has an outline", () => {
    expect(resolveReaderPrefsFromPrefs(null, true)).toEqual({
      initialWidth: "reading",
      initialOutlineShown: true,
    });
  });

  it("forces outline closed when the doc lacks one, regardless of preference", () => {
    expect(
      resolveReaderPrefsFromPrefs(DEFAULT_PREFERENCES, false),
    ).toEqual({ initialWidth: "reading", initialOutlineShown: false });
  });

  it("respects defaultWidth=wide", () => {
    const prefs = { ...DEFAULT_PREFERENCES, defaultWidth: "wide" as const };
    expect(resolveReaderPrefsFromPrefs(prefs, true).initialWidth).toBe("wide");
  });

  it("hides the outline when autoShowOutline is off, even on docs that have one", () => {
    const prefs = { ...DEFAULT_PREFERENCES, autoShowOutline: false };
    expect(resolveReaderPrefsFromPrefs(prefs, true).initialOutlineShown).toBe(
      false,
    );
  });

  it("shows outline when autoShowOutline is on and the doc has one", () => {
    expect(
      resolveReaderPrefsFromPrefs(DEFAULT_PREFERENCES, true).initialOutlineShown,
    ).toBe(true);
  });
});
