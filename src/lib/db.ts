import { sql } from "@vercel/postgres";
import { toPgTextArray } from "./pg";

export { sql };

export type Doc = {
  id: string;
  slug: string;
  ownerId: string;
  title: string;
  content: string;
  kind: string | null;
  tags: string[];
  searchText: string | null;
  createdAt: Date;
  updatedAt: Date;
  /**
   * external_id of the most recent doc_revisions row for this doc, or null
   * if the doc has never been edited since creation. Surfaced on the agent
   * GET as the If-Match token.
   */
  currentRevisionId: string | null;
};

export type DocSummary = Pick<
  Doc,
  "id" | "slug" | "title" | "kind" | "tags" | "createdAt" | "updatedAt"
>;

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

type DocSummaryRow = {
  id: string;
  slug: string;
  title: string | null;
  kind: string | null;
  tags: string[] | null;
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
    currentRevisionId: row.current_revision_id,
  };
}

function rowToSummary(row: DocSummaryRow): DocSummary {
  return {
    id: row.id,
    slug: row.slug,
    title: row.title ?? "Untitled",
    kind: row.kind,
    tags: row.tags ?? [],
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export async function pingDatabase(): Promise<{ ok: true }> {
  const result = await sql`SELECT 1 AS ok`;
  if (result.rows[0]?.ok !== 1) {
    throw new Error("Postgres ping returned unexpected shape");
  }
  return { ok: true };
}

export async function insertDoc(input: {
  slug: string;
  ownerId: string;
  title: string;
  content: string;
  kind: string | null;
  tags?: string[];
  searchText: string;
}): Promise<Doc> {
  const result = await sql<DocRow>`
    INSERT INTO docs (slug, owner_id, title, content, kind, tags, search_text)
    VALUES (${input.slug}, ${input.ownerId}, ${input.title}, ${input.content}, ${input.kind}, ${toPgTextArray(input.tags ?? [])}, ${input.searchText})
    RETURNING id, slug, owner_id, title, content, kind, tags, search_text, created_at, updated_at, current_revision_id
  `;
  const row = result.rows[0];
  if (!row) throw new Error("INSERT returned no rows");
  return rowToDoc(row);
}

export type UpdateDocFields = {
  title?: string;
  content?: string;
  searchText?: string;
  kind?: string | null;
  tags?: string[];
};

export async function updateDocBySlug(
  slug: string,
  fields: UpdateDocFields,
): Promise<Doc | null> {
  const sets: string[] = [];
  const values: unknown[] = [];
  function bind(value: unknown): string {
    values.push(value);
    return `$${values.length}`;
  }
  if (fields.title !== undefined) sets.push(`title = ${bind(fields.title)}`);
  if (fields.content !== undefined) sets.push(`content = ${bind(fields.content)}`);
  if (fields.searchText !== undefined)
    sets.push(`search_text = ${bind(fields.searchText)}`);
  if (fields.kind !== undefined) sets.push(`kind = ${bind(fields.kind)}`);
  if (fields.tags !== undefined)
    sets.push(`tags = ${bind(toPgTextArray(fields.tags))}`);

  if (sets.length === 0) {
    // Nothing to update — caller shouldn't reach here, but treat as a read.
    return getDocBySlug(slug);
  }

  sets.push(`updated_at = now()`);
  const slugParam = bind(slug);
  const text = `
    UPDATE docs
    SET ${sets.join(", ")}
    WHERE slug = ${slugParam}
    RETURNING id, slug, owner_id, title, content, kind, tags, search_text, created_at, updated_at, current_revision_id
  `;

  const result = await sql.query<DocRow>(text, values);
  const row = result.rows[0];
  return row ? rowToDoc(row) : null;
}

export async function deleteDocBySlug(
  slug: string,
  ownerId: string,
): Promise<boolean> {
  const result = await sql`
    DELETE FROM docs WHERE slug = ${slug} AND owner_id = ${ownerId}
  `;
  return (result.rowCount ?? 0) > 0;
}

export async function getDocBySlug(slug: string): Promise<Doc | null> {
  const result = await sql<DocRow>`
    SELECT id, slug, owner_id, title, content, kind, tags, search_text, created_at, updated_at, current_revision_id
    FROM docs
    WHERE slug = ${slug}
    LIMIT 1
  `;
  const row = result.rows[0];
  return row ? rowToDoc(row) : null;
}

export type ListDocsArgs = {
  ownerId: string;
  search?: string;
  cursor?: string;
  limit?: number;
  kind?: string;
  tags?: string[];
};

export type ListDocsResult = {
  docs: DocSummary[];
  nextCursor: string | null;
};

function buildTsQuery(search: string): string {
  return search
    .toLowerCase()
    .replace(/[&|!():*<>'"\\]/g, " ")
    .split(/\s+/)
    .filter((t) => t.length > 0)
    .map((t) => `${t}:*`)
    .join(" & ");
}

type CursorPayload = { createdAt: Date; id: string };

function encodeCursor(row: { created_at: Date; id: string }): string {
  return Buffer.from(`${row.created_at.toISOString()}|${row.id}`).toString(
    "base64url",
  );
}

function decodeCursor(cursor: string): CursorPayload | null {
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

export async function listDocs(args: ListDocsArgs): Promise<ListDocsResult> {
  const limit = Math.max(1, Math.min(100, args.limit ?? 20));
  const search = args.search?.trim();
  const kind = args.kind;
  const tags = args.tags && args.tags.length > 0 ? args.tags : null;

  // Search branch: rank by FTS relevance. Cursor pagination not supported with
  // search in v1 — caller should rely on search precision and the limit.
  if (search) {
    const tsQuery = buildTsQuery(search);
    if (!tsQuery) {
      return { docs: [], nextCursor: null };
    }
    const result = await runSearchQuery({
      ownerId: args.ownerId,
      tsQuery,
      kind: kind ?? null,
      tags,
      limit,
    });
    return { docs: result.rows.map(rowToSummary), nextCursor: null };
  }

  // Recent-first listing with cursor pagination.
  const cursor = args.cursor ? decodeCursor(args.cursor) : null;
  const result = await runListQuery({
    ownerId: args.ownerId,
    kind: kind ?? null,
    tags,
    cursor,
    limit,
  });

  const rows = result.rows;
  const hasMore = rows.length > limit;
  const page = hasMore ? rows.slice(0, limit) : rows;
  const last = page[page.length - 1];
  const nextCursor = hasMore && last ? encodeCursor(last) : null;
  return { docs: page.map(rowToSummary), nextCursor };
}

async function runListQuery(args: {
  ownerId: string;
  kind: string | null;
  tags: string[] | null;
  cursor: CursorPayload | null;
  limit: number;
}) {
  const { ownerId, kind, tags, cursor, limit } = args;
  const fetchLimit = limit + 1;

  const where: string[] = ["owner_id = $1"];
  const values: unknown[] = [ownerId];
  function bind(value: unknown): string {
    values.push(value);
    return `$${values.length}`;
  }
  if (kind) where.push(`kind = ${bind(kind)}`);
  if (tags) where.push(`tags @> ${bind(toPgTextArray(tags))}::text[]`);
  if (cursor) {
    const tsParam = bind(cursor.createdAt.toISOString());
    const idParam = bind(cursor.id);
    where.push(`(created_at, id) < (${tsParam}, ${idParam})`);
  }

  const text = `
    SELECT id, slug, title, kind, tags, created_at, updated_at
    FROM docs
    WHERE ${where.join(" AND ")}
    ORDER BY created_at DESC, id DESC
    LIMIT ${bind(fetchLimit)}
  `;
  return sql.query<DocSummaryRow>(text, values);
}

async function runSearchQuery(args: {
  ownerId: string;
  tsQuery: string;
  kind: string | null;
  tags: string[] | null;
  limit: number;
}) {
  const { ownerId, tsQuery, kind, tags, limit } = args;
  const where: string[] = ["owner_id = $1"];
  const values: unknown[] = [ownerId];
  function bind(value: unknown): string {
    values.push(value);
    return `$${values.length}`;
  }
  const tsQueryParam = bind(tsQuery);
  where.push(`search_vector @@ to_tsquery('english', ${tsQueryParam})`);
  if (kind) where.push(`kind = ${bind(kind)}`);
  if (tags) where.push(`tags @> ${bind(toPgTextArray(tags))}::text[]`);

  const text = `
    SELECT id, slug, title, kind, tags, created_at, updated_at
    FROM docs
    WHERE ${where.join(" AND ")}
    ORDER BY ts_rank(search_vector, to_tsquery('english', ${tsQueryParam})) DESC,
             created_at DESC,
             id DESC
    LIMIT ${bind(limit)}
  `;
  return sql.query<DocSummaryRow>(text, values);
}

export type DocSearchRow = {
  slug: string;
  title: string;
  kind: string | null;
  tags: string[];
  content: string;
};

/**
 * Owner-scoped full-text search returning the candidate docs' content along
 * with their metadata. Caller is expected to run per-doc literal-match
 * extraction (typically {@link import("./match-resolver").findMatches}) over
 * `content` and discard candidates whose literal substring is absent. Returns
 * an empty array when the sanitized FTS query has no tokens.
 */
export async function searchOwnedDocsFullText(args: {
  ownerId: string;
  query: string;
  limit: number;
}): Promise<DocSearchRow[]> {
  const tsQuery = buildTsQuery(args.query);
  if (!tsQuery) return [];

  const result = await sql.query<{
    slug: string;
    title: string | null;
    kind: string | null;
    tags: string[] | null;
    content: string;
  }>(
    `SELECT slug, title, kind, tags, content
     FROM docs
     WHERE owner_id = $1
       AND search_vector @@ to_tsquery('english', $2)
     ORDER BY ts_rank(search_vector, to_tsquery('english', $2)) DESC,
              created_at DESC,
              id DESC
     LIMIT $3`,
    [args.ownerId, tsQuery, args.limit],
  );
  return result.rows.map((row) => ({
    slug: row.slug,
    title: row.title ?? "Untitled",
    kind: row.kind,
    tags: row.tags ?? [],
    content: row.content,
  }));
}

export type TagUsageRow = { tag: string; count: number };

/**
 * Owner-scoped tag usage counts, sorted by usage descending and tag ascending
 * for stable ordering. Powers the dashboard pill row.
 */
export async function listTagUsage(ownerId: string): Promise<TagUsageRow[]> {
  const result = await sql<{ tag: string; count: string }>`
    SELECT t AS tag, COUNT(*)::text AS count
    FROM docs, unnest(tags) t
    WHERE owner_id = ${ownerId}
    GROUP BY t
    ORDER BY COUNT(*) DESC, t ASC
  `;
  return result.rows.map((r) => ({ tag: r.tag, count: Number(r.count) }));
}

