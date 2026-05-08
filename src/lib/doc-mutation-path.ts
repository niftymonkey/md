import { db } from "@vercel/postgres";
import type { Doc } from "./db";
import { toPgTextArray } from "./pg";
import * as RevisionLog from "./revision-log";

export type WriteDocContentInput = {
  docId: string;
  newContent: string;
  newTitle?: string;
  newSearchText?: string;
  newKind?: string | null;
  newTags?: string[];
  summary: string | null;
  source: RevisionLog.RevisionSource;
  ownerId: string;
  /**
   * Optional optimistic-concurrency token. When provided, the write only
   * proceeds if `docs.current_revision_id` (read under FOR UPDATE) equals
   * this value. Mismatch returns {ok:false, kind:"revision_mismatch", ...}
   * so the caller can surface 412 without bubbling exceptions.
   *
   * For a doc that has never been edited (current_revision_id IS NULL) the
   * caller should omit this field — there is no token to compare against.
   * Concurrency protection becomes available on the first edit.
   */
  expectedRevisionId?: string;
};

export type WriteDocContentSuccess = {
  ok: true;
  doc: Doc;
  revisionId: string;
};

export type WriteDocContentMismatch = {
  ok: false;
  kind: "revision_mismatch";
  currentRevisionId: string | null;
};

export type WriteDocContentResult =
  | WriteDocContentSuccess
  | WriteDocContentMismatch;

type DocRow = {
  id: string;
  slug: string;
  owner_id: string;
  title: string | null;
  content: string;
  kind: string | null;
  tags: string[] | null;
  search_text: string | null;
  created_at: Date;
  updated_at: Date;
  current_revision_id: string | null;
};

function rowToDoc(row: DocRow): Doc {
  return {
    id: row.id,
    slug: row.slug,
    ownerId: row.owner_id,
    title: row.title ?? "Untitled",
    content: row.content,
    kind: row.kind,
    tags: row.tags ?? [],
    searchText: row.search_text,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    currentRevisionId: row.current_revision_id,
  };
}

export async function writeDocContent(
  input: WriteDocContentInput,
): Promise<WriteDocContentResult> {
  const client = await db.connect();
  try {
    await client.query("BEGIN");

    // Lock the docs row so two concurrent writers serialize. Without FOR
    // UPDATE, both writers can read the same prevContent and the second
    // revision would snapshot stale content instead of the actual immediate
    // prior state.
    const prevResult = await client.query<{
      content: string;
      current_revision_id: string | null;
    }>(
      `SELECT content, current_revision_id FROM docs WHERE id = $1 FOR UPDATE`,
      [input.docId],
    );
    const prev = prevResult.rows[0];
    if (!prev) {
      throw new Error(`docs row not found for id=${input.docId}`);
    }

    if (
      input.expectedRevisionId !== undefined &&
      prev.current_revision_id !== input.expectedRevisionId
    ) {
      await client.query("ROLLBACK");
      return {
        ok: false,
        kind: "revision_mismatch",
        currentRevisionId: prev.current_revision_id,
      };
    }

    // Pre-generate the new revision external_id so the docs UPDATE and the
    // doc_revisions INSERT can both reference it within this transaction —
    // keeping the cache (current_revision_id) and the canonical row in sync.
    const newRevisionExternalId = RevisionLog.generateExternalId();

    const sets: string[] = ["content = $1"];
    const values: unknown[] = [input.newContent];
    function bind(value: unknown): string {
      values.push(value);
      return `$${values.length}`;
    }
    if (input.newTitle !== undefined) {
      sets.push(`title = ${bind(input.newTitle)}`);
    }
    if (input.newSearchText !== undefined) {
      sets.push(`search_text = ${bind(input.newSearchText)}`);
    }
    if (input.newKind !== undefined) {
      sets.push(`kind = ${bind(input.newKind)}`);
    }
    if (input.newTags !== undefined) {
      sets.push(`tags = ${bind(toPgTextArray(input.newTags))}`);
    }
    sets.push(`current_revision_id = ${bind(newRevisionExternalId)}`);
    sets.push(`updated_at = now()`);
    const docIdParam = bind(input.docId);
    const updateResult = await client.query<DocRow>(
      `UPDATE docs SET ${sets.join(", ")} WHERE id = ${docIdParam}
       RETURNING id, slug, owner_id, title, content, kind, tags, search_text,
                 created_at, updated_at, current_revision_id`,
      values,
    );
    const updatedRow = updateResult.rows[0];
    if (!updatedRow) {
      throw new Error(`docs UPDATE returned no rows for id=${input.docId}`);
    }

    const revision = await RevisionLog.record(
      {
        docId: input.docId,
        prevContent: prev.content,
        nextContent: input.newContent,
        summary: input.summary,
        source: input.source,
        ownerId: input.ownerId,
        externalId: newRevisionExternalId,
      },
      client,
    );

    await client.query("COMMIT");
    return {
      ok: true,
      doc: rowToDoc(updatedRow),
      revisionId: revision.externalId,
    };
  } catch (err) {
    await client.query("ROLLBACK");
    throw err;
  } finally {
    client.release();
  }
}
