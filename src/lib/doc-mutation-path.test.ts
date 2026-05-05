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
    const result = await DocMutationPath.writeDocContent({
      docId: doc.id,
      newContent: "v1",
      newTitle: "Renamed",
      summary: null,
      source: "manual",
      ownerId: TEST_OWNER,
    });
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

    const result = await DocMutationPath.writeDocContent({
      docId: doc.id,
      newContent: "# Updated\n\nbody",
      summary: "Title rename",
      source: "manual",
      ownerId: TEST_OWNER,
    });

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

describe("DocMutationPath.writeDocContent — concurrent writers", () => {
  it("serializes via FOR UPDATE so each revision snapshots the immediate prior state", async () => {
    // Two writers race against the same doc. With row-level locking, the
    // second to acquire the lock reads the first's committed content as its
    // prevContent. Regardless of which writer wins the race, the resulting
    // revisions form a deterministic invariant: the set of snapshotted
    // contents is exactly { original, intermediate }, and persisted.content
    // matches whichever writer committed second.
    const doc = await createTestDoc("v0");

    const [resultA, resultB] = await Promise.all([
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
