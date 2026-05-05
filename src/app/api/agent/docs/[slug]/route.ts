import { NextRequest } from "next/server";
import { requireOwnedDoc } from "@/lib/route-helpers";

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
      content: doc.content,
      createdAt: doc.createdAt,
      updatedAt: doc.updatedAt,
    }),
    {
      status: 200,
      headers: { "content-type": "application/json; charset=utf-8" },
    },
  );
}
