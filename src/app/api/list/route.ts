import { NextRequest } from "next/server";
import { requireAuth } from "@/lib/auth";
import { listDocs } from "@/lib/db";
import { parseKind } from "@/lib/kind";
import { parseTagsFilter } from "@/lib/tags";

function jsonError(status: number, message: string) {
  return new Response(JSON.stringify({ error: message }), {
    status,
    headers: { "content-type": "application/json" },
  });
}

function parseLimit(raw: string | null): number {
  if (!raw) return 20;
  const n = Number.parseInt(raw, 10);
  if (!Number.isFinite(n) || n <= 0) return 20;
  return Math.min(100, n);
}

export async function GET(req: NextRequest) {
  const auth = await requireAuth(req);
  if (!auth.authenticated) {
    return jsonError(auth.status, auth.reason);
  }

  const { searchParams } = req.nextUrl;
  const limit = parseLimit(searchParams.get("limit"));
  const cursor = searchParams.get("cursor") ?? undefined;
  const search = searchParams.get("search") ?? undefined;

  const kindParam = searchParams.get("kind");
  const kindResult = parseKind(kindParam);
  if (!kindResult.ok) {
    return jsonError(400, kindResult.error);
  }

  const tagsParam = searchParams.get("tags");
  const tagsResult = parseTagsFilter(tagsParam);
  if (!tagsResult.ok) {
    return jsonError(400, tagsResult.error);
  }

  const result = await listDocs({
    ownerId: auth.ownerId,
    limit,
    cursor,
    search,
    kind: kindResult.value ?? undefined,
    tags: tagsResult.value.length > 0 ? tagsResult.value : undefined,
  });

  return new Response(
    JSON.stringify({
      docs: result.docs.map((d) => ({
        id: d.id,
        slug: d.slug,
        title: d.title,
        kind: d.kind,
        tags: d.tags,
        createdAt: d.createdAt,
      })),
      nextCursor: result.nextCursor,
    }),
    {
      status: 200,
      headers: { "content-type": "application/json; charset=utf-8" },
    },
  );
}
