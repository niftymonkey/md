export const TAG_MAX_LENGTH = 64;
export const TAGS_MAX_COUNT = 32;

export type ParsedTags =
  | { ok: true; value: string[] }
  | { ok: false; error: string };

export type ParsedTagFilter =
  | { ok: true; value: string | null }
  | { ok: false; error: string };

export type ParsedTagsFilter =
  | { ok: true; value: string[] }
  | { ok: false; error: string };

/**
 * Normalize a `tags` array from API input. Trims, lowercases, drops empties,
 * dedupes (case-insensitive — values are already lowercased). Rejects internal
 * whitespace so a tag survives `?tag=foo` URL round-tripping cleanly. Caps per-tag
 * length and total count so a single doc can't blow up the index or the chip row.
 */
export function parseTags(raw: unknown): ParsedTags {
  if (raw === undefined || raw === null) return { ok: true, value: [] };
  if (!Array.isArray(raw)) {
    return { ok: false, error: "tags must be an array of strings" };
  }
  const seen = new Set<string>();
  const out: string[] = [];
  for (const entry of raw) {
    if (typeof entry !== "string") {
      return { ok: false, error: "tags must be an array of strings" };
    }
    const normalized = normalizeTag(entry);
    if (normalized === null) continue;
    if (typeof normalized === "object") return normalized;
    if (seen.has(normalized)) continue;
    seen.add(normalized);
    out.push(normalized);
  }
  if (out.length > TAGS_MAX_COUNT) {
    return { ok: false, error: `tags exceed ${TAGS_MAX_COUNT} entries` };
  }
  return { ok: true, value: out };
}

/**
 * Normalize a single `?tag=` filter value. Returns `null` for empty/missing,
 * the canonical (trimmed + lowercased) form otherwise.
 */
export function parseTagFilter(raw: unknown): ParsedTagFilter {
  if (raw === undefined || raw === null) return { ok: true, value: null };
  if (typeof raw !== "string") {
    return { ok: false, error: "tag must be a string" };
  }
  const normalized = normalizeTag(raw);
  if (normalized === null) return { ok: true, value: null };
  if (typeof normalized === "object") return normalized;
  return { ok: true, value: normalized };
}

/**
 * Normalize the comma-separated `?tags=` filter value used on the dashboard.
 * Trims, lowercases, dedupes; silently drops empties so a stray trailing comma
 * doesn't error. Returns `[]` for empty/missing.
 */
export function parseTagsFilter(raw: unknown): ParsedTagsFilter {
  if (raw === undefined || raw === null) return { ok: true, value: [] };
  if (typeof raw !== "string") {
    return { ok: false, error: "tags must be a string" };
  }
  const seen = new Set<string>();
  const out: string[] = [];
  for (const part of raw.split(",")) {
    const normalized = normalizeTag(part);
    if (normalized === null) continue;
    if (typeof normalized === "object") return normalized;
    if (seen.has(normalized)) continue;
    seen.add(normalized);
    out.push(normalized);
  }
  if (out.length > TAGS_MAX_COUNT) {
    return { ok: false, error: `tags filter exceeds ${TAGS_MAX_COUNT} entries` };
  }
  return { ok: true, value: out };
}

function normalizeTag(raw: string): string | null | { ok: false; error: string } {
  const trimmed = raw.trim().toLowerCase();
  if (trimmed.length === 0) return null;
  if (/\s/.test(trimmed)) {
    return { ok: false, error: "tag must not contain whitespace" };
  }
  if (trimmed.includes(",")) {
    // The dashboard filter serializes tags as comma-separated `?tags=a,b,c`.
    // Allowing commas would split a single tag into two during URL round-trip.
    return { ok: false, error: "tag must not contain commas" };
  }
  if (trimmed.length > TAG_MAX_LENGTH) {
    return { ok: false, error: `tag exceeds ${TAG_MAX_LENGTH} characters` };
  }
  return trimmed;
}
