import { sql } from "@vercel/postgres";

export { sql };

export async function pingDatabase(): Promise<{ ok: true }> {
  const result = await sql`SELECT 1 AS ok`;
  if (result.rows[0]?.ok !== 1) {
    throw new Error("Postgres ping returned unexpected shape");
  }
  return { ok: true };
}
