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
};

export type WriteDocContentResult = {
  doc: Doc;
  revisionId: string;
};

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
    const prevResult = await client.query<{ content: string }>(
      `SELECT content FROM docs WHERE id = $1 FOR UPDATE`,
      [input.docId],
    );
    const prev = prevResult.rows[0];
    if (!prev) {
      throw new Error(`docs row not found for id=${input.docId}`);
    }

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
    sets.push(`updated_at = now()`);
    const docIdParam = bind(input.docId);
    const updateResult = await client.query<DocRow>(
      `UPDATE docs SET ${sets.join(", ")} WHERE id = ${docIdParam}
       RETURNING id, slug, owner_id, title, content, kind, tags, search_text,
                 created_at, updated_at`,
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
      },
      client,
    );

    await client.query("COMMIT");
    return { doc: rowToDoc(updatedRow), revisionId: revision.externalId };
  } catch (err) {
    await client.query("ROLLBACK");
    throw err;
  } finally {
    client.release();
  }
}
