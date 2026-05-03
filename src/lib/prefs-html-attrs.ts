import type { UserPreferences } from "@/lib/user-preferences";

export type HtmlPrefAttrs = {
  "data-width"?: "wide";
  "data-outline-hidden"?: "1";
};

/**
 * Maps a user's stored preferences to the data attributes the layout sets on
 * <html>. Mirrors the inline pre-hydration script's localStorage path; for
 * authed users the layout reads prefs server-side and emits the attributes
 * directly, so first paint is correct without an inline-script round trip.
 *
 * Only non-default values produce attributes — defaults are absence.
 */
export function prefsToHtmlAttrs(
  prefs: UserPreferences | null,
): HtmlPrefAttrs {
  if (!prefs) return {};
  const attrs: HtmlPrefAttrs = {};
  if (prefs.defaultWidth === "wide") attrs["data-width"] = "wide";
  if (prefs.autoShowOutline === false) attrs["data-outline-hidden"] = "1";
  return attrs;
}
