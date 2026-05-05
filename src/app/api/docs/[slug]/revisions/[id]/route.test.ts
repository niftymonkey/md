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

const TEST_OWNER = "__test_revision_id_route__";

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

function getReq(slug: string, id: string, token: string) {
  const url = `http://localhost/api/docs/${slug}/revisions/${id}`;
  const req = new NextRequest(url, {
    method: "GET",
    headers: { authorization: `Bearer ${token}` },
  });
  return GET(req, { params: Promise.resolve({ slug, id }) });
}

describe("GET /api/docs/[slug]/revisions/[id]", () => {
  it("returns full revision content for the owner", async () => {
    const { token, doc } = await setup("Before");
    const recorded = await RevisionLog.record({
      docId: doc.id,
      prevContent: "Before",
      nextContent: "After",
      summary: "edit",
      source: "manual",
      ownerId: TEST_OWNER,
    });

    const res = await getReq(doc.slug, recorded.externalId, token.plaintext);
    expect(res.status).toBe(200);
    const body = (await res.json()) as { content: string; summary: string };
    expect(body.content).toBe("Before");
    expect(body.summary).toBe("edit");
  });

  it("returns 404 for unknown revisionId", async () => {
    const { token, doc } = await setup("body");
    const res = await getReq(doc.slug, "rv_nope", token.plaintext);
    expect(res.status).toBe(404);
  });

  it("returns 404 when the bearer's owner doesn't match the doc owner", async () => {
    const { doc } = await setup("body", TEST_OWNER);
    const recorded = await RevisionLog.record({
      docId: doc.id,
      prevContent: "body",
      nextContent: "body2",
      summary: null,
      source: "manual",
      ownerId: TEST_OWNER,
    });
    const otherToken = await createApiToken(TEST_OWNER + "_other", "tok");
    const res = await getReq(
      doc.slug,
      recorded.externalId,
      otherToken.plaintext,
    );
    expect(res.status).toBe(404);
  });
});
