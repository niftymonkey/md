import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { db, sql } from "@vercel/postgres";
import { insertDoc, type Doc } from "./db";
import { generateSlug } from "./slug";
import { stripMarkdown } from "./strip-md";
import * as RevisionLog from "./revision-log";

const TEST_OWNER = "__test_revision_log__";

async function createTestDoc(content: string, title = "Test"): Promise<Doc> {
  return insertDoc({
    slug: generateSlug(),
    ownerId: TEST_OWNER,
    title,
    content,
    kind: null,
    searchText: stripMarkdown(content),
  });
}

beforeAll(async () => {
  if (!process.env.POSTGRES_URL) {
    throw new Error(
      "POSTGRES_URL not set — RevisionLog integration tests need a real Postgres connection (.env.local).",
    );
  }
});

afterAll(async () => {
  // Cascade-deletes any doc_revisions belonging to test docs.
  await sql`DELETE FROM docs WHERE owner_id = ${TEST_OWNER}`;
});

describe("RevisionLog.record + get round-trip", () => {
  it("persists a revision and returns it via get(docId, externalId)", async () => {
    const doc = await createTestDoc("# Original\n\nbody");
    const result = await RevisionLog.record({
      docId: doc.id,
      content: "# Updated\n\nbody",
      prevContent: doc.content,
      summary: "Title bump",
      source: "manual",
      ownerId: TEST_OWNER,
    });

    expect(result.externalId).toMatch(/^rv_/);
    expect(result.createdAt).toBeInstanceOf(Date);

    const fetched = await RevisionLog.get(doc.id, result.externalId);
    expect(fetched).not.toBeNull();
    expect(fetched).toMatchObject({
      externalId: result.externalId,
      docId: doc.id,
      content: "# Updated\n\nbody",
      summary: "Title bump",
      source: "manual",
      createdBy: TEST_OWNER,
    });
  });
});

describe("RevisionLog transactional client", () => {
  it("uses the provided client so record participates in the caller's transaction", async () => {
    const doc = await createTestDoc("v0");
    const client = await db.connect();
    try {
      await client.query("BEGIN");
      await RevisionLog.record(
        {
          docId: doc.id,
          content: "v1",
          prevContent: "v0",
          summary: "rolled back",
          source: "manual",
          ownerId: TEST_OWNER,
        },
        client,
      );
      await client.query("ROLLBACK");
    } finally {
      client.release();
    }

    const listed = await RevisionLog.list(doc.id);
    expect(listed.revisions).toHaveLength(0);
  });
});

describe("RevisionLog byte counts", () => {
  it("records bytesAdded and bytesRemoved computed from the prev→next diff", async () => {
    const doc = await createTestDoc("hello world");
    await RevisionLog.record({
      docId: doc.id,
      content: "hello universe",
      prevContent: "hello world",
      summary: null,
      source: "manual",
      ownerId: TEST_OWNER,
    });
    const listed = await RevisionLog.list(doc.id);
    const rev = listed.revisions[0];
    expect(rev).toBeDefined();
    expect(rev!.bytesAdded).toBeGreaterThan(0);
    expect(rev!.bytesRemoved).toBeGreaterThan(0);
    // "world" (5 bytes) → "universe" (8 bytes); both sides nonzero, neither
    // exceeds the larger of the two strings' lengths.
    expect(rev!.bytesAdded).toBeLessThanOrEqual(8);
    expect(rev!.bytesRemoved).toBeLessThanOrEqual(5);
  });
});

describe("RevisionLog.list", () => {
  it("returns revisions newest-first for the given doc", async () => {
    const doc = await createTestDoc("v0");
    const r1 = await RevisionLog.record({
      docId: doc.id,
      content: "v1",
      prevContent: "v0",
      summary: "first",
      source: "manual",
      ownerId: TEST_OWNER,
    });
    const r2 = await RevisionLog.record({
      docId: doc.id,
      content: "v2",
      prevContent: "v1",
      summary: "second",
      source: "manual",
      ownerId: TEST_OWNER,
    });
    const r3 = await RevisionLog.record({
      docId: doc.id,
      content: "v3",
      prevContent: "v2",
      summary: "third",
      source: "manual",
      ownerId: TEST_OWNER,
    });

    const listed = await RevisionLog.list(doc.id);
    expect(listed.revisions.map((r) => r.externalId)).toEqual([
      r3.externalId,
      r2.externalId,
      r1.externalId,
    ]);
  });
});

describe("RevisionLog.list pagination", () => {
  it("paginates newest-first via cursor", async () => {
    const doc = await createTestDoc("v0");
    const recs = [];
    for (let i = 1; i <= 5; i++) {
      recs.push(
        await RevisionLog.record({
          docId: doc.id,
          content: `v${i}`,
          prevContent: `v${i - 1}`,
          summary: `r${i}`,
          source: "manual",
          ownerId: TEST_OWNER,
        }),
      );
    }
    // Newest-first order is r5, r4, r3, r2, r1.
    const expected = [...recs].reverse().map((r) => r.externalId);

    const page1 = await RevisionLog.list(doc.id, { limit: 2 });
    expect(page1.revisions.map((r) => r.externalId)).toEqual(
      expected.slice(0, 2),
    );
    expect(page1.nextCursor).not.toBeNull();

    const page2 = await RevisionLog.list(doc.id, {
      limit: 2,
      cursor: page1.nextCursor!,
    });
    expect(page2.revisions.map((r) => r.externalId)).toEqual(
      expected.slice(2, 4),
    );
    expect(page2.nextCursor).not.toBeNull();

    const page3 = await RevisionLog.list(doc.id, {
      limit: 2,
      cursor: page2.nextCursor!,
    });
    expect(page3.revisions.map((r) => r.externalId)).toEqual(
      expected.slice(4, 5),
    );
    expect(page3.nextCursor).toBeNull();
  });
});

describe("RevisionLog retention", () => {
  it("keeps only the most recent 50 revisions per doc", async () => {
    const doc = await createTestDoc("v0");
    const all = [];
    for (let i = 1; i <= 52; i++) {
      all.push(
        await RevisionLog.record({
          docId: doc.id,
          content: `v${i}`,
          prevContent: `v${i - 1}`,
          summary: `r${i}`,
          source: "manual",
          ownerId: TEST_OWNER,
        }),
      );
    }
    const listed = await RevisionLog.list(doc.id, { limit: 100 });
    expect(listed.revisions).toHaveLength(50);
    // The two oldest revisions (r1, r2) should have been pruned.
    const survivingIds = new Set(listed.revisions.map((r) => r.externalId));
    expect(survivingIds.has(all[0]!.externalId)).toBe(false);
    expect(survivingIds.has(all[1]!.externalId)).toBe(false);
    // The newest should still be present.
    expect(survivingIds.has(all[51]!.externalId)).toBe(true);
  }, 15_000);
});

describe("RevisionLog.get", () => {
  it("returns null when no revision exists for the given externalId", async () => {
    const doc = await createTestDoc("body");
    const fetched = await RevisionLog.get(doc.id, "rv_doesnotexist");
    expect(fetched).toBeNull();
  });

  it("does not return revisions from other docs (docId-scoped)", async () => {
    const docA = await createTestDoc("doc A");
    const docB = await createTestDoc("doc B");
    const recA = await RevisionLog.record({
      docId: docA.id,
      content: "doc A v2",
      prevContent: docA.content,
      summary: null,
      source: "manual",
      ownerId: TEST_OWNER,
    });
    const fetched = await RevisionLog.get(docB.id, recA.externalId);
    expect(fetched).toBeNull();
  });
});
