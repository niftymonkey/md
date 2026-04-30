import { NextRequest } from "next/server";
import { requireSessionAuth } from "@/lib/auth";
import { revokeToken } from "@/lib/api-tokens";

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function jsonError(status: number, message: string) {
  return new Response(JSON.stringify({ error: message }), {
    status,
    headers: { "content-type": "application/json" },
  });
}

export async function DELETE(
  req: NextRequest,
  context: { params: Promise<{ id: string }> },
) {
  const auth = await requireSessionAuth(req);
  if (!auth.authenticated) return jsonError(auth.status, auth.reason);

  const { id } = await context.params;
  if (!UUID_RE.test(id)) return jsonError(404, "Token not found");

  const ok = await revokeToken(auth.ownerId, id);
  if (!ok) return jsonError(404, "Token not found");
  return new Response(null, { status: 204 });
}
