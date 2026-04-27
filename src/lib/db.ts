import { sql } from "@vercel/postgres";

export { sql };

export type Doc = {
  id: string;
  slug: string;
  ownerId: string;
  title: string;
  content: string;
  searchText: string | null;
  createdAt: Date;
  updatedAt: Date;
};

export type DocSummary = Pick<Doc, "id" | "slug" | "title" | "createdAt" | "updatedAt">;

type DocRow = {
  id: string;
  slug: string;
  owner_id: string;
  title: string | null;
  content: string;
  search_text: string | null;
  created_at: Date;
  updated_at: Date;
};

type DocSummaryRow = {
  id: string;
  slug: string;
  title: string | null;
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
  searchText: string;
}): Promise<Doc> {
  const result = await sql<DocRow>`
    INSERT INTO docs (slug, owner_id, title, content, search_text)
    VALUES (${input.slug}, ${input.ownerId}, ${input.title}, ${input.content}, ${input.searchText})
    RETURNING id, slug, owner_id, title, content, search_text, created_at, updated_at
  `;
  const row = result.rows[0];
  if (!row) throw new Error("INSERT returned no rows");
  return rowToDoc(row);
}

export async function deleteDocBySlug(slug: string): Promise<boolean> {
  const result = await sql`DELETE FROM docs WHERE slug = ${slug}`;
  return (result.rowCount ?? 0) > 0;
}

export async function getDocBySlug(slug: string): Promise<Doc | null> {
  const result = await sql<DocRow>`
    SELECT id, slug, owner_id, title, content, search_text, created_at, updated_at
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
};

export type ListDocsResult = {
  docs: DocSummary[];
  nextCursor: string | null;
};

export async function listDocs(args: ListDocsArgs): Promise<ListDocsResult> {
  const limit = Math.max(1, Math.min(100, args.limit ?? 20));
  // v1 path: no search, no cursor — owner-scoped recent N.
  // Search/cursor branches are scaffolded for the next iteration.
  if (!args.search && !args.cursor) {
    const result = await sql<DocSummaryRow>`
      SELECT id, slug, title, created_at, updated_at
      FROM docs
      WHERE owner_id = ${args.ownerId}
      ORDER BY created_at DESC, id DESC
      LIMIT ${limit + 1}
    `;
    const rows = result.rows;
    const hasMore = rows.length > limit;
    const page = hasMore ? rows.slice(0, limit) : rows;
    const last = page[page.length - 1];
    const nextCursor =
      hasMore && last
        ? Buffer.from(`${last.created_at.toISOString()}|${last.id}`).toString("base64url")
        : null;
    return { docs: page.map(rowToSummary), nextCursor };
  }
  throw new Error("listDocs search/cursor branches not yet implemented");
}
