import { NextRequest } from "next/server";
import * as RevisionLog from "@/lib/revision-log";
import { jsonError, requireOwnedDoc } from "@/lib/route-helpers";

export async function GET(
  req: NextRequest,
  context: { params: Promise<{ slug: string; id: string }> },
) {
  const { slug, id } = await context.params;
  const owned = await requireOwnedDoc(req, slug);
  if (!owned.ok) return owned.response;
  const { doc } = owned;

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
