import { requireAuth, type AuthResult } from "@/lib/auth";
import { getDocBySlug, type Doc } from "@/lib/db";
import type { ApplierError, MatchPreview } from "@/lib/operation-applier";

export type AuthSuccess = Extract<AuthResult, { authenticated: true }>;

export type OwnedDocResult =
  | { ok: true; auth: AuthSuccess; doc: Doc }
  | { ok: false; response: Response };

export function jsonError(status: number, message: string): Response {
  return new Response(JSON.stringify({ error: message }), {
    status,
    headers: { "content-type": "application/json" },
  });
}

export async function requireOwnedDoc(
  req: Request,
  slug: string,
): Promise<OwnedDocResult> {
  const auth = await requireAuth(req);
  if (!auth.authenticated) {
    return { ok: false, response: jsonError(auth.status, auth.reason) };
  }
  const doc = await getDocBySlug(slug);
  if (!doc || doc.ownerId !== auth.ownerId) {
    return { ok: false, response: jsonError(404, "Document not found") };
  }
  return { ok: true, auth, doc };
}

/**
 * JSON error body for an OperationApplier failure. Discriminated on `error`,
 * mirroring the `ApplierError` kinds, plus `failedAt`: the 0-indexed op that
 * failed within its doc's batch. Shared by the single-doc `/edits` route and
 * the cross-document `/api/agent/edits` route so both report failures the
 * same way.
 */
export type AgentApplierErrorBody =
  | { error: "no_match"; failedAt: number; query: string }
  | {
      error: "ambiguous_match";
      failedAt: number;
      query: string;
      matchCount: number;
      matches: MatchPreview[];
    }
  | {
      error: "line_out_of_range";
      failedAt: number;
      line: number;
      documentLines: number;
    }
  | {
      error: "range_out_of_range";
      failedAt: number;
      from: number;
      to: number;
      documentLines: number;
    }
  | { error: "overlapping_line_ops"; failedAt: number; conflictsWith: number }
  | { error: "heading_not_found"; failedAt: number; headingPath: string[] }
  | {
      error: "ambiguous_heading";
      failedAt: number;
      headingPath: string[];
      matchCount: number;
    };

export function applierErrorBody(
  error: ApplierError,
  failedAt: number,
): AgentApplierErrorBody {
  switch (error.kind) {
    case "no_match":
      return { error: "no_match", failedAt, query: error.query };
    case "ambiguous_match":
      return {
        error: "ambiguous_match",
        failedAt,
        query: error.query,
        matchCount: error.matchCount,
        matches: error.matches,
      };
    case "line_out_of_range":
      return {
        error: "line_out_of_range",
        failedAt,
        line: error.line,
        documentLines: error.documentLines,
      };
    case "range_out_of_range":
      return {
        error: "range_out_of_range",
        failedAt,
        from: error.from,
        to: error.to,
        documentLines: error.documentLines,
      };
    case "overlapping_line_ops":
      return {
        error: "overlapping_line_ops",
        failedAt,
        conflictsWith: error.conflictsWith,
      };
    case "heading_not_found":
      return {
        error: "heading_not_found",
        failedAt,
        headingPath: error.headingPath,
      };
    case "ambiguous_heading":
      return {
        error: "ambiguous_heading",
        failedAt,
        headingPath: error.headingPath,
        matchCount: error.matchCount,
      };
  }
}
