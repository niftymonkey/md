import { NextRequest } from "next/server";
import { requireAuth } from "@/lib/auth";
import { listTagUsage } from "@/lib/db";

function jsonError(status: number, message: string) {
  return new Response(JSON.stringify({ error: message }), {
    status,
    headers: { "content-type": "application/json" },
  });
}

export async function GET(req: NextRequest) {
  const auth = await requireAuth(req);
  if (!auth.authenticated) {
    return jsonError(auth.status, auth.reason);
  }
  const tags = await listTagUsage(auth.ownerId);
  return new Response(JSON.stringify({ tags }), {
    status: 200,
    headers: { "content-type": "application/json; charset=utf-8" },
  });
}
