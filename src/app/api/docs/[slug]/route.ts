import { NextRequest } from "next/server";
import { revalidatePath } from "next/cache";
import { requireAuth } from "@/lib/auth";
import {
  deleteDocBySlug,
  getDocBySlug,
  updateDocBySlug,
  type UpdateDocFields,
} from "@/lib/db";
import { writeDocContent } from "@/lib/doc-mutation-path";
import type { RevisionSource } from "@/lib/revision-log";
import { resolveTitle } from "@/lib/title";
import { stripMarkdown } from "@/lib/strip-md";
import { parseKind } from "@/lib/kind";

const MAX_BYTES = 1024 * 1024;

function jsonError(status: number, message: string) {
  return new Response(JSON.stringify({ error: message }), {
    status,
    headers: { "content-type": "application/json" },
  });
}

export async function DELETE(
  req: NextRequest,
  context: { params: Promise<{ slug: string }> },
) {
  const auth = await requireAuth(req);
  if (!auth.authenticated) {
    return jsonError(auth.status, auth.reason);
  }

  const { slug } = await context.params;
  const deleted = await deleteDocBySlug(slug, auth.ownerId);
  if (!deleted) {
    // 404 covers both "doesn't exist" and "exists but you don't own it" — don't
    // leak existence to non-owners.
    return jsonError(404, "Document not found");
  }
  revalidatePath("/");
  revalidatePath(`/v/${slug}`);
  return new Response(null, { status: 204 });
}

type PatchInput = {
  content?: unknown;
  title?: unknown;
  kind?: unknown;
};

export async function PATCH(
  req: NextRequest,
  context: { params: Promise<{ slug: string }> },
) {
  const auth = await requireAuth(req);
  if (!auth.authenticated) {
    return jsonError(auth.status, auth.reason);
  }

  const { slug } = await context.params;

  const contentLength = req.headers.get("content-length");
  if (contentLength && parseInt(contentLength, 10) > MAX_BYTES) {
    return jsonError(413, "Content exceeds 1MB limit");
  }

  let body: PatchInput;
  try {
    body = (await req.json()) as PatchInput;
  } catch {
    return jsonError(400, "Invalid JSON body");
  }
  if (typeof body !== "object" || body === null) {
    return jsonError(400, "JSON body required");
  }

  const hasContent = body.content !== undefined;
  const hasTitle = body.title !== undefined;
  const hasKind = body.kind !== undefined;
  if (!hasContent && !hasTitle && !hasKind) {
    return jsonError(400, "At least one of content, title, or kind is required");
  }

  let nextContent: string | undefined;
  if (hasContent) {
    if (typeof body.content !== "string") {
      return jsonError(400, "content must be a string");
    }
    if (Buffer.byteLength(body.content, "utf8") > MAX_BYTES) {
      return jsonError(413, "Content exceeds 1MB limit");
    }
    if (!body.content.trim()) {
      return jsonError(400, "Content is empty");
    }
    nextContent = body.content;
  }

  let titleOverride: string | null | undefined;
  if (hasTitle) {
    if (body.title !== null && typeof body.title !== "string") {
      return jsonError(400, "title must be a string or null");
    }
    titleOverride = body.title as string | null;
  }

  let nextKind: string | null | undefined;
  if (hasKind) {
    const parsed = parseKind(body.kind);
    if (!parsed.ok) {
      return jsonError(400, parsed.error);
    }
    nextKind = parsed.value;
  }

  const existing = await getDocBySlug(slug);
  if (!existing || existing.ownerId !== auth.ownerId) {
    // 404 (not 403) on owner mismatch — don't leak existence to non-owners.
    return jsonError(404, "Document not found");
  }

  // Title resolution mirrors upload semantics: explicit override → first H1 → "Untitled".
  // Recompute when content changes (so the H1 stays in sync) or when the caller
  // sends a title (including null/empty to re-derive from H1).
  let nextTitle: string | undefined;
  if (hasContent || hasTitle) {
    const sourceContent = nextContent ?? existing.content;
    const explicit = hasTitle ? titleOverride : existing.title;
    nextTitle = resolveTitle(sourceContent, explicit);
  }

  let updated;
  if (hasContent && nextContent !== undefined) {
    // Route through DocMutationPath so the prior content is snapshotted as a
    // revision in the same transaction as the docs UPDATE.
    const source: RevisionSource = auth.via === "session" ? "manual" : "cli";
    const summary = auth.via === "session" ? "Manual edit" : null;
    const result = await writeDocContent({
      docId: existing.id,
      newContent: nextContent,
      newTitle: nextTitle,
      newSearchText: stripMarkdown(nextContent),
      newKind: hasKind ? (nextKind ?? null) : undefined,
      summary,
      source,
      ownerId: auth.ownerId,
    });
    updated = result.doc;
  } else {
    // Title-only and/or kind-only edits don't snapshot content; keep them on
    // the existing path that doesn't touch doc_revisions.
    const fields: UpdateDocFields = {};
    if (nextTitle !== undefined) fields.title = nextTitle;
    if (hasKind) fields.kind = nextKind ?? null;
    updated = await updateDocBySlug(slug, fields);
    if (!updated) {
      return jsonError(404, "Document not found");
    }
  }

  revalidatePath("/");
  revalidatePath(`/v/${slug}`);

  return new Response(
    JSON.stringify({
      id: updated.id,
      slug: updated.slug,
      title: updated.title,
      kind: updated.kind,
      content: updated.content,
      createdAt: updated.createdAt,
      updatedAt: updated.updatedAt,
    }),
    {
      status: 200,
      headers: { "content-type": "application/json; charset=utf-8" },
    },
  );
}
