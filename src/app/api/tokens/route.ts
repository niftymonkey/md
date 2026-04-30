import { NextRequest } from "next/server";
import { requireSessionAuth } from "@/lib/auth";
import { createApiToken, listTokensForOwner } from "@/lib/api-tokens";

const NAME_MAX = 64;

function jsonError(status: number, message: string) {
  return new Response(JSON.stringify({ error: message }), {
    status,
    headers: { "content-type": "application/json" },
  });
}

function jsonOk(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json; charset=utf-8" },
  });
}

export async function GET(req: NextRequest) {
  const auth = await requireSessionAuth(req);
  if (!auth.authenticated) return jsonError(auth.status, auth.reason);

  const tokens = await listTokensForOwner(auth.ownerId);
  return jsonOk({
    tokens: tokens.map((t) => ({
      id: t.id,
      name: t.name,
      prefix: t.prefix,
      createdAt: t.createdAt,
      lastUsedAt: t.lastUsedAt,
    })),
  });
}

export async function POST(req: NextRequest) {
  const auth = await requireSessionAuth(req);
  if (!auth.authenticated) return jsonError(auth.status, auth.reason);

  let payload: unknown;
  try {
    payload = await req.json();
  } catch {
    return jsonError(400, "Body must be JSON");
  }

  if (typeof payload !== "object" || payload === null) {
    return jsonError(400, "Body must be a JSON object");
  }
  const name = (payload as { name?: unknown }).name;
  if (typeof name !== "string") {
    return jsonError(400, "`name` is required");
  }
  const trimmed = name.trim();
  if (!trimmed) {
    return jsonError(400, "`name` cannot be empty");
  }
  if (trimmed.length > NAME_MAX) {
    return jsonError(400, `\`name\` is over ${NAME_MAX} characters`);
  }

  const created = await createApiToken(auth.ownerId, trimmed);
  return jsonOk(
    {
      id: created.id,
      name: created.name,
      prefix: created.prefix,
      plaintext: created.plaintext,
      createdAt: created.createdAt,
    },
    201,
  );
}
