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

const TEST_OWNER = "__test_agent_search__";
const OTHER_OWNER = "__test_agent_search_other__";

type Preview = { line: number; text: string };
type Match = { line: number; column: number; previewLines: Preview[] };
type DocRow = {
  slug: string;
  title: string;
  kind: string | null;
  tags: string[];
  matchCount: number;
  matches: Match[];
};
type Body = { docs: DocRow[] };

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

function makeDoc(
  content: string,
  opts: {
    title?: string;
    ownerId?: string;
    kind?: string | null;
    tags?: string[];
  } = {},
) {
  return insertDoc({
    slug: generateSlug(),
    ownerId: opts.ownerId ?? TEST_OWNER,
    title: opts.title ?? "Test",
    content,
    kind: opts.kind ?? null,
    tags: opts.tags,
    searchText: stripMarkdown(content),
  });
}

function getReq(
  params: Record<string, string>,
  token: string | null,
) {
  const headers: Record<string, string> = {};
  if (token) headers.authorization = `Bearer ${token}`;
  const url = `http://localhost/api/agent/search?${new URLSearchParams(params).toString()}`;
  const req = new NextRequest(url, { method: "GET", headers });
  return GET(req);
}

describe("GET /api/agent/search: happy path", () => {
  it("returns matching docs with per-match contexts", async () => {
    const token = await makeToken();
    const a = await makeDoc(
      [
        "intro line",
        "first happypathneedle here",
        "trailing line",
        "more body",
        "second happypathneedle there",
        "",
      ].join("\n"),
      { title: "Doc A" },
    );
    await makeDoc("nothing relevant\n", { title: "Doc B" });

    const res = await getReq({ q: "happypathneedle" }, token.plaintext);
    expect(res.status).toBe(200);
    const body = (await res.json()) as Body;

    const found = body.docs.find((d) => d.slug === a.slug);
    expect(found).toBeDefined();
    expect(found!.title).toBe("Doc A");
    expect(found!.matchCount).toBe(2);
    expect(found!.matches).toHaveLength(2);
    expect(found!.matches[0]!.line).toBe(2);
    expect(found!.matches[1]!.line).toBe(5);
    expect(
      found!.matches[0]!.previewLines.some((p) =>
        p.text.includes("happypathneedle"),
      ),
    ).toBe(true);
  });

  it("returns an empty docs array when nothing matches", async () => {
    const token = await makeToken();
    const res = await getReq(
      { q: "noresultsphraseunused999" },
      token.plaintext,
    );
    expect(res.status).toBe(200);
    const body = (await res.json()) as Body;
    expect(body.docs).toEqual([]);
  });

  it("returns kind and tags on each matching doc", async () => {
    const token = await makeToken();
    const a = await makeDoc("alpha kindtagsneedle body\n", {
      kind: "essay",
      tags: ["foo", "bar"],
    });
    const res = await getReq({ q: "kindtagsneedle" }, token.plaintext);
    const body = (await res.json()) as Body;
    const found = body.docs.find((d) => d.slug === a.slug)!;
    expect(found.kind).toBe("essay");
    expect(found.tags).toEqual(expect.arrayContaining(["foo", "bar"]));
  });

  it("caps matches per doc at 5 but reports the true matchCount", async () => {
    const token = await makeToken();
    const lines = Array.from(
      { length: 10 },
      (_, i) => `line ${i + 1} capneedle marker`,
    ).join("\n");
    const a = await makeDoc(lines + "\n");
    const res = await getReq({ q: "capneedle" }, token.plaintext);
    const body = (await res.json()) as Body;
    const found = body.docs.find((d) => d.slug === a.slug)!;
    expect(found.matchCount).toBe(10);
    expect(found.matches).toHaveLength(5);
  });
});

describe("GET /api/agent/search: scoping and filtering", () => {
  it("only returns docs owned by the caller", async () => {
    const token = await makeToken();
    const mine = await makeDoc("alpha ownerscopedneedle mine\n");
    const theirs = await makeDoc("beta ownerscopedneedle theirs\n", {
      ownerId: OTHER_OWNER,
    });
    const res = await getReq({ q: "ownerscopedneedle" }, token.plaintext);
    const body = (await res.json()) as Body;
    const slugs = body.docs.map((d) => d.slug);
    expect(slugs).toContain(mine.slug);
    expect(slugs).not.toContain(theirs.slug);
  });

  it("excludes docs where FTS matches but the literal substring does not", async () => {
    const token = await makeToken();
    // FTS lowercases tokens; findMatches is case-sensitive. A doc that only
    // contains the capitalized form should NOT appear when searching for the
    // lowercase form.
    const capOnly = await makeDoc("CapsLiteralNeedle word here\n");
    const lowerExact = await makeDoc("capsliteralneedle word here\n");
    const res = await getReq({ q: "capsliteralneedle" }, token.plaintext);
    const body = (await res.json()) as Body;
    const slugs = body.docs.map((d) => d.slug);
    expect(slugs).toContain(lowerExact.slug);
    expect(slugs).not.toContain(capOnly.slug);
  });

  it("honors the limit query parameter", async () => {
    const token = await makeToken();
    for (let i = 0; i < 4; i++) {
      await makeDoc(`limitparamneedle entry ${i}\n`);
    }
    const res = await getReq(
      { q: "limitparamneedle", limit: "2" },
      token.plaintext,
    );
    const body = (await res.json()) as Body;
    expect(body.docs.length).toBeLessThanOrEqual(2);
  });
});

describe("GET /api/agent/search: validation and auth", () => {
  it("returns 400 when q is missing", async () => {
    const token = await makeToken();
    const res = await getReq({}, token.plaintext);
    expect(res.status).toBe(400);
  });

  it("returns 400 when q is empty or whitespace only", async () => {
    const token = await makeToken();
    expect((await getReq({ q: "" }, token.plaintext)).status).toBe(400);
    expect((await getReq({ q: "   " }, token.plaintext)).status).toBe(400);
  });

  it("returns 401 when unauthenticated", async () => {
    const res = await getReq({ q: "anything" }, null);
    expect(res.status).toBe(401);
  });
});
