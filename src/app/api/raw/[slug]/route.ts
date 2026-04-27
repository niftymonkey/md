import { NextRequest } from "next/server";
import { getDocBySlug } from "@/lib/db";

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
  const { slug } = await context.params;
  const doc = await getDocBySlug(slug);
  if (!doc) {
    return jsonError(404, "Document not found");
  }

  const accept = req.headers.get("accept")?.toLowerCase() ?? "";

  if (accept.includes("application/json")) {
    return new Response(
      JSON.stringify({
        slug: doc.slug,
        title: doc.title,
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

  return new Response(doc.content, {
    status: 200,
    headers: { "content-type": "text/markdown; charset=utf-8" },
  });
}
