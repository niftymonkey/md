import { NextRequest } from "next/server";
import { requireAuth } from "@/lib/auth";
import { generateSlug } from "@/lib/slug";
import { resolveTitle } from "@/lib/title";
import { stripMarkdown } from "@/lib/strip-md";
import { insertDoc } from "@/lib/db";
import { parseKind } from "@/lib/kind";
import { jsonError } from "@/lib/route-helpers";

const MAX_BYTES = 1024 * 1024;
const MAX_SLUG_RETRIES = 5;

type CreateInput = {
  content?: unknown;
  title?: unknown;
  kind?: unknown;
};

function isUniqueViolation(err: unknown): boolean {
  return Boolean(
    err &&
      typeof err === "object" &&
      "code" in err &&
      (err as { code?: string }).code === "23505",
  );
}

export async function POST(req: NextRequest) {
  const auth = await requireAuth(req);
  if (!auth.authenticated) {
    return jsonError(auth.status, auth.reason);
  }

  const contentLength = req.headers.get("content-length");
  if (contentLength && parseInt(contentLength, 10) > MAX_BYTES) {
    return jsonError(413, "Content exceeds 1MB limit");
  }

  let body: CreateInput;
  try {
    body = (await req.json()) as CreateInput;
  } catch {
    return jsonError(400, "Invalid JSON body");
  }
  if (typeof body !== "object" || body === null) {
    return jsonError(400, "JSON body required");
  }
  if (typeof body.content !== "string") {
    return jsonError(400, "content must be a string");
  }
  if (Buffer.byteLength(body.content, "utf8") > MAX_BYTES) {
    return jsonError(413, "Content exceeds 1MB limit");
  }
  if (!body.content.trim()) {
    return jsonError(400, "Content is empty");
  }

  let titleOverride: string | undefined;
  if (body.title !== undefined) {
    if (typeof body.title !== "string") {
      return jsonError(400, "title must be a string");
    }
    titleOverride = body.title;
  }

  const kindResult = parseKind(body.kind);
  if (!kindResult.ok) {
    return jsonError(400, kindResult.error);
  }

  const title = resolveTitle(body.content, titleOverride);
  const searchText = stripMarkdown(body.content);

  let lastError: unknown;
  for (let attempt = 0; attempt < MAX_SLUG_RETRIES; attempt++) {
    const slug = generateSlug();
    try {
      const doc = await insertDoc({
        slug,
        ownerId: auth.ownerId,
        title,
        content: body.content,
        kind: kindResult.value,
        searchText,
      });
      const viewUrl = `${req.nextUrl.origin}/v/${doc.slug}`;
      return new Response(
        JSON.stringify({
          id: doc.id,
          slug: doc.slug,
          title: doc.title,
          kind: doc.kind,
          content: doc.content,
          viewUrl,
          createdAt: doc.createdAt,
          updatedAt: doc.updatedAt,
        }),
        { status: 201, headers: { "content-type": "application/json" } },
      );
    } catch (err) {
      if (isUniqueViolation(err)) {
        lastError = err;
        continue;
      }
      console.error("[agent.docs.create] insert failed", err);
      return jsonError(500, "Failed to save document");
    }
  }

  console.error("[agent.docs.create] slug collision retries exhausted", lastError);
  return jsonError(500, "Could not generate a unique slug");
}
