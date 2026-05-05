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

// Stub the WorkOS authkit module so importing @/lib/auth doesn't pull in
// next/cache transitively from a path Vitest can't resolve.
vi.mock("@workos-inc/authkit-nextjs", () => ({
  withAuth: vi.fn(async () => ({ user: null })),
}));

import { PATCH } from "./route";

const TEST_OWNER = "__test_patch_route__";

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

function patchReq(slug: string, body: object, token: string) {
  const req = new NextRequest(`http://localhost/api/docs/${slug}`, {
    method: "PATCH",
    headers: {
      "content-type": "application/json",
      authorization: `Bearer ${token}`,
    },
    body: JSON.stringify(body),
  });
  return PATCH(req, { params: Promise.resolve({ slug }) });
}

describe("PATCH /api/docs/[slug] revision creation", () => {
  it("creates a revision capturing prior content when content changes (bearer → source: cli)", async () => {
    const { token, doc } = await setupAuthorizedDoc("# Before\n\nbody");
    const res = await patchReq(
      doc.slug,
      { content: "# After\n\nbody" },
      token.plaintext,
    );
    expect(res.status).toBe(200);

    const listed = await RevisionLog.list(doc.id);
    expect(listed.revisions).toHaveLength(1);
    expect(listed.revisions[0]?.source).toBe("cli");

    const revision = await RevisionLog.get(
      doc.id,
      listed.revisions[0]!.externalId,
    );
    expect(revision?.content).toBe("# Before\n\nbody");
  });

  it("does NOT create a revision when only title changes (no content write)", async () => {
    const { token, doc } = await setupAuthorizedDoc("v0");
    const res = await patchReq(doc.slug, { title: "Renamed" }, token.plaintext);
    expect(res.status).toBe(200);

    const listed = await RevisionLog.list(doc.id);
    expect(listed.revisions).toHaveLength(0);
  });
});
