import { describe, expect, it } from "vitest";
import { prefsToHtmlAttrs } from "./prefs-html-attrs";
import { buildPreHydrationScript } from "./pre-hydration-script";
import { resolveReaderPrefsFromPrefs } from "./reader-prefs";
import type { UserPreferences } from "./user-preferences";

const allPrefStates: UserPreferences[] = [
  { autoShowOutline: true, defaultWidth: "reading" },
  { autoShowOutline: true, defaultWidth: "wide" },
  { autoShowOutline: false, defaultWidth: "reading" },
  { autoShowOutline: false, defaultWidth: "wide" },
];

describe("authed reader-prefs flow contract", () => {
  describe.each(allPrefStates)(
    "with prefs autoShowOutline=$autoShowOutline, defaultWidth=$defaultWidth",
    (prefs) => {
      const serverAttrs = prefsToHtmlAttrs(prefs);
      const script = buildPreHydrationScript(true);
      const reader = resolveReaderPrefsFromPrefs(prefs, true);

      it("the pre-hydration script does not read the same localStorage keys the server already emitted attrs for", () => {
        expect(script).not.toContain("md.width");
        expect(script).not.toContain("md.outline.shown");
      });

      it("the server-emitted data-width attribute matches the resolved initial reader width", () => {
        const serverWidth = serverAttrs["data-width"];
        if (reader.initialWidth === "wide") {
          expect(serverWidth).toBe("wide");
        } else {
          expect(serverWidth).toBeUndefined();
        }
      });

      it("the server-emitted data-outline-hidden attribute matches the resolved initial outline state", () => {
        const serverOutlineHidden = serverAttrs["data-outline-hidden"];
        if (reader.initialOutlineShown) {
          expect(serverOutlineHidden).toBeUndefined();
        } else {
          expect(serverOutlineHidden).toBe("1");
        }
      });
    },
  );
});

describe("unauthed reader-prefs flow contract", () => {
  it("prefsToHtmlAttrs returns empty for null prefs (so the server emits no attrs and the script's localStorage path is solely responsible)", () => {
    expect(prefsToHtmlAttrs(null)).toEqual({});
  });

  it("the pre-hydration script reads the localStorage keys for reader prefs", () => {
    const script = buildPreHydrationScript(false);
    expect(script).toContain("md.width");
    expect(script).toContain("md.outline.shown");
  });

  it("resolveReaderPrefsFromPrefs falls back to width=reading + outline-shown=autoShowEligible", () => {
    expect(resolveReaderPrefsFromPrefs(null, true)).toEqual({
      initialWidth: "reading",
      initialOutlineShown: true,
    });
    expect(resolveReaderPrefsFromPrefs(null, false)).toEqual({
      initialWidth: "reading",
      initialOutlineShown: false,
    });
  });
});

describe("regression — bugs reported during PR review", () => {
  it("bug 1: when autoShowOutline=true, server emits no data-outline-hidden AND the authed script never sets it (so refresh stays consistent with the toggle)", () => {
    const prefs: UserPreferences = {
      autoShowOutline: true,
      defaultWidth: "reading",
    };
    const serverAttrs = prefsToHtmlAttrs(prefs);
    const script = buildPreHydrationScript(true);
    expect(serverAttrs["data-outline-hidden"]).toBeUndefined();
    expect(script).not.toContain("data-outline-hidden");
  });

  it("bug 2: when defaultWidth=reading, server emits no data-width AND the authed script never sets it (so toggling wide→reading→refresh stays reading)", () => {
    const prefs: UserPreferences = {
      autoShowOutline: true,
      defaultWidth: "reading",
    };
    const serverAttrs = prefsToHtmlAttrs(prefs);
    const script = buildPreHydrationScript(true);
    expect(serverAttrs["data-width"]).toBeUndefined();
    expect(script).not.toContain("data-width");
  });
});
