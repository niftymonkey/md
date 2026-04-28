import { sql } from "@vercel/postgres";

export { sql };

export type Doc = {
  id: string;
  slug: string;
  ownerId: string;
  title: string;
  content: string;
  kind: string | null;
  searchText: string | null;
  createdAt: Date;
  updatedAt: Date;
};

export type DocSummary = Pick<
  Doc,
  "id" | "slug" | "title" | "kind" | "createdAt" | "updatedAt"
>;

type DocRow = {
  id: string;
  slug: string;
  owner_id: string;
  title: string | null;
  content: string;
  kind: string | null;
  search_text: string | null;
  created_at: Date;
  updated_at: Date;
};

type DocSummaryRow = {
  id: string;
  slug: string;
  title: string | null;
  kind: string | null;
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
    searchText: row.search_text,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function rowToSummary(row: DocSummaryRow): DocSummary {
  return {
    id: row.id,
    slug: row.slug,
    title: row.title ?? "Untitled",
    kind: row.kind,
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
  searchText: string;
}): Promise<Doc> {
  const result = await sql<DocRow>`
    INSERT INTO docs (slug, owner_id, title, content, kind, search_text)
    VALUES (${input.slug}, ${input.ownerId}, ${input.title}, ${input.content}, ${input.kind}, ${input.searchText})
    RETURNING id, slug, owner_id, title, content, kind, search_text, created_at, updated_at
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
    RETURNING id, slug, owner_id, title, content, kind, search_text, created_at, updated_at
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
    SELECT id, slug, owner_id, title, content, kind, search_text, created_at, updated_at
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

  // Search branch: rank by FTS relevance. Cursor pagination not supported with
  // search in v1 — caller should rely on search precision and the limit.
  if (search) {
    const tsQuery = buildTsQuery(search);
    if (!tsQuery) {
      return { docs: [], nextCursor: null };
    }
    const result = kind
      ? await sql<DocSummaryRow>`
          SELECT id, slug, title, kind, created_at, updated_at
          FROM docs
          WHERE owner_id = ${args.ownerId}
            AND kind = ${kind}
            AND search_vector @@ to_tsquery('english', ${tsQuery})
          ORDER BY ts_rank(search_vector, to_tsquery('english', ${tsQuery})) DESC,
                   created_at DESC,
                   id DESC
          LIMIT ${limit}
        `
      : await sql<DocSummaryRow>`
          SELECT id, slug, title, kind, created_at, updated_at
          FROM docs
          WHERE owner_id = ${args.ownerId}
            AND search_vector @@ to_tsquery('english', ${tsQuery})
          ORDER BY ts_rank(search_vector, to_tsquery('english', ${tsQuery})) DESC,
                   created_at DESC,
                   id DESC
          LIMIT ${limit}
        `;
    return { docs: result.rows.map(rowToSummary), nextCursor: null };
  }

  // Recent-first listing with cursor pagination.
  const cursor = args.cursor ? decodeCursor(args.cursor) : null;
  const result = await runListQuery({
    ownerId: args.ownerId,
    kind: kind ?? null,
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
  cursor: CursorPayload | null;
  limit: number;
}) {
  const { ownerId, kind, cursor, limit } = args;
  const fetchLimit = limit + 1;

  if (kind && cursor) {
    return sql<DocSummaryRow>`
      SELECT id, slug, title, kind, created_at, updated_at
      FROM docs
      WHERE owner_id = ${ownerId}
        AND kind = ${kind}
        AND (created_at, id) < (${cursor.createdAt.toISOString()}, ${cursor.id})
      ORDER BY created_at DESC, id DESC
      LIMIT ${fetchLimit}
    `;
  }
  if (kind) {
    return sql<DocSummaryRow>`
      SELECT id, slug, title, kind, created_at, updated_at
      FROM docs
      WHERE owner_id = ${ownerId}
        AND kind = ${kind}
      ORDER BY created_at DESC, id DESC
      LIMIT ${fetchLimit}
    `;
  }
  if (cursor) {
    return sql<DocSummaryRow>`
      SELECT id, slug, title, kind, created_at, updated_at
      FROM docs
      WHERE owner_id = ${ownerId}
        AND (created_at, id) < (${cursor.createdAt.toISOString()}, ${cursor.id})
      ORDER BY created_at DESC, id DESC
      LIMIT ${fetchLimit}
    `;
  }
  return sql<DocSummaryRow>`
    SELECT id, slug, title, kind, created_at, updated_at
    FROM docs
    WHERE owner_id = ${ownerId}
    ORDER BY created_at DESC, id DESC
    LIMIT ${fetchLimit}
  `;
}
