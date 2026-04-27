import { NextRequest } from "next/server";
import { requireAuth } from "@/lib/auth";
import { generateSlug } from "@/lib/slug";
import { resolveTitle } from "@/lib/title";
import { stripMarkdown } from "@/lib/strip-md";
import { insertDoc } from "@/lib/db";

const MAX_BYTES = 1024 * 1024;
const MAX_SLUG_RETRIES = 5;

type UploadInput = { content: string; title?: string };

function jsonError(status: number, message: string) {
  return new Response(JSON.stringify({ error: message }), {
    status,
    headers: { "content-type": "application/json" },
  });
}

async function parseBody(req: NextRequest): Promise<UploadInput | { error: { status: number; message: string } }> {
  const contentLength = req.headers.get("content-length");
  if (contentLength && parseInt(contentLength, 10) > MAX_BYTES) {
    return { error: { status: 413, message: "Content exceeds 1MB limit" } };
  }

  const contentType = req.headers.get("content-type")?.toLowerCase() ?? "";

  if (contentType.startsWith("application/json")) {
    let parsed: unknown;
    try {
      parsed = await req.json();
    } catch {
      return { error: { status: 400, message: "Invalid JSON body" } };
    }
    if (
      typeof parsed !== "object" ||
      parsed === null ||
      typeof (parsed as { content?: unknown }).content !== "string"
    ) {
      return { error: { status: 400, message: "JSON body must include 'content' string" } };
    }
    const body = parsed as UploadInput;
    if (Buffer.byteLength(body.content, "utf8") > MAX_BYTES) {
      return { error: { status: 413, message: "Content exceeds 1MB limit" } };
    }
    return body;
  }

  const text = await req.text();
  if (Buffer.byteLength(text, "utf8") > MAX_BYTES) {
    return { error: { status: 413, message: "Content exceeds 1MB limit" } };
  }
  const headerTitle = req.headers.get("x-title");
  return { content: text, title: headerTitle ?? undefined };
}

function buildViewUrl(req: NextRequest, slug: string): string {
  const origin = req.nextUrl.origin;
  return `${origin}/v/${slug}`;
}

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

  const parsed = await parseBody(req);
  if ("error" in parsed) {
    return jsonError(parsed.error.status, parsed.error.message);
  }

  const content = parsed.content;
  if (!content.trim()) {
    return jsonError(400, "Content is empty");
  }

  const title = resolveTitle(content, parsed.title);
  const searchText = stripMarkdown(content);

  let lastError: unknown;
  for (let attempt = 0; attempt < MAX_SLUG_RETRIES; attempt++) {
    const slug = generateSlug();
    try {
      const doc = await insertDoc({
        slug,
        ownerId: auth.ownerId,
        title,
        content,
        searchText,
      });
      const viewUrl = buildViewUrl(req, doc.slug);
      const accept = req.headers.get("accept")?.toLowerCase() ?? "";
      if (accept.includes("text/plain")) {
        return new Response(viewUrl + "\n", {
          status: 201,
          headers: { "content-type": "text/plain" },
        });
      }
      return new Response(
        JSON.stringify({
          id: doc.id,
          slug: doc.slug,
          title: doc.title,
          viewUrl,
          createdAt: doc.createdAt,
        }),
        {
          status: 201,
          headers: { "content-type": "application/json" },
        },
      );
    } catch (err) {
      if (isUniqueViolation(err)) {
        lastError = err;
        continue;
      }
      console.error("[upload] insert failed", err);
      return jsonError(500, "Failed to save document");
    }
  }

  console.error("[upload] slug collision retries exhausted", lastError);
  return jsonError(500, "Could not generate a unique slug");
}
