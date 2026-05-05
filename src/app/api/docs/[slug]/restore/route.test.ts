import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
import { sql } from "@vercel/postgres";
import { createApiToken } from "@/lib/api-tokens";
import { getDocBySlug, insertDoc, type Doc } from "@/lib/db";
import { generateSlug } from "@/lib/slug";
import { stripMarkdown } from "@/lib/strip-md";
import * as RevisionLog from "@/lib/revision-log";

vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("@workos-inc/authkit-nextjs", () => ({
  withAuth: vi.fn(async () => ({ user: null })),
}));

import { POST } from "./route";

const TEST_OWNER = "__test_restore_route__";

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

function postReq(slug: string, body: object, token: string) {
  const url = `http://localhost/api/docs/${slug}/restore`;
  const req = new NextRequest(url, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      authorization: `Bearer ${token}`,
    },
    body: JSON.stringify(body),
  });
  return POST(req, { params: Promise.resolve({ slug }) });
}

describe("POST /api/docs/[slug]/restore", () => {
  it("restores prior content and records the restore as a new revision", async () => {
    const { token, doc } = await setup("v0");
    // Snapshot v0 by editing through the chokepoint.
    const recorded = await RevisionLog.record({
      docId: doc.id,
      prevContent: "v0",
      nextContent: "v1",
      summary: "first edit",
      source: "manual",
      ownerId: TEST_OWNER,
    });
    // Pretend the doc has been advanced past v1.
    await sql`UPDATE docs SET content = 'v1' WHERE id = ${doc.id}`;

    const res = await postReq(
      doc.slug,
      { revisionId: recorded.externalId },
      token.plaintext,
    );
    expect(res.status).toBe(200);

    const persisted = await getDocBySlug(doc.slug);
    expect(persisted?.content).toBe("v0");

    const listed = await RevisionLog.list(doc.id);
    // Expect the original revision plus a new 'restore' revision capturing v1.
    expect(listed.revisions).toHaveLength(2);
    const newest = listed.revisions[0]!;
    expect(newest.source).toBe("restore");
    const restoreRev = await RevisionLog.get(doc.id, newest.externalId);
    expect(restoreRev?.content).toBe("v1");
  });

  it("returns 400 for missing revisionId", async () => {
    const { token, doc } = await setup("body");
    const res = await postReq(doc.slug, {}, token.plaintext);
    expect(res.status).toBe(400);
  });

  it("returns 404 for unknown revisionId", async () => {
    const { token, doc } = await setup("body");
    const res = await postReq(
      doc.slug,
      { revisionId: "rv_nope" },
      token.plaintext,
    );
    expect(res.status).toBe(404);
  });

  it("returns 404 when the bearer's owner doesn't match the doc owner", async () => {
    const { doc } = await setup("body", TEST_OWNER);
    const recorded = await RevisionLog.record({
      docId: doc.id,
      prevContent: "body",
      nextContent: "next",
      summary: null,
      source: "manual",
      ownerId: TEST_OWNER,
    });
    const otherToken = await createApiToken(TEST_OWNER + "_other", "tok");
    const res = await postReq(
      doc.slug,
      { revisionId: recorded.externalId },
      otherToken.plaintext,
    );
    expect(res.status).toBe(404);
  });
});
