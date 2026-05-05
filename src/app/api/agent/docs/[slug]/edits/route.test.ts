import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
import { sql } from "@vercel/postgres";
import { createApiToken } from "@/lib/api-tokens";
import { insertDoc } from "@/lib/db";
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

const TEST_OWNER = "__test_agent_edits__";

beforeAll(() => {
  if (!process.env.POSTGRES_URL) {
    throw new Error("POSTGRES_URL not set — route tests need .env.local.");
  }
});

afterAll(async () => {
  await sql`DELETE FROM api_tokens WHERE owner_id = ${TEST_OWNER}`;
  await sql`DELETE FROM docs WHERE owner_id = ${TEST_OWNER}`;
});

async function setupAuthorizedDoc(content: string) {
  const token = await createApiToken(TEST_OWNER, "test");
  const doc = await insertDoc({
    slug: generateSlug(),
    ownerId: TEST_OWNER,
    title: "Test",
    content,
    kind: null,
    searchText: stripMarkdown(content),
  });
  return { token, doc };
}

function postReq(slug: string, body: unknown, token: string | null) {
  const headers: Record<string, string> = { "content-type": "application/json" };
  if (token) headers.authorization = `Bearer ${token}`;
  const req = new NextRequest(
    `http://localhost/api/agent/docs/${slug}/edits`,
    { method: "POST", headers, body: JSON.stringify(body) },
  );
  return POST(req, { params: Promise.resolve({ slug }) });
}

describe("POST /api/agent/docs/[slug]/edits — happy path", () => {
  it("applies a replace op, updates content, and records an agent revision", async () => {
    const { token, doc } = await setupAuthorizedDoc("hello foo world\n");
    const res = await postReq(
      doc.slug,
      { ops: [{ type: "replace", find: "foo", replace: "bar" }] },
      token.plaintext,
    );
    expect(res.status).toBe(200);
    const body = (await res.json()) as {
      doc: { content: string; slug: string };
      revisionId: string;
    };
    expect(body.doc.content).toBe("hello bar world\n");
    expect(body.doc.slug).toBe(doc.slug);
    expect(body.revisionId).toMatch(/^rv_/);

    const listed = await RevisionLog.list(doc.id);
    expect(listed.revisions).toHaveLength(1);
    expect(listed.revisions[0]?.source).toBe("agent");
  });

  it("applies a batch of ops atomically", async () => {
    const { token, doc } = await setupAuthorizedDoc(
      "one\ntwo\nthree\nfour\n",
    );
    const res = await postReq(
      doc.slug,
      {
        ops: [
          { type: "deleteLineRange", from: 2, to: 2 },
          { type: "insertAfterLine", line: 4, content: "five" },
        ],
      },
      token.plaintext,
    );
    expect(res.status).toBe(200);
    const body = (await res.json()) as { doc: { content: string } };
    expect(body.doc.content).toBe("one\nthree\nfour\nfive\n");
  });

  it("does NOT record a revision when applied ops produce content identical to the input", async () => {
    // This shouldn't happen in practice, but the route must preserve the same
    // no-op invariant the existing PATCH route enforces (see #45 review fix).
    const { token, doc } = await setupAuthorizedDoc("foo bar\n");
    const res = await postReq(
      doc.slug,
      { ops: [{ type: "replace", find: "foo", replace: "foo" }] },
      token.plaintext,
    );
    expect(res.status).toBe(200);
    const listed = await RevisionLog.list(doc.id);
    expect(listed.revisions).toHaveLength(0);
  });
});

describe("POST /api/agent/docs/[slug]/edits — auth and shape errors", () => {
  it("returns 401 when no auth is provided", async () => {
    const { doc } = await setupAuthorizedDoc("x\n");
    const res = await postReq(
      doc.slug,
      { ops: [{ type: "replace", find: "x", replace: "y" }] },
      null,
    );
    expect(res.status).toBe(401);
  });

  it("returns 404 when the slug does not belong to the caller", async () => {
    const { token } = await setupAuthorizedDoc("x\n");
    // Make a doc owned by a different owner_id
    const otherSlug = generateSlug();
    await insertDoc({
      slug: otherSlug,
      ownerId: "__other_owner__",
      title: "Other",
      content: "z\n",
      kind: null,
      searchText: "z",
    });
    try {
      const res = await postReq(
        otherSlug,
        { ops: [{ type: "replace", find: "z", replace: "y" }] },
        token.plaintext,
      );
      expect(res.status).toBe(404);
    } finally {
      await sql`DELETE FROM docs WHERE owner_id = '__other_owner__'`;
    }
  });

  it("returns 400 for invalid JSON body", async () => {
    const { token, doc } = await setupAuthorizedDoc("x\n");
    const req = new NextRequest(
      `http://localhost/api/agent/docs/${doc.slug}/edits`,
      {
        method: "POST",
        headers: {
          "content-type": "application/json",
          authorization: `Bearer ${token.plaintext}`,
        },
        body: "{not json",
      },
    );
    const res = await POST(req, { params: Promise.resolve({ slug: doc.slug }) });
    expect(res.status).toBe(400);
  });

  it("returns 400 when ops is missing", async () => {
    const { token, doc } = await setupAuthorizedDoc("x\n");
    const res = await postReq(doc.slug, {}, token.plaintext);
    expect(res.status).toBe(400);
  });

  it("returns 400 when ops is an empty array", async () => {
    const { token, doc } = await setupAuthorizedDoc("x\n");
    const res = await postReq(doc.slug, { ops: [] }, token.plaintext);
    expect(res.status).toBe(400);
  });

  it("returns 400 with op-index info when an op is malformed", async () => {
    const { token, doc } = await setupAuthorizedDoc("x\n");
    const res = await postReq(
      doc.slug,
      {
        ops: [
          { type: "replace", find: "x", replace: "y" },
          { type: "deleteLineRange", from: 5, to: 1 },
        ],
      },
      token.plaintext,
    );
    expect(res.status).toBe(400);
    const body = (await res.json()) as { error: string };
    expect(body.error).toMatch(/ops\[1\]|index 1/i);
  });
});

describe("POST /api/agent/docs/[slug]/edits — structured 409 errors", () => {
  it("returns 409 with matchCount and previewLines when a query is ambiguous", async () => {
    const content = "foo line one\nfoo line two\n";
    const { token, doc } = await setupAuthorizedDoc(content);
    const res = await postReq(
      doc.slug,
      { ops: [{ type: "replace", find: "foo", replace: "bar" }] },
      token.plaintext,
    );
    expect(res.status).toBe(409);
    const body = (await res.json()) as {
      error: string;
      failedAt: number;
      matchCount: number;
      matches: {
        line: number;
        column: number;
        previewLines: { line: number; text: string }[];
      }[];
    };
    expect(body.error).toBe("ambiguous_match");
    expect(body.failedAt).toBe(0);
    expect(body.matchCount).toBe(2);
    expect(body.matches).toHaveLength(2);
    expect(body.matches[0]?.previewLines.length).toBeGreaterThan(0);

    const listed = await RevisionLog.list(doc.id);
    expect(listed.revisions).toHaveLength(0);
  });

  it("returns 409 with no_match when query is not found", async () => {
    const { token, doc } = await setupAuthorizedDoc("hello\n");
    const res = await postReq(
      doc.slug,
      { ops: [{ type: "replace", find: "missing", replace: "x" }] },
      token.plaintext,
    );
    expect(res.status).toBe(409);
    const body = (await res.json()) as { error: string; failedAt: number };
    expect(body.error).toBe("no_match");
    expect(body.failedAt).toBe(0);
  });

  it("returns 409 with line_out_of_range for invalid line numbers", async () => {
    const { token, doc } = await setupAuthorizedDoc("only one line\n");
    const res = await postReq(
      doc.slug,
      { ops: [{ type: "insertAfterLine", line: 99, content: "x" }] },
      token.plaintext,
    );
    expect(res.status).toBe(409);
    const body = (await res.json()) as { error: string; failedAt: number };
    expect(body.error).toBe("line_out_of_range");
    expect(body.failedAt).toBe(0);
  });
});

describe("POST /api/agent/docs/[slug]/edits — setContent", () => {
  it("rewrites the entire body and records an agent revision", async () => {
    const { token, doc } = await setupAuthorizedDoc("# Old\n\nbody\n");
    const res = await postReq(
      doc.slug,
      {
        ops: [{ type: "setContent", content: "# New\n\nbody2\n" }],
        summary: "full save",
      },
      token.plaintext,
    );
    expect(res.status).toBe(200);
    const body = (await res.json()) as {
      doc: { content: string };
      revisionId: string;
    };
    expect(body.doc.content).toBe("# New\n\nbody2\n");
    expect(body.revisionId).toMatch(/^rv_/);

    const listed = await RevisionLog.list(doc.id);
    expect(listed.revisions).toHaveLength(1);
    expect(listed.revisions[0]?.source).toBe("agent");
  });

  it("re-derives title from the new H1 (matches upload semantics)", async () => {
    const { token, doc } = await setupAuthorizedDoc("# Old H1\n\nbody\n");
    const res = await postReq(
      doc.slug,
      { ops: [{ type: "setContent", content: "# Brand New H1\n\nfresh\n" }] },
      token.plaintext,
    );
    expect(res.status).toBe(200);
    const body = (await res.json()) as { doc: { title: string } };
    expect(body.doc.title).toBe("Brand New H1");
  });

  it("rejects setContent mixed with other ops", async () => {
    const { token, doc } = await setupAuthorizedDoc("a\n");
    const res = await postReq(
      doc.slug,
      {
        ops: [
          { type: "setContent", content: "x" },
          { type: "replace", find: "a", replace: "b" },
        ],
      },
      token.plaintext,
    );
    expect(res.status).toBe(400);
  });
});

describe("POST /api/agent/docs/[slug]/edits — to: -1 sentinel", () => {
  it("replaceLineRange from: 1, to: -1 replaces the whole doc in one call", async () => {
    const { token, doc } = await setupAuthorizedDoc(
      "old line 1\nold line 2\nold line 3\n",
    );
    const res = await postReq(
      doc.slug,
      {
        ops: [
          {
            type: "replaceLineRange",
            from: 1,
            to: -1,
            content: "brand new body",
          },
        ],
        summary: "replace via -1 sentinel",
      },
      token.plaintext,
    );
    expect(res.status).toBe(200);
    const body = (await res.json()) as { doc: { content: string } };
    expect(body.doc.content).toBe("brand new body\n");
  });
});

describe("POST /api/agent/docs/[slug]/edits — content size limit", () => {
  it("rejects ops that would push content past 1 MB", async () => {
    const { token, doc } = await setupAuthorizedDoc("seed\n");
    const huge = "x".repeat(1024 * 1024 + 10);
    const res = await postReq(
      doc.slug,
      {
        ops: [
          { type: "replace", find: "seed", replace: huge },
        ],
      },
      token.plaintext,
    );
    expect(res.status).toBe(413);
  });
});
