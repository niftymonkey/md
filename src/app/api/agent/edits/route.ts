import { NextRequest } from "next/server";
import { revalidatePath } from "next/cache";
import { requireAuth } from "@/lib/auth";
import { getDocBySlug, type Doc } from "@/lib/db";
import { writeDocContent } from "@/lib/doc-mutation-path";
import { resolveTitle } from "@/lib/title";
import { stripMarkdown } from "@/lib/strip-md";
import { applierErrorBody, jsonError } from "@/lib/route-helpers";
import { parseDocEditBatch, type DocEditEntry } from "@/lib/edit-op-schema";
import { apply, type MatchPreview } from "@/lib/operation-applier";

/**
 * Ceiling on the declared request body. A batch legitimately carries several
 * documents, so this is larger than the 1 MB single-doc limit, while still
 * bounding how much one call asks the server to buffer.
 */
const MAX_REQUEST_BYTES = 4 * 1024 * 1024;

/** Per-document content ceiling, matching the single-doc edit/upload limit. */
const MAX_DOC_BYTES = 1024 * 1024;

/** Cap on documents per batch, bounding the DB round-trips one call triggers. */
const MAX_BATCH_DOCS = 50;

type AgentDocView = {
  id: string;
  slug: string;
  title: string;
  kind: string | null;
  tags: string[];
  content: string;
  createdAt: Date;
  updatedAt: Date;
};

/**
 * One document's outcome in a cross-document batch. Every variant carries the
 * `slug` so a caller can correlate it to the request entry; `status`
 * discriminates success from failure. Error variants mirror the single-doc
 * `/edits` failure bodies so agents parse both surfaces the same way.
 */
type DocResult =
  | { slug: string; status: "ok"; doc: AgentDocView; revisionId: string | null }
  | { slug: string; status: "error"; error: "not_found" }
  | { slug: string; status: "error"; error: "content_too_large" }
  | {
      slug: string;
      status: "error";
      error: "no_match";
      failedAt: number;
      query: string;
    }
  | {
      slug: string;
      status: "error";
      error: "ambiguous_match";
      failedAt: number;
      query: string;
      matchCount: number;
      matches: MatchPreview[];
    }
  | {
      slug: string;
      status: "error";
      error: "line_out_of_range";
      failedAt: number;
      line: number;
      documentLines: number;
    }
  | {
      slug: string;
      status: "error";
      error: "range_out_of_range";
      failedAt: number;
      from: number;
      to: number;
      documentLines: number;
    }
  | {
      slug: string;
      status: "error";
      error: "overlapping_line_ops";
      failedAt: number;
      conflictsWith: number;
    }
  | {
      slug: string;
      status: "error";
      error: "heading_not_found";
      failedAt: number;
      headingPath: string[];
    }
  | {
      slug: string;
      status: "error";
      error: "ambiguous_heading";
      failedAt: number;
      headingPath: string[];
      matchCount: number;
    };

type Body = { operations?: unknown; summary?: unknown; dryRun?: unknown };

type EntryOptions = {
  ownerId: string;
  summary: string | null;
  dryRun: boolean;
};

function toDocView(doc: Doc, title: string, content: string): AgentDocView {
  return {
    id: doc.id,
    slug: doc.slug,
    title,
    kind: doc.kind,
    tags: doc.tags,
    content,
    createdAt: doc.createdAt,
    updatedAt: doc.updatedAt,
  };
}

/**
 * Applies one document's ops and persists them. Per-document atomic: the ops
 * either all land in a single revision or none do. Resolves to a `DocResult`
 * for every outcome (including failures) so the caller can keep going and
 * report on sibling documents.
 */
async function applyEntry(
  entry: DocEditEntry,
  opts: EntryOptions,
): Promise<DocResult> {
  const { slug, ops } = entry;

  const doc = await getDocBySlug(slug);
  if (!doc || doc.ownerId !== opts.ownerId) {
    return { slug, status: "error", error: "not_found" };
  }

  const applied = apply(doc.content, ops);
  if (!applied.ok) {
    return {
      slug,
      status: "error",
      ...applierErrorBody(applied.error, applied.failedAt),
    };
  }

  if (Buffer.byteLength(applied.content, "utf8") > MAX_DOC_BYTES) {
    return { slug, status: "error", error: "content_too_large" };
  }

  // setContent is a "save as": re-derive the title from the new H1 the way
  // upload does. Every other op preserves the existing title.
  const isSetContent = ops.length === 1 && ops[0]!.type === "setContent";
  const nextTitle = isSetContent
    ? resolveTitle(applied.content, undefined)
    : resolveTitle(applied.content, doc.title);

  if (opts.dryRun) {
    return {
      slug,
      status: "ok",
      doc: toDocView(doc, nextTitle, applied.content),
      revisionId: null,
    };
  }

  // A batch that resolves to the existing content should not burn a retention
  // slot, mirroring the single-doc route's no-op short-circuit.
  if (applied.content === doc.content) {
    return {
      slug,
      status: "ok",
      doc: toDocView(doc, doc.title, doc.content),
      revisionId: null,
    };
  }

  const writeResult = await writeDocContent({
    docId: doc.id,
    newContent: applied.content,
    newTitle: nextTitle,
    newSearchText: stripMarkdown(applied.content),
    summary: opts.summary,
    source: "agent",
    ownerId: opts.ownerId,
  });
  if (!writeResult.ok) {
    throw new Error(
      `writeDocContent reported a revision mismatch for ${slug}; the cross-doc batch sends no expectedRevisionId, so this signals a broken invariant`,
    );
  }

  return {
    slug,
    status: "ok",
    doc: toDocView(writeResult.doc, writeResult.doc.title, writeResult.doc.content),
    revisionId: writeResult.revisionId,
  };
}

export async function POST(req: NextRequest) {
  const contentLength = req.headers.get("content-length");
  if (contentLength && parseInt(contentLength, 10) > MAX_REQUEST_BYTES) {
    return jsonError(413, "Request body exceeds 4MB limit");
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

  const parsed = parseDocEditBatch(body.operations);
  if (!parsed.ok) {
    return jsonError(400, parsed.error);
  }
  if (parsed.entries.length > MAX_BATCH_DOCS) {
    return jsonError(
      400,
      `operations may include at most ${MAX_BATCH_DOCS} documents per batch`,
    );
  }

  const auth = await requireAuth(req);
  if (!auth.authenticated) {
    return jsonError(auth.status, auth.reason);
  }

  // Per-document atomic, batch best-effort: each entry runs through its own
  // OperationApplier pass and DocMutationPath transaction. A failure on one
  // document does not roll back or block the others.
  const opts: EntryOptions = { ownerId: auth.ownerId, summary, dryRun };
  const results: DocResult[] = [];
  for (const entry of parsed.entries) {
    results.push(await applyEntry(entry, opts));
  }

  // Revalidate only documents that actually changed. dryRun and no-op results
  // carry a null revisionId, so they fall out here naturally.
  const writtenSlugs = results
    .filter((r) => r.status === "ok" && r.revisionId !== null)
    .map((r) => r.slug);
  if (writtenSlugs.length > 0) {
    revalidatePath("/");
    for (const slug of writtenSlugs) {
      revalidatePath(`/v/${slug}`);
    }
  }

  const responseBody = dryRun ? { results, dryRun: true } : { results };
  return new Response(JSON.stringify(responseBody), {
    status: 200,
    headers: { "content-type": "application/json" },
  });
}
