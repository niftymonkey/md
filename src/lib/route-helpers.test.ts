import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { sql } from "@vercel/postgres";
import { createApiToken } from "./api-tokens";
import { insertDoc, type Doc } from "./db";
import { generateSlug } from "./slug";
import { stripMarkdown } from "./strip-md";

vi.mock("@workos-inc/authkit-nextjs", () => ({
  withAuth: vi.fn(async () => ({ user: null })),
}));

import { requireOwnedDoc } from "./route-helpers";

const TEST_OWNER = "__test_route_helpers__";
const OTHER_OWNER = "__test_route_helpers_other__";

beforeAll(() => {
  if (!process.env.POSTGRES_URL) {
    throw new Error("POSTGRES_URL not set — route-helpers tests need .env.local.");
  }
});

afterAll(async () => {
  await sql`DELETE FROM api_tokens WHERE owner_id = ${TEST_OWNER}`;
  await sql`DELETE FROM api_tokens WHERE owner_id = ${OTHER_OWNER}`;
  await sql`DELETE FROM docs WHERE owner_id = ${TEST_OWNER}`;
  await sql`DELETE FROM docs WHERE owner_id = ${OTHER_OWNER}`;
});

async function setup(ownerId: string): Promise<{ token: string; doc: Doc }> {
  const t = await createApiToken(ownerId, "test");
  const doc = await insertDoc({
    slug: generateSlug(),
    ownerId,
    title: "T",
    content: "body",
    kind: null,
    searchText: stripMarkdown("body"),
  });
  return { token: t.plaintext, doc };
}

function makeReq(token: string | null): Request {
  const headers = new Headers();
  if (token) headers.set("authorization", `Bearer ${token}`);
  return new Request("http://localhost/", { headers });
}

describe("requireOwnedDoc failure modes", () => {
  it("returns a 401 response when no auth is provided", async () => {
    const { doc } = await setup(TEST_OWNER);
    const result = await requireOwnedDoc(makeReq(null), doc.slug);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.response.status).toBe(401);
    }
  });

  it("returns a 404 response when the slug doesn't exist", async () => {
    const { token } = await setup(TEST_OWNER);
    const result = await requireOwnedDoc(makeReq(token), "no-such-slug");
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.response.status).toBe(404);
    }
  });

  it("returns a 404 response when the doc exists but the auth's owner doesn't match (no existence leak)", async () => {
    const { doc } = await setup(TEST_OWNER);
    const other = await setup(OTHER_OWNER);
    const result = await requireOwnedDoc(makeReq(other.token), doc.slug);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.response.status).toBe(404);
    }
  });
});

describe("requireOwnedDoc", () => {
  it("returns the auth and doc on the happy path (bearer-authed owner)", async () => {
    const { token, doc } = await setup(TEST_OWNER);
    const result = await requireOwnedDoc(makeReq(token), doc.slug);
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.auth.ownerId).toBe(TEST_OWNER);
      expect(result.auth.via).toBe("bearer");
      expect(result.doc.id).toBe(doc.id);
      expect(result.doc.slug).toBe(doc.slug);
    }
  });
});
