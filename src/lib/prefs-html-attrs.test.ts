import { describe, expect, it } from "vitest";
import { prefsToHtmlAttrs } from "./prefs-html-attrs";
import { DEFAULT_PREFERENCES } from "./user-preferences";

describe("prefsToHtmlAttrs", () => {
  it("returns an empty object for null prefs (unauth fallback path)", () => {
    expect(prefsToHtmlAttrs(null)).toEqual({});
  });

  it("returns an empty object for the canonical defaults", () => {
    expect(prefsToHtmlAttrs(DEFAULT_PREFERENCES)).toEqual({});
  });

  it("emits data-width=wide when defaultWidth is wide", () => {
    expect(
      prefsToHtmlAttrs({
        ...DEFAULT_PREFERENCES,
        defaultWidth: "wide",
      }),
    ).toEqual({ "data-width": "wide" });
  });

  it("does not emit data-width when defaultWidth is reading", () => {
    expect(
      prefsToHtmlAttrs({
        ...DEFAULT_PREFERENCES,
        defaultWidth: "reading",
      }),
    ).toEqual({});
  });

  it("emits data-outline-hidden=1 when autoShowOutline is false", () => {
    expect(
      prefsToHtmlAttrs({
        ...DEFAULT_PREFERENCES,
        autoShowOutline: false,
      }),
    ).toEqual({ "data-outline-hidden": "1" });
  });

  it("merges both attributes when both prefs are non-default", () => {
    expect(
      prefsToHtmlAttrs({
        autoShowOutline: false,
        defaultWidth: "wide",
      }),
    ).toEqual({
      "data-width": "wide",
      "data-outline-hidden": "1",
    });
  });
});
