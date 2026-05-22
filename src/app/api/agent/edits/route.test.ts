import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
import { sql } from "@vercel/postgres";
import { createApiToken } from "@/lib/api-tokens";
import { getDocBySlug, insertDoc } from "@/lib/db";
import { generateSlug } from "@/lib/slug";
import { stripMarkdown } from "@/lib/strip-md";
import * as RevisionLog from "@/lib/revision-log";

vi.mock("next/cache", () => ({
  revalidatePath: vi.fn(),
}));

vi.mock("@workos-inc/authkit-nextjs", () => ({
  withAuth: vi.fn(async () => ({ user: null })),
}));

import { POST } from "./route";

const TEST_OWNER = "__test_agent_batch__";
const OTHER_OWNER = "__test_agent_batch_other__";

type ResultRow = {
  slug: string;
  status: "ok" | "error";
  error?: string;
  failedAt?: number;
  revisionId?: string | null;
  doc?: { content: string; title: string };
};
type Body = { results: ResultRow[]; dryRun?: boolean };

beforeAll(() => {
  if (!process.env.POSTGRES_URL) {
    throw new Error("POSTGRES_URL not set: route tests need .env.local.");
  }
});

afterAll(async () => {
  await sql`DELETE FROM api_tokens WHERE owner_id = ${TEST_OWNER}`;
  await sql`DELETE FROM docs WHERE owner_id = ${TEST_OWNER}`;
  await sql`DELETE FROM docs WHERE owner_id = ${OTHER_OWNER}`;
});

function makeToken() {
  return createApiToken(TEST_OWNER, "test");
}

function makeDoc(content: string, ownerId: string = TEST_OWNER) {
  return insertDoc({
    slug: generateSlug(),
    ownerId,
    title: "Test",
    content,
    kind: null,
    searchText: stripMarkdown(content),
  });
}

function postReq(
  body: unknown,
  token: string | null,
  extraHeaders: Record<string, string> = {},
) {
  const headers: Record<string, string> = {
    "content-type": "application/json",
    ...extraHeaders,
  };
  if (token) headers.authorization = `Bearer ${token}`;
  const req = new NextRequest("http://localhost/api/agent/edits", {
    method: "POST",
    headers,
    body: JSON.stringify(body),
  });
  return POST(req);
}

function find(body: Body, slug: string): ResultRow {
  const row = body.results.find((r) => r.slug === slug);
  if (!row) throw new Error(`no result row for slug ${slug}`);
  return row;
}

describe("POST /api/agent/edits: happy path", () => {
  it("applies ops across multiple docs and records an agent revision per written doc", async () => {
    const token = await makeToken();
    const a = await makeDoc("alpha foo\n");
    const b = await makeDoc("beta foo\n");
    const res = await postReq(
      {
        operations: [
          { slug: a.slug, ops: [{ type: "replace", find: "foo", replace: "bar" }] },
          { slug: b.slug, ops: [{ type: "replace", find: "foo", replace: "baz" }] },
        ],
      },
      token.plaintext,
    );
    expect(res.status).toBe(200);
    const body = (await res.json()) as Body;
    expect(body.results).toHaveLength(2);

    const byA = find(body, a.slug);
    const byB = find(body, b.slug);
    expect(byA.status).toBe("ok");
    expect(byA.doc?.content).toBe("alpha bar\n");
    expect(byA.revisionId).toMatch(/^rv_/);
    expect(byB.status).toBe("ok");
    expect(byB.doc?.content).toBe("beta baz\n");

    const listedA = await RevisionLog.list(a.id);
    expect(listedA.revisions).toHaveLength(1);
    expect(listedA.revisions[0]?.source).toBe("agent");
  });

  it("applies the batch summary to every written doc's revision", async () => {
    const token = await makeToken();
    const a = await makeDoc("alpha foo\n");
    const res = await postReq(
      {
        operations: [
          { slug: a.slug, ops: [{ type: "replace", find: "foo", replace: "bar" }] },
        ],
        summary: "rename foo to bar",
      },
      token.plaintext,
    );
    expect(res.status).toBe(200);
    const listed = await RevisionLog.list(a.id);
    expect(listed.revisions[0]?.summary).toBe("rename foo to bar");
  });

  it("supports setContent per entry and re-derives the title from the new H1", async () => {
    const token = await makeToken();
    const a = await makeDoc("# Old\n\nbody\n");
    const res = await postReq(
      {
        operations: [
          {
            slug: a.slug,
            ops: [{ type: "setContent", content: "# Fresh Title\n\nnew body\n" }],
          },
        ],
      },
      token.plaintext,
    );
    expect(res.status).toBe(200);
    const byA = find((await res.json()) as Body, a.slug);
    expect(byA.status).toBe("ok");
    expect(byA.doc?.title).toBe("Fresh Title");
    expect(byA.doc?.content).toBe("# Fresh Title\n\nnew body\n");
  });

  it("does not record a revision for a doc whose ops produce identical content", async () => {
    const token = await makeToken();
    const a = await makeDoc("foo bar\n");
    const res = await postReq(
      {
        operations: [
          { slug: a.slug, ops: [{ type: "replace", find: "foo", replace: "foo" }] },
        ],
      },
      token.plaintext,
    );
    expect(res.status).toBe(200);
    const byA = find((await res.json()) as Body, a.slug);
    expect(byA.status).toBe("ok");
    expect(byA.revisionId).toBeNull();
    expect((await RevisionLog.list(a.id)).revisions).toHaveLength(0);
  });
});

describe("POST /api/agent/edits: per-doc isolation", () => {
  it("reports per-doc success and failure independently", async () => {
    const token = await makeToken();
    const a = await makeDoc("alpha foo\n");
    const b = await makeDoc("no match here\n");
    const res = await postReq(
      {
        operations: [
          { slug: a.slug, ops: [{ type: "replace", find: "foo", replace: "bar" }] },
          {
            slug: b.slug,
            ops: [{ type: "replace", find: "missing", replace: "x" }],
          },
        ],
      },
      token.plaintext,
    );
    expect(res.status).toBe(200);
    const body = (await res.json()) as Body;
    expect(find(body, a.slug).status).toBe("ok");
    expect(find(body, b.slug).status).toBe("error");
    expect(find(body, b.slug).error).toBe("no_match");

    // The successful doc landed even though its sibling failed.
    expect((await getDocBySlug(a.slug))?.content).toBe("alpha bar\n");
    expect((await getDocBySlug(b.slug))?.content).toBe("no match here\n");
    expect((await RevisionLog.list(b.id)).revisions).toHaveLength(0);
  });

  it("rolls back a whole doc's batch when one of its later ops fails", async () => {
    const token = await makeToken();
    const a = await makeDoc("one\ntwo\nthree\n");
    const res = await postReq(
      {
        operations: [
          {
            slug: a.slug,
            ops: [
              { type: "replace", find: "two", replace: "TWO" },
              { type: "insertAfterLine", line: 99, content: "x" },
            ],
          },
        ],
      },
      token.plaintext,
    );
    expect(res.status).toBe(200);
    const byA = find((await res.json()) as Body, a.slug);
    expect(byA.status).toBe("error");
    expect(byA.error).toBe("line_out_of_range");
    expect(byA.failedAt).toBe(1);
    // The earlier op did not partially apply.
    expect((await getDocBySlug(a.slug))?.content).toBe("one\ntwo\nthree\n");
  });

  it("returns a per-doc not_found error for an unknown slug", async () => {
    const token = await makeToken();
    const a = await makeDoc("alpha foo\n");
    const res = await postReq(
      {
        operations: [
          { slug: a.slug, ops: [{ type: "replace", find: "foo", replace: "bar" }] },
          {
            slug: "nonexistent-slug-xyz",
            ops: [{ type: "replace", find: "a", replace: "b" }],
          },
        ],
      },
      token.plaintext,
    );
    expect(res.status).toBe(200);
    const body = (await res.json()) as Body;
    expect(find(body, a.slug).status).toBe("ok");
    expect(find(body, "nonexistent-slug-xyz").status).toBe("error");
    expect(find(body, "nonexistent-slug-xyz").error).toBe("not_found");
  });

  it("returns a per-doc not_found error for a slug owned by someone else", async () => {
    const token = await makeToken();
    const mine = await makeDoc("alpha foo\n");
    const theirs = await makeDoc("their body\n", OTHER_OWNER);
    const res = await postReq(
      {
        operations: [
          {
            slug: mine.slug,
            ops: [{ type: "replace", find: "foo", replace: "bar" }],
          },
          {
            slug: theirs.slug,
            ops: [{ type: "replace", find: "their", replace: "hijacked" }],
          },
        ],
      },
      token.plaintext,
    );
    expect(res.status).toBe(200);
    const body = (await res.json()) as Body;
    expect(find(body, mine.slug).status).toBe("ok");
    expect(find(body, theirs.slug).error).toBe("not_found");
    // The other owner's doc was never touched.
    expect((await getDocBySlug(theirs.slug))?.content).toBe("their body\n");
  });

  it("returns a per-doc content_too_large error without blocking sibling docs", async () => {
    const token = await makeToken();
    const a = await makeDoc("alpha seed\n");
    const b = await makeDoc("beta foo\n");
    const huge = "x".repeat(1024 * 1024 + 10);
    const res = await postReq(
      {
        operations: [
          { slug: a.slug, ops: [{ type: "replace", find: "seed", replace: huge }] },
          { slug: b.slug, ops: [{ type: "replace", find: "foo", replace: "bar" }] },
        ],
      },
      token.plaintext,
    );
    expect(res.status).toBe(200);
    const body = (await res.json()) as Body;
    expect(find(body, a.slug).error).toBe("content_too_large");
    expect(find(body, b.slug).status).toBe("ok");
    expect((await getDocBySlug(b.slug))?.content).toBe("beta bar\n");
  });
});

describe("POST /api/agent/edits: dryRun", () => {
  it("previews every doc without writing or recording revisions", async () => {
    const token = await makeToken();
    const a = await makeDoc("alpha foo\n");
    const b = await makeDoc("beta foo\n");
    const res = await postReq(
      {
        operations: [
          { slug: a.slug, ops: [{ type: "replace", find: "foo", replace: "bar" }] },
          { slug: b.slug, ops: [{ type: "replace", find: "foo", replace: "baz" }] },
        ],
        dryRun: true,
      },
      token.plaintext,
    );
    expect(res.status).toBe(200);
    const body = (await res.json()) as Body;
    expect(body.dryRun).toBe(true);

    const byA = find(body, a.slug);
    expect(byA.status).toBe("ok");
    expect(byA.doc?.content).toBe("alpha bar\n");
    expect(byA.revisionId).toBeNull();

    expect((await getDocBySlug(a.slug))?.content).toBe("alpha foo\n");
    expect((await getDocBySlug(b.slug))?.content).toBe("beta foo\n");
    expect((await RevisionLog.list(a.id)).revisions).toHaveLength(0);
  });

  it("reports per-doc errors in a dryRun without writing", async () => {
    const token = await makeToken();
    const a = await makeDoc("alpha foo\n");
    const res = await postReq(
      {
        operations: [
          {
            slug: a.slug,
            ops: [{ type: "replace", find: "missing", replace: "x" }],
          },
        ],
        dryRun: true,
      },
      token.plaintext,
    );
    expect(res.status).toBe(200);
    const byA = find((await res.json()) as Body, a.slug);
    expect(byA.status).toBe("error");
    expect(byA.error).toBe("no_match");
  });
});

describe("POST /api/agent/edits: auth and shape errors", () => {
  it("returns 401 when no auth is provided", async () => {
    const a = await makeDoc("x\n");
    const res = await postReq(
      {
        operations: [
          { slug: a.slug, ops: [{ type: "replace", find: "x", replace: "y" }] },
        ],
      },
      null,
    );
    expect(res.status).toBe(401);
  });

  it("returns 400 for invalid JSON body", async () => {
    const token = await makeToken();
    const req = new NextRequest("http://localhost/api/agent/edits", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        authorization: `Bearer ${token.plaintext}`,
      },
      body: "{not json",
    });
    const res = await POST(req);
    expect(res.status).toBe(400);
  });

  it("returns 400 when operations is missing", async () => {
    const token = await makeToken();
    const res = await postReq({}, token.plaintext);
    expect(res.status).toBe(400);
  });

  it("returns 400 when operations is an empty array", async () => {
    const token = await makeToken();
    const res = await postReq({ operations: [] }, token.plaintext);
    expect(res.status).toBe(400);
  });

  it("returns 400 with the entry index when an entry's ops are malformed", async () => {
    const token = await makeToken();
    const res = await postReq(
      {
        operations: [
          { slug: "aaa", ops: [{ type: "replace", find: "x", replace: "y" }] },
          { slug: "bbb", ops: [{ type: "deleteLineRange", from: 5, to: 1 }] },
        ],
      },
      token.plaintext,
    );
    expect(res.status).toBe(400);
    const body = (await res.json()) as { error: string };
    expect(body.error).toMatch(/operations\[1\]/);
  });

  it("returns 400 for a duplicate slug", async () => {
    const token = await makeToken();
    const res = await postReq(
      {
        operations: [
          { slug: "dup", ops: [{ type: "replace", find: "x", replace: "y" }] },
          { slug: "dup", ops: [{ type: "replace", find: "a", replace: "b" }] },
        ],
      },
      token.plaintext,
    );
    expect(res.status).toBe(400);
  });

  it("returns 400 when the batch exceeds the per-request doc cap", async () => {
    const token = await makeToken();
    const operations = Array.from({ length: 51 }, (_, i) => ({
      slug: `slug-${i}`,
      ops: [{ type: "replace", find: "x", replace: "y" }],
    }));
    const res = await postReq({ operations }, token.plaintext);
    expect(res.status).toBe(400);
  });

  it("returns 413 when the request declares a body larger than the cap", async () => {
    const token = await makeToken();
    const a = await makeDoc("seed\n");
    const res = await postReq(
      {
        operations: [
          { slug: a.slug, ops: [{ type: "replace", find: "seed", replace: "x" }] },
        ],
      },
      token.plaintext,
      { "content-length": String(5 * 1024 * 1024) },
    );
    expect(res.status).toBe(413);
  });
});
