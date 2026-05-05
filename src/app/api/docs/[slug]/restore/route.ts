import { NextRequest } from "next/server";
import { revalidatePath } from "next/cache";
import { requireAuth } from "@/lib/auth";
import { getDocBySlug } from "@/lib/db";
import { writeDocContent } from "@/lib/doc-mutation-path";
import { resolveTitle } from "@/lib/title";
import { stripMarkdown } from "@/lib/strip-md";
import * as RevisionLog from "@/lib/revision-log";

function jsonError(status: number, message: string) {
  return new Response(JSON.stringify({ error: message }), {
    status,
    headers: { "content-type": "application/json" },
  });
}

type Body = { revisionId?: unknown };

export async function POST(
  req: NextRequest,
  context: { params: Promise<{ slug: string }> },
) {
  const auth = await requireAuth(req);
  if (!auth.authenticated) {
    return jsonError(auth.status, auth.reason);
  }

  let body: Body;
  try {
    body = (await req.json()) as Body;
  } catch {
    return jsonError(400, "Invalid JSON body");
  }
  if (
    !body ||
    typeof body !== "object" ||
    typeof body.revisionId !== "string" ||
    !body.revisionId
  ) {
    return jsonError(400, "revisionId is required");
  }

  const { slug } = await context.params;
  const doc = await getDocBySlug(slug);
  if (!doc || doc.ownerId !== auth.ownerId) {
    return jsonError(404, "Document not found");
  }

  const revision = await RevisionLog.get(doc.id, body.revisionId);
  if (!revision) {
    return jsonError(404, "Revision not found");
  }

  const result = await writeDocContent({
    docId: doc.id,
    newContent: revision.content,
    newTitle: resolveTitle(revision.content, null),
    newSearchText: stripMarkdown(revision.content),
    summary: `Restored from ${revision.externalId}`,
    source: "restore",
    ownerId: auth.ownerId,
  });

  revalidatePath("/");
  revalidatePath(`/v/${slug}`);

  return new Response(
    JSON.stringify({
      doc: {
        id: result.doc.id,
        slug: result.doc.slug,
        title: result.doc.title,
        kind: result.doc.kind,
        content: result.doc.content,
        createdAt: result.doc.createdAt,
        updatedAt: result.doc.updatedAt,
      },
      revisionId: result.revisionId,
    }),
    { status: 200, headers: { "content-type": "application/json" } },
  );
}
