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
  context: { params: Promise<{ slug: string }> },
) {
  const auth = await requireAuth(req);
  if (!auth.authenticated) {
    return jsonError(auth.status, auth.reason);
  }

  const { slug } = await context.params;
  const doc = await getDocBySlug(slug);
  if (!doc || doc.ownerId !== auth.ownerId) {
    return jsonError(404, "Document not found");
  }

  const url = new URL(req.url);
  const limitParam = url.searchParams.get("limit");
  const cursorParam = url.searchParams.get("cursor") ?? undefined;
  const limit = limitParam ? parseInt(limitParam, 10) : undefined;

  const result = await RevisionLog.list(doc.id, { limit, cursor: cursorParam });
  return new Response(
    JSON.stringify({
      revisions: result.revisions.map((r) => ({
        externalId: r.externalId,
        summary: r.summary,
        source: r.source,
        createdBy: r.createdBy,
        bytesAdded: r.bytesAdded,
        bytesRemoved: r.bytesRemoved,
        createdAt: r.createdAt,
      })),
      nextCursor: result.nextCursor,
    }),
    { status: 200, headers: { "content-type": "application/json" } },
  );
}
