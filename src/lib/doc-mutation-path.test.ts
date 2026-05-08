import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { sql } from "@vercel/postgres";
import { getDocBySlug, insertDoc, type Doc } from "./db";
import { generateSlug } from "./slug";
import { stripMarkdown } from "./strip-md";
import * as RevisionLog from "./revision-log";
import * as DocMutationPath from "./doc-mutation-path";

const TEST_OWNER = "__test_doc_mutation_path__";

async function createTestDoc(content: string): Promise<Doc> {
  return insertDoc({
    slug: generateSlug(),
    ownerId: TEST_OWNER,
    title: "Test",
    content,
    kind: null,
    searchText: stripMarkdown(content),
  });
}

function expectOk(
  result: DocMutationPath.WriteDocContentResult,
): DocMutationPath.WriteDocContentSuccess {
  if (!result.ok) {
    throw new Error(`expected ok, got ${result.kind}`);
  }
  return result;
}

beforeAll(() => {
  if (!process.env.POSTGRES_URL) {
    throw new Error(
      "POSTGRES_URL not set — DocMutationPath integration tests need .env.local.",
    );
  }
});

afterAll(async () => {
  await sql`DELETE FROM docs WHERE owner_id = ${TEST_OWNER}`;
});

describe("DocMutationPath.writeDocContent — return shape", () => {
  it("returns the updated doc so callers don't need a second query", async () => {
    const doc = await createTestDoc("v0");
    const result = expectOk(
      await DocMutationPath.writeDocContent({
        docId: doc.id,
        newContent: "v1",
        newTitle: "Renamed",
        summary: null,
        source: "manual",
        ownerId: TEST_OWNER,
      }),
    );
    expect(result.doc.content).toBe("v1");
    expect(result.doc.title).toBe("Renamed");
    expect(result.doc.id).toBe(doc.id);
    expect(result.doc.slug).toBe(doc.slug);
  });
});

describe("DocMutationPath.writeDocContent — atomicity", () => {
  it("rolls back the docs UPDATE if RevisionLog.record throws", async () => {
    const doc = await createTestDoc("v0");

    const spy = vi
      .spyOn(RevisionLog, "record")
      .mockRejectedValueOnce(new Error("boom"));

    await expect(
      DocMutationPath.writeDocContent({
        docId: doc.id,
        newContent: "v1",
        summary: null,
        source: "manual",
        ownerId: TEST_OWNER,
      }),
    ).rejects.toThrow("boom");

    spy.mockRestore();

    const persisted = await getDocBySlug(doc.slug);
    expect(persisted?.content).toBe("v0");
  });
});

describe("DocMutationPath.writeDocContent — metadata", () => {
  it("persists optional title, searchText, and kind on the doc row", async () => {
    const doc = await createTestDoc("v0");

    await DocMutationPath.writeDocContent({
      docId: doc.id,
      newContent: "v1",
      newTitle: "Renamed",
      newSearchText: "renamed search text",
      newKind: "note",
      summary: null,
      source: "manual",
      ownerId: TEST_OWNER,
    });

    const persisted = await getDocBySlug(doc.slug);
    expect(persisted?.content).toBe("v1");
    expect(persisted?.title).toBe("Renamed");
    expect(persisted?.searchText).toBe("renamed search text");
    expect(persisted?.kind).toBe("note");
  });
});

describe("DocMutationPath.writeDocContent", () => {
  it("updates doc content and records a revision capturing the previous content", async () => {
    const doc = await createTestDoc("# Original\n\nbody");

    const result = expectOk(
      await DocMutationPath.writeDocContent({
        docId: doc.id,
        newContent: "# Updated\n\nbody",
        summary: "Title rename",
        source: "manual",
        ownerId: TEST_OWNER,
      }),
    );

    // Doc row reflects the new content.
    const persisted = await getDocBySlug(doc.slug);
    expect(persisted?.content).toBe("# Updated\n\nbody");

    // The returned revision is retrievable and snapshots the *previous* content.
    expect(result.revisionId).toMatch(/^rv_/);
    const revision = await RevisionLog.get(doc.id, result.revisionId);
    expect(revision).not.toBeNull();
    expect(revision?.content).toBe("# Original\n\nbody");
    expect(revision?.summary).toBe("Title rename");
    expect(revision?.source).toBe("manual");
  });
});

describe("DocMutationPath.writeDocContent — expectedRevisionId", () => {
  it("succeeds when the expected revisionId matches the doc's current_revision_id", async () => {
    const doc = await createTestDoc("v0");
    // First write populates current_revision_id.
    const first = expectOk(
      await DocMutationPath.writeDocContent({
        docId: doc.id,
        newContent: "v1",
        summary: null,
        source: "manual",
        ownerId: TEST_OWNER,
      }),
    );

    const second = expectOk(
      await DocMutationPath.writeDocContent({
        docId: doc.id,
        newContent: "v2",
        summary: null,
        source: "manual",
        ownerId: TEST_OWNER,
        expectedRevisionId: first.revisionId,
      }),
    );
    expect(second.doc.content).toBe("v2");
    expect(second.doc.currentRevisionId).toBe(second.revisionId);
  });

  it("returns revision_mismatch when expectedRevisionId is stale", async () => {
    const doc = await createTestDoc("v0");
    const first = expectOk(
      await DocMutationPath.writeDocContent({
        docId: doc.id,
        newContent: "v1",
        summary: null,
        source: "manual",
        ownerId: TEST_OWNER,
      }),
    );
    // Advance current_revision_id past `first` without using expectedRevisionId.
    expectOk(
      await DocMutationPath.writeDocContent({
        docId: doc.id,
        newContent: "v2",
        summary: null,
        source: "manual",
        ownerId: TEST_OWNER,
      }),
    );

    const stale = await DocMutationPath.writeDocContent({
      docId: doc.id,
      newContent: "v3",
      summary: null,
      source: "manual",
      ownerId: TEST_OWNER,
      expectedRevisionId: first.revisionId,
    });
    expect(stale.ok).toBe(false);
    if (stale.ok) throw new Error("unreachable");
    expect(stale.kind).toBe("revision_mismatch");
    expect(stale.currentRevisionId).not.toBe(first.revisionId);

    // Doc content was not advanced by the stale attempt.
    const persisted = await getDocBySlug(doc.slug);
    expect(persisted?.content).toBe("v2");
  });

  it("returns revision_mismatch when expectedRevisionId is set but the doc has no revisions yet", async () => {
    const doc = await createTestDoc("v0");
    const result = await DocMutationPath.writeDocContent({
      docId: doc.id,
      newContent: "v1",
      summary: null,
      source: "manual",
      ownerId: TEST_OWNER,
      expectedRevisionId: "rv_anything",
    });
    expect(result.ok).toBe(false);
    if (result.ok) throw new Error("unreachable");
    expect(result.currentRevisionId).toBeNull();
  });
});

describe("DocMutationPath.writeDocContent — concurrent writers", () => {
  it("serializes via FOR UPDATE so each revision snapshots the immediate prior state", async () => {
    // Two writers race against the same doc. With row-level locking, the
    // second to acquire the lock reads the first's committed content as its
    // prevContent. Regardless of which writer wins the race, the resulting
    // revisions form a deterministic invariant: the set of snapshotted
    // contents is exactly { original, intermediate }, and persisted.content
    // matches whichever writer committed second.
    const doc = await createTestDoc("v0");

    const [rawA, rawB] = await Promise.all([
      DocMutationPath.writeDocContent({
        docId: doc.id,
        newContent: "vA",
        summary: "writer A",
        source: "manual",
        ownerId: TEST_OWNER,
      }),
      DocMutationPath.writeDocContent({
        docId: doc.id,
        newContent: "vB",
        summary: "writer B",
        source: "manual",
        ownerId: TEST_OWNER,
      }),
    ]);
    const resultA = expectOk(rawA);
    const resultB = expectOk(rawB);

    // The persisted content matches whichever writer committed last.
    const persisted = await getDocBySlug(doc.slug);
    expect(["vA", "vB"]).toContain(persisted?.content);

    // Two revisions exist. As a set, their contents capture the original
    // ("v0") plus the intermediate (the loser's newContent).
    const revA = await RevisionLog.get(doc.id, resultA.revisionId);
    const revB = await RevisionLog.get(doc.id, resultB.revisionId);
    expect(revA).not.toBeNull();
    expect(revB).not.toBeNull();
    const snapshotted = new Set([revA!.content, revB!.content]);
    expect(snapshotted.has("v0")).toBe(true);
    // The other snapshot is the loser's newContent (i.e., the one whose
    // committed state became the intermediate prevContent for the winner).
    const intermediate = persisted?.content === "vA" ? "vB" : "vA";
    expect(snapshotted.has(intermediate)).toBe(true);
  });
});
