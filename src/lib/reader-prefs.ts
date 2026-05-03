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
 * doc is eligible to auto-show its outline by default, produce the initial
 * reader state. Outline availability is decided upstream and remains separate:
 * this only answers whether the available outline starts open.
 */
export function resolveReaderPrefsFromPrefs(
  prefs: UserPreferences | null,
  autoShowEligible: boolean,
): ResolvedReaderPrefs {
  if (!autoShowEligible) {
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
  autoShowEligible: boolean;
}): Promise<ResolvedReaderPrefs> {
  let prefs: UserPreferences | null = null;
  if (args.userId) {
    try {
      prefs = await getUserPreferences(args.userId);
    } catch (err) {
      console.warn("[reader-prefs] getUserPreferences failed:", err);
    }
  }
  return resolveReaderPrefsFromPrefs(prefs, args.autoShowEligible);
}
