import { NextRequest } from "next/server";
import { requireAuth } from "@/lib/auth";
import { searchOwnedDocsFullText } from "@/lib/db";
import { findMatches, type PreviewLine } from "@/lib/match-resolver";
import { jsonError } from "@/lib/route-helpers";

/**
 * Cap on the number of literal matches returned per document. Matches the
 * `MAX_AMBIGUOUS_PREVIEWS` cap used by the single-doc edits endpoint, so
 * `matches[]` shapes are consistent across the agent API. `matchCount`
 * always reports the true total so callers know when previews were trimmed.
 */
const MAX_MATCHES_PER_DOC = 5;

/** Default doc cap when `?limit=` is absent or unparseable. */
const DEFAULT_LIMIT = 20;

/** Hard ceiling on `?limit=`. Mirrors `/api/list`. */
const MAX_LIMIT = 100;

/**
 * Number of context lines included on either side of a match. Matches the
 * `context: 1` setting the edits endpoint uses for ambiguous_match previews.
 */
const PREVIEW_CONTEXT = 1;

type DocMatch = {
  line: number;
  column: number;
  previewLines: PreviewLine[];
};

type ResponseDoc = {
  slug: string;
  title: string;
  kind: string | null;
  tags: string[];
  matchCount: number;
  matches: DocMatch[];
};

function parseLimit(raw: string | null): number {
  if (!raw) return DEFAULT_LIMIT;
  const n = Number.parseInt(raw, 10);
  if (!Number.isFinite(n) || n <= 0) return DEFAULT_LIMIT;
  return Math.min(MAX_LIMIT, n);
}

export async function GET(req: NextRequest) {
  const auth = await requireAuth(req);
  if (!auth.authenticated) {
    return jsonError(auth.status, auth.reason);
  }

  const { searchParams } = req.nextUrl;
  const rawQ = searchParams.get("q");
  if (rawQ === null) {
    return jsonError(400, "q query parameter is required");
  }
  const query = rawQ.trim();
  if (query.length === 0) {
    return jsonError(400, "q must not be empty");
  }
  const limit = parseLimit(searchParams.get("limit"));

  const candidates = await searchOwnedDocsFullText({
    ownerId: auth.ownerId,
    query,
    limit,
  });

  // FTS narrows the candidate set; findMatches extracts literal substring
  // matches in document order. Candidates with no literal match (case
  // mismatch, stem-only hit, etc.) drop out so the response only carries
  // results the caller can act on directly.
  const docs: ResponseDoc[] = [];
  for (const c of candidates) {
    const matches = findMatches(c.content, query, { context: PREVIEW_CONTEXT });
    if (matches.length === 0) continue;
    docs.push({
      slug: c.slug,
      title: c.title,
      kind: c.kind,
      tags: c.tags,
      matchCount: matches.length,
      matches: matches.slice(0, MAX_MATCHES_PER_DOC).map((m) => ({
        line: m.line,
        column: m.column,
        previewLines: m.previewLines,
      })),
    });
  }

  return new Response(JSON.stringify({ docs }), {
    status: 200,
    headers: { "content-type": "application/json; charset=utf-8" },
  });
}
