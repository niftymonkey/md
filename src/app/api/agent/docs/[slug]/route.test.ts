import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
import { sql } from "@vercel/postgres";
import { createApiToken } from "@/lib/api-tokens";
import { insertDoc } from "@/lib/db";
import { generateSlug } from "@/lib/slug";
import { stripMarkdown } from "@/lib/strip-md";

vi.mock("@workos-inc/authkit-nextjs", () => ({
  withAuth: vi.fn(async () => ({ user: null })),
}));

import { GET } from "./route";

const TEST_OWNER = "__test_agent_get_doc__";

beforeAll(() => {
  if (!process.env.POSTGRES_URL) {
    throw new Error("POSTGRES_URL not set — route tests need .env.local.");
  }
});

afterAll(async () => {
  await sql`DELETE FROM api_tokens WHERE owner_id = ${TEST_OWNER}`;
  await sql`DELETE FROM docs WHERE owner_id = ${TEST_OWNER}`;
});

async function setupAuthorizedDoc(content: string, title = "Test") {
  const token = await createApiToken(TEST_OWNER, "test");
  const doc = await insertDoc({
    slug: generateSlug(),
    ownerId: TEST_OWNER,
    title,
    content,
    kind: null,
    searchText: stripMarkdown(content),
  });
  return { token, doc };
}

function getReq(slug: string, token: string | null) {
  const headers: Record<string, string> = {};
  if (token) headers.authorization = `Bearer ${token}`;
  const req = new NextRequest(`http://localhost/api/agent/docs/${slug}`, {
    method: "GET",
    headers,
  });
  return GET(req, { params: Promise.resolve({ slug }) });
}

describe("GET /api/agent/docs/[slug]", () => {
  it("returns 200 with content, updatedAt, and lineCount for an owned doc", async () => {
    const { token, doc } = await setupAuthorizedDoc("# Hello\n\nbody\n", "Hi");
    const res = await getReq(doc.slug, token.plaintext);
    expect(res.status).toBe(200);
    const body = (await res.json()) as {
      slug: string;
      title: string;
      kind: string | null;
      content: string;
      updatedAt: string;
      lineCount: number;
    };
    expect(body.slug).toBe(doc.slug);
    expect(body.title).toBe("Hi");
    expect(body.content).toBe("# Hello\n\nbody\n");
    expect(typeof body.updatedAt).toBe("string");
    expect(new Date(body.updatedAt).getTime()).toBeGreaterThan(0);
    // 3 visible lines: "# Hello", "", "body" (trailing newline doesn't count).
    expect(body.lineCount).toBe(3);
  });

  it("lineCount matches the applier's view (trailing newline irrelevant)", async () => {
    const { token, doc } = await setupAuthorizedDoc("a\nb\nc\n", "T");
    const res = await getReq(doc.slug, token.plaintext);
    const body = (await res.json()) as { lineCount: number };
    expect(body.lineCount).toBe(3);
  });

  it("lineCount is 0 for an empty doc", async () => {
    const { token, doc } = await setupAuthorizedDoc("", "Empty");
    const res = await getReq(doc.slug, token.plaintext);
    const body = (await res.json()) as { lineCount: number };
    expect(body.lineCount).toBe(0);
  });

  it("returns revisionId: null for a fresh doc with no revisions", async () => {
    const { token, doc } = await setupAuthorizedDoc("first\n", "Fresh");
    const res = await getReq(doc.slug, token.plaintext);
    const body = (await res.json()) as { revisionId: string | null };
    expect(body.revisionId).toBeNull();
  });

  it("returns the latest revision's external_id after an edit", async () => {
    const { token, doc } = await setupAuthorizedDoc("seed\n", "Edited");
    // Drive a write through the chokepoint so current_revision_id is set.
    const { writeDocContent } = await import("@/lib/doc-mutation-path");
    const write = await writeDocContent({
      docId: doc.id,
      newContent: "edited\n",
      newSearchText: "edited",
      summary: null,
      source: "agent",
      ownerId: TEST_OWNER,
    });
    if (!write.ok) throw new Error("setup write failed");

    const res = await getReq(doc.slug, token.plaintext);
    const body = (await res.json()) as { revisionId: string | null };
    expect(body.revisionId).toBe(write.revisionId);
    expect(body.revisionId).toMatch(/^rv_/);
  });

  it("returns 401 without auth", async () => {
    const { doc } = await setupAuthorizedDoc("x\n");
    const res = await getReq(doc.slug, null);
    expect(res.status).toBe(401);
  });

  it("returns 404 for a slug not owned by the caller", async () => {
    const { token } = await setupAuthorizedDoc("x\n");
    const otherSlug = generateSlug();
    await insertDoc({
      slug: otherSlug,
      ownerId: "__other_owner_get__",
      title: "Other",
      content: "y\n",
      kind: null,
      searchText: "y",
    });
    try {
      const res = await getReq(otherSlug, token.plaintext);
      expect(res.status).toBe(404);
    } finally {
      await sql`DELETE FROM docs WHERE owner_id = '__other_owner_get__'`;
    }
  });
});
