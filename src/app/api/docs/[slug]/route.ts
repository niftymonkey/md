import { NextRequest } from "next/server";
import { requireAuth } from "@/lib/auth";
import { deleteDocBySlug } from "@/lib/db";

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
  const deleted = await deleteDocBySlug(slug);
  if (!deleted) {
    return jsonError(404, "Document not found");
  }
  return new Response(null, { status: 204 });
}
