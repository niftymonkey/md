import { NextRequest } from "next/server";
import { revalidatePath } from "next/cache";
import { writeDocContent } from "@/lib/doc-mutation-path";
import { resolveTitle } from "@/lib/title";
import { stripMarkdown } from "@/lib/strip-md";
import { jsonError, requireOwnedDoc } from "@/lib/route-helpers";
import { parseEditOps } from "@/lib/edit-op-schema";
import { apply, type ApplierError } from "@/lib/operation-applier";

const MAX_BYTES = 1024 * 1024;

type Body = { ops?: unknown; summary?: unknown; dryRun?: unknown };

function applierErrorBody(
  error: ApplierError,
  failedAt: number,
): Record<string, unknown> {
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
  }
}

export async function POST(
  req: NextRequest,
  context: { params: Promise<{ slug: string }> },
) {
  const { slug } = await context.params;

  // Reject oversized requests before buffering. The 1 MB cap on the resulting
  // doc is enforced after applying ops, but a malicious caller could still
  // send a huge ops payload (e.g. a giant `replace.replace`) that would OOM
  // the server during req.json(). Mirror the PATCH route's content-length guard.
  const contentLength = req.headers.get("content-length");
  if (contentLength && parseInt(contentLength, 10) > MAX_BYTES) {
    return jsonError(413, "Request body exceeds 1MB limit");
  }

  let body: Body;
  try {
    body = (await req.json()) as Body;
  } catch {
    return jsonError(400, "Invalid JSON body");
  }
  if (typeof body !== "object" || body === null) {
    return jsonError(400, "JSON body required");
  }

  const parsed = parseEditOps(body.ops);
  if (!parsed.ok) {
    return jsonError(400, parsed.error);
  }

  let summary: string | null = null;
  if (body.summary !== undefined) {
    if (body.summary !== null && typeof body.summary !== "string") {
      return jsonError(400, "summary must be a string or null");
    }
    summary = body.summary;
  }

  let dryRun = false;
  if (body.dryRun !== undefined) {
    if (typeof body.dryRun !== "boolean") {
      return jsonError(400, "dryRun must be a boolean");
    }
    dryRun = body.dryRun;
  }

  // Optimistic concurrency: agents that opt in pass the revisionId they
  // last read in If-Match. We re-check under FOR UPDATE inside writeDocContent
  // to close the race between this read and the write, but an early check
  // here short-circuits dryRun and saves work in the common stale case.
  const ifMatchHeader = req.headers.get("if-match");
  const expectedRevisionId = ifMatchHeader?.trim() || null;
  if (ifMatchHeader !== null && expectedRevisionId === null) {
    return jsonError(400, "If-Match header must not be empty");
  }

  const owned = await requireOwnedDoc(req, slug);
  if (!owned.ok) return owned.response;
  const { auth, doc } = owned;

  if (
    expectedRevisionId !== null &&
    doc.currentRevisionId !== expectedRevisionId
  ) {
    return new Response(
      JSON.stringify({
        error: "revision_mismatch",
        currentRevisionId: doc.currentRevisionId,
      }),
      { status: 412, headers: { "content-type": "application/json" } },
    );
  }

  const result = apply(doc.content, parsed.ops);
  if (!result.ok) {
    return new Response(JSON.stringify(applierErrorBody(result.error, result.failedAt)), {
      status: 409,
      headers: { "content-type": "application/json" },
    });
  }

  if (Buffer.byteLength(result.content, "utf8") > MAX_BYTES) {
    return jsonError(413, "Content exceeds 1MB limit");
  }

  if (dryRun) {
    // setContent re-derives title from the new H1; mirror that here so the
    // preview matches what a real call would persist.
    const isSetContent =
      parsed.ops.length === 1 && parsed.ops[0]!.type === "setContent";
    const previewTitle = isSetContent
      ? resolveTitle(result.content, undefined)
      : resolveTitle(result.content, doc.title);
    return new Response(
      JSON.stringify({
        doc: {
          id: doc.id,
          slug: doc.slug,
          title: previewTitle,
          kind: doc.kind,
          tags: doc.tags,
          content: result.content,
          createdAt: doc.createdAt,
          updatedAt: doc.updatedAt,
        },
        revisionId: null,
        dryRun: true,
      }),
      { status: 200, headers: { "content-type": "application/json" } },
    );
  }

  // No-op short-circuit: skip the chokepoint write so a no-op batch doesn't
  // burn a retention slot. Mirrors the PATCH route's same-content guard.
  if (result.content === doc.content) {
    return new Response(
      JSON.stringify({
        doc: {
          id: doc.id,
          slug: doc.slug,
          title: doc.title,
          kind: doc.kind,
          tags: doc.tags,
          content: doc.content,
          createdAt: doc.createdAt,
          updatedAt: doc.updatedAt,
        },
        revisionId: null,
      }),
      { status: 200, headers: { "content-type": "application/json" } },
    );
  }

  // setContent is a "save as" — re-derive title from the new H1 like upload
  // does, so a fresh body doesn't keep an unrelated old title. For partial
  // edits, preserve the existing title (resolveTitle with the old title as
  // override is idempotent unless the H1 string itself changed).
  const isSetContent =
    parsed.ops.length === 1 && parsed.ops[0]!.type === "setContent";
  const newTitle = isSetContent
    ? resolveTitle(result.content, undefined)
    : resolveTitle(result.content, doc.title);

  const writeResult = await writeDocContent({
    docId: doc.id,
    newContent: result.content,
    newTitle,
    newSearchText: stripMarkdown(result.content),
    summary,
    source: "agent",
    ownerId: auth.ownerId,
    expectedRevisionId: expectedRevisionId ?? undefined,
  });
  if (!writeResult.ok) {
    return new Response(
      JSON.stringify({
        error: "revision_mismatch",
        currentRevisionId: writeResult.currentRevisionId,
      }),
      { status: 412, headers: { "content-type": "application/json" } },
    );
  }

  revalidatePath("/");
  revalidatePath(`/v/${slug}`);

  return new Response(
    JSON.stringify({
      doc: {
        id: writeResult.doc.id,
        slug: writeResult.doc.slug,
        title: writeResult.doc.title,
        kind: writeResult.doc.kind,
        tags: writeResult.doc.tags,
        content: writeResult.doc.content,
        createdAt: writeResult.doc.createdAt,
        updatedAt: writeResult.doc.updatedAt,
      },
      revisionId: writeResult.revisionId,
    }),
    { status: 200, headers: { "content-type": "application/json" } },
  );
}
