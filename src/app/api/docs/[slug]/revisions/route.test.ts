import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
import { sql } from "@vercel/postgres";
import { createApiToken } from "@/lib/api-tokens";
import { insertDoc, type Doc } from "@/lib/db";
import { generateSlug } from "@/lib/slug";
import { stripMarkdown } from "@/lib/strip-md";
import * as RevisionLog from "@/lib/revision-log";

vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("@workos-inc/authkit-nextjs", () => ({
  withAuth: vi.fn(async () => ({ user: null })),
}));

import { GET } from "./route";

const TEST_OWNER = "__test_revisions_route__";

beforeAll(() => {
  if (!process.env.POSTGRES_URL) {
    throw new Error("POSTGRES_URL not set — route tests need .env.local.");
  }
});

afterAll(async () => {
  await sql`DELETE FROM api_tokens WHERE owner_id = ${TEST_OWNER}`;
  await sql`DELETE FROM api_tokens WHERE owner_id = ${TEST_OWNER + "_other"}`;
  await sql`DELETE FROM docs WHERE owner_id = ${TEST_OWNER}`;
  await sql`DELETE FROM docs WHERE owner_id = ${TEST_OWNER + "_other"}`;
});

async function setup(content: string, ownerId = TEST_OWNER) {
  const token = await createApiToken(ownerId, "test");
  const doc: Doc = await insertDoc({
    slug: generateSlug(),
    ownerId,
    title: "T",
    content,
    kind: null,
    searchText: stripMarkdown(content),
  });
  return { token, doc };
}

function getReq(slug: string, token: string, search = "") {
  const url = `http://localhost/api/docs/${slug}/revisions${search}`;
  const req = new NextRequest(url, {
    method: "GET",
    headers: { authorization: `Bearer ${token}` },
  });
  return GET(req, { params: Promise.resolve({ slug }) });
}

describe("GET /api/docs/[slug]/revisions security", () => {
  it("returns 404 when the bearer token's owner doesn't match the doc owner", async () => {
    const { doc } = await setup("v0", TEST_OWNER); // owned by TEST_OWNER
    const otherToken = await createApiToken(TEST_OWNER + "_other", "tok");
    const res = await getReq(doc.slug, otherToken.plaintext);
    expect(res.status).toBe(404);
  });
});

describe("GET /api/docs/[slug]/revisions", () => {
  it("returns the revisions list for the doc owner, newest-first", async () => {
    const { token, doc } = await setup("v0");
    await RevisionLog.record({
      docId: doc.id,
      prevContent: "v0",
      nextContent: "v1",
      summary: "first",
      source: "manual",
      ownerId: TEST_OWNER,
    });
    await RevisionLog.record({
      docId: doc.id,
      prevContent: "v1",
      nextContent: "v2",
      summary: "second",
      source: "manual",
      ownerId: TEST_OWNER,
    });

    const res = await getReq(doc.slug, token.plaintext);
    expect(res.status).toBe(200);
    const body = (await res.json()) as {
      revisions: Array<{ summary: string }>;
      nextCursor: string | null;
    };
    expect(body.revisions.map((r) => r.summary)).toEqual(["second", "first"]);
    expect(body.nextCursor).toBeNull();
  });
});
