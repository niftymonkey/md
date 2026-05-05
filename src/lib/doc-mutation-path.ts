import { db } from "@vercel/postgres";
import * as RevisionLog from "./revision-log";

export type WriteDocContentInput = {
  docId: string;
  newContent: string;
  newTitle?: string;
  newSearchText?: string;
  newKind?: string | null;
  summary: string | null;
  source: RevisionLog.RevisionSource;
  ownerId: string;
};

export type WriteDocContentResult = {
  revisionId: string;
};

export async function writeDocContent(
  input: WriteDocContentInput,
): Promise<WriteDocContentResult> {
  const client = await db.connect();
  try {
    await client.query("BEGIN");

    const prevResult = await client.query<{ content: string }>(
      `SELECT content FROM docs WHERE id = $1`,
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
    sets.push(`updated_at = now()`);
    const docIdParam = bind(input.docId);
    await client.query(
      `UPDATE docs SET ${sets.join(", ")} WHERE id = ${docIdParam}`,
      values,
    );

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
    return { revisionId: revision.externalId };
  } catch (err) {
    await client.query("ROLLBACK");
    throw err;
  } finally {
    client.release();
  }
}
