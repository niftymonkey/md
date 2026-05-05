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
  it("returns 200 with content and updatedAt for an owned doc", async () => {
    const { token, doc } = await setupAuthorizedDoc("# Hello\n\nbody\n", "Hi");
    const res = await getReq(doc.slug, token.plaintext);
    expect(res.status).toBe(200);
    const body = (await res.json()) as {
      slug: string;
      title: string;
      kind: string | null;
      content: string;
      updatedAt: string;
    };
    expect(body.slug).toBe(doc.slug);
    expect(body.title).toBe("Hi");
    expect(body.content).toBe("# Hello\n\nbody\n");
    expect(typeof body.updatedAt).toBe("string");
    expect(new Date(body.updatedAt).getTime()).toBeGreaterThan(0);
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
