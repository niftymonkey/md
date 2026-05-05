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
