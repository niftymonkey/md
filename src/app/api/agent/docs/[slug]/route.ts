import { NextRequest } from "next/server";
import { requireOwnedDoc } from "@/lib/route-helpers";
import { visibleLineCount } from "@/lib/operation-applier";

export async function GET(
  req: NextRequest,
  context: { params: Promise<{ slug: string }> },
) {
  const { slug } = await context.params;
  const owned = await requireOwnedDoc(req, slug);
  if (!owned.ok) return owned.response;
  const { doc } = owned;

  return new Response(
    JSON.stringify({
      id: doc.id,
      slug: doc.slug,
      title: doc.title,
      kind: doc.kind,
      tags: doc.tags,
      content: doc.content,
      // Surfaced so agents don't have to re-implement the line-count rule
      // (and don't get bit by trailing-newline off-by-ones when planning
      // line-addressed ops).
      lineCount: visibleLineCount(doc.content),
      // Optimistic-concurrency token. Echo this back in `If-Match` on the
      // next edit to ensure no other writer changed the doc in between.
      // null when the doc has never been edited since creation.
      revisionId: doc.currentRevisionId,
      createdAt: doc.createdAt,
      updatedAt: doc.updatedAt,
    }),
    {
      status: 200,
      headers: { "content-type": "application/json; charset=utf-8" },
    },
  );
}
