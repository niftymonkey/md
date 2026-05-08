import { sql, type VercelPoolClient } from "@vercel/postgres";
import { customAlphabet } from "nanoid";
import { computeDiff } from "./diff-stats";

type Runner = Pick<VercelPoolClient, "query"> | typeof sql;

const ID_ALPHABET =
  "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
const generateId = customAlphabet(ID_ALPHABET, 8);

const RETENTION_KEEP = 50;

export type RevisionSource = "manual" | "cli" | "agent" | "restore";

export type Revision = {
  externalId: string;
  docId: string;
  content: string;
  summary: string | null;
  source: RevisionSource;
  createdBy: string;
  bytesAdded: number;
  bytesRemoved: number;
  createdAt: Date;
};

export type RecordInput = {
  docId: string;
  /** The state being saved — what restoring this revision would return to. */
  prevContent: string;
  /** The state about to replace prevContent. Used only to compute byte deltas. */
  nextContent: string;
  summary: string | null;
  source: RevisionSource;
  ownerId: string;
  /**
   * Optional pre-generated external_id. Lets callers (e.g. writeDocContent)
   * weave the same value into related writes in the same transaction so
   * `docs.current_revision_id` and `doc_revisions.external_id` are populated
   * in lockstep without a second round trip.
   */
  externalId?: string;
};

export type RecordResult = {
  externalId: string;
  createdAt: Date;
};

export function generateExternalId(): string {
  return `rv_${generateId()}`;
}

export async function record(
  input: RecordInput,
  runner: Runner = sql,
): Promise<RecordResult> {
  const externalId = input.externalId ?? generateExternalId();
  const { bytesAdded, bytesRemoved } = computeDiff(
    input.prevContent,
    input.nextContent,
  );
  const result = await runner.query<{
    external_id: string;
    created_at: Date;
  }>(
    `INSERT INTO doc_revisions
       (external_id, doc_id, content, summary, source, created_by,
        bytes_added, bytes_removed)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
     RETURNING external_id, created_at`,
    [
      externalId,
      input.docId,
      input.prevContent,
      input.summary,
      input.source,
      input.ownerId,
      bytesAdded,
      bytesRemoved,
    ],
  );
  const row = result.rows[0];
  if (!row) throw new Error("doc_revisions INSERT returned no rows");

  await runner.query(
    `DELETE FROM doc_revisions
     WHERE doc_id = $1
       AND id NOT IN (
         SELECT id FROM doc_revisions
         WHERE doc_id = $1
         ORDER BY created_at DESC, id DESC
         LIMIT $2
       )`,
    [input.docId, RETENTION_KEEP],
  );

  return { externalId: row.external_id, createdAt: row.created_at };
}

type RevisionRow = {
  external_id: string;
  doc_id: string;
  content: string;
  summary: string | null;
  source: RevisionSource;
  created_by: string;
  bytes_added: number;
  bytes_removed: number;
  created_at: Date;
};

export type RevisionMeta = Omit<Revision, "content">;

export type ListArgs = {
  limit?: number;
  cursor?: string;
};

export type ListResult = {
  revisions: RevisionMeta[];
  nextCursor: string | null;
};

type Cursor = { createdAt: Date; id: string };

function encodeCursor(row: { created_at: Date; id: string }): string {
  return Buffer.from(`${row.created_at.toISOString()}|${row.id}`).toString(
    "base64url",
  );
}

function decodeCursor(cursor: string): Cursor | null {
  try {
    const decoded = Buffer.from(cursor, "base64url").toString("utf8");
    const sep = decoded.indexOf("|");
    if (sep <= 0) return null;
    const ts = decoded.slice(0, sep);
    const id = decoded.slice(sep + 1);
    if (!id) return null;
    const date = new Date(ts);
    if (isNaN(date.getTime())) return null;
    return { createdAt: date, id };
  } catch {
    return null;
  }
}

type ListRow = Omit<RevisionRow, "content"> & { id: string };

export async function list(
  docId: string,
  args: ListArgs = {},
): Promise<ListResult> {
  const limit = Math.max(1, Math.min(100, args.limit ?? 20));
  const cursor = args.cursor ? decodeCursor(args.cursor) : null;
  const fetchLimit = limit + 1;

  const result = cursor
    ? await sql<ListRow>`
        SELECT id, external_id, doc_id, summary, source, created_by,
               bytes_added, bytes_removed, created_at
        FROM doc_revisions
        WHERE doc_id = ${docId}
          AND (created_at, id) < (${cursor.createdAt.toISOString()}, ${cursor.id})
        ORDER BY created_at DESC, id DESC
        LIMIT ${fetchLimit}
      `
    : await sql<ListRow>`
        SELECT id, external_id, doc_id, summary, source, created_by,
               bytes_added, bytes_removed, created_at
        FROM doc_revisions
        WHERE doc_id = ${docId}
        ORDER BY created_at DESC, id DESC
        LIMIT ${fetchLimit}
      `;

  const rows = result.rows;
  const hasMore = rows.length > limit;
  const page = hasMore ? rows.slice(0, limit) : rows;
  const last = page[page.length - 1];
  const nextCursor = hasMore && last ? encodeCursor(last) : null;
  const revisions = page.map((row) => ({
    externalId: row.external_id,
    docId: row.doc_id,
    summary: row.summary,
    source: row.source,
    createdBy: row.created_by,
    bytesAdded: row.bytes_added,
    bytesRemoved: row.bytes_removed,
    createdAt: row.created_at,
  }));
  return { revisions, nextCursor };
}

export async function countByDoc(
  docIds: string[],
): Promise<Record<string, number>> {
  if (docIds.length === 0) return {};
  const result = await sql.query<{ doc_id: string; count: string }>(
    `SELECT doc_id, COUNT(*)::text AS count
     FROM doc_revisions
     WHERE doc_id = ANY($1::uuid[])
     GROUP BY doc_id`,
    [docIds],
  );
  const counts: Record<string, number> = {};
  for (const row of result.rows) {
    counts[row.doc_id] = parseInt(row.count, 10);
  }
  return counts;
}

export async function get(
  docId: string,
  externalId: string,
): Promise<Revision | null> {
  const result = await sql<RevisionRow>`
    SELECT external_id, doc_id, content, summary, source, created_by,
           bytes_added, bytes_removed, created_at
    FROM doc_revisions
    WHERE doc_id = ${docId} AND external_id = ${externalId}
    LIMIT 1
  `;
  const row = result.rows[0];
  if (!row) return null;
  return {
    externalId: row.external_id,
    docId: row.doc_id,
    content: row.content,
    summary: row.summary,
    source: row.source,
    createdBy: row.created_by,
    bytesAdded: row.bytes_added,
    bytesRemoved: row.bytes_removed,
    createdAt: row.created_at,
  };
}
