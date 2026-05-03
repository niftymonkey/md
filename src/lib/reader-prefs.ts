import {
  getUserPreferences,
  type UserPreferences,
  type Width,
} from "@/lib/user-preferences";

export type ResolvedReaderPrefs = {
  initialWidth: Width;
  initialOutlineShown: boolean;
};

/**
 * Pure resolver: given a user's prefs (or null for unauth) and whether the
 * doc has an outline (≥3 H2s, decided upstream), produce the initial reader
 * state. The ≥3 H2 gate is preserved as a quality floor — pref says "may
 * auto-show", not "always auto-show".
 */
export function resolveReaderPrefsFromPrefs(
  prefs: UserPreferences | null,
  hasOutline: boolean,
): ResolvedReaderPrefs {
  if (!hasOutline) {
    return {
      initialWidth: prefs?.defaultWidth ?? "reading",
      initialOutlineShown: false,
    };
  }
  return {
    initialWidth: prefs?.defaultWidth ?? "reading",
    initialOutlineShown: prefs ? prefs.autoShowOutline : true,
  };
}

export async function resolveReaderPrefs(args: {
  userId: string | null;
  hasOutline: boolean;
}): Promise<ResolvedReaderPrefs> {
  let prefs: UserPreferences | null = null;
  if (args.userId) {
    try {
      prefs = await getUserPreferences(args.userId);
    } catch (err) {
      console.warn("[reader-prefs] getUserPreferences failed:", err);
    }
  }
  return resolveReaderPrefsFromPrefs(prefs, args.hasOutline);
}
