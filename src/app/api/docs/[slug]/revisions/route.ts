import { NextRequest } from "next/server";
import * as RevisionLog from "@/lib/revision-log";
import { requireOwnedDoc } from "@/lib/route-helpers";

export async function GET(
  req: NextRequest,
  context: { params: Promise<{ slug: string }> },
) {
  const { slug } = await context.params;
  const owned = await requireOwnedDoc(req, slug);
  if (!owned.ok) return owned.response;
  const { doc } = owned;

  const url = new URL(req.url);
  const limitParam = url.searchParams.get("limit");
  const cursorParam = url.searchParams.get("cursor") ?? undefined;
  const limitParsed = limitParam ? parseInt(limitParam, 10) : NaN;
  const limit =
    Number.isFinite(limitParsed) && limitParsed > 0 ? limitParsed : undefined;

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
