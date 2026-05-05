import { NextRequest } from "next/server";
import { requireAuth } from "@/lib/auth";
import { getDocBySlug } from "@/lib/db";
import * as RevisionLog from "@/lib/revision-log";

function jsonError(status: number, message: string) {
  return new Response(JSON.stringify({ error: message }), {
    status,
    headers: { "content-type": "application/json" },
  });
}

export async function GET(
  req: NextRequest,
  context: { params: Promise<{ slug: string; id: string }> },
) {
  const auth = await requireAuth(req);
  if (!auth.authenticated) {
    return jsonError(auth.status, auth.reason);
  }

  const { slug, id } = await context.params;
  const doc = await getDocBySlug(slug);
  if (!doc || doc.ownerId !== auth.ownerId) {
    return jsonError(404, "Document not found");
  }

  const revision = await RevisionLog.get(doc.id, id);
  if (!revision) {
    return jsonError(404, "Revision not found");
  }

  return new Response(
    JSON.stringify({
      externalId: revision.externalId,
      content: revision.content,
      summary: revision.summary,
      source: revision.source,
      createdBy: revision.createdBy,
      bytesAdded: revision.bytesAdded,
      bytesRemoved: revision.bytesRemoved,
      createdAt: revision.createdAt,
    }),
    { status: 200, headers: { "content-type": "application/json" } },
  );
}
