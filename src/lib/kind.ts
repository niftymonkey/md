export const KIND_MAX_LENGTH = 64;

export type ParsedKind =
  | { ok: true; value: string | null }
  | { ok: false; error: string };

/**
 * Normalize a `kind` value from API input. Trims, lowercases, treats
 * empty-after-trim as null. Returns an error past KIND_MAX_LENGTH so callers
 * surface 400 rather than silently truncating an identifier.
 */
export function parseKind(raw: unknown): ParsedKind {
  if (raw === undefined || raw === null) return { ok: true, value: null };
  if (typeof raw !== "string") {
    return { ok: false, error: "kind must be a string" };
  }
  const trimmed = raw.trim().toLowerCase();
  if (trimmed.length === 0) return { ok: true, value: null };
  if (trimmed.length > KIND_MAX_LENGTH) {
    return { ok: false, error: `kind exceeds ${KIND_MAX_LENGTH} characters` };
  }
  return { ok: true, value: trimmed };
}
