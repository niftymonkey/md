import { randomBytes, createHash } from "node:crypto";
import { sql } from "@/lib/db";

export type ApiTokenSummary = {
  id: string;
  name: string;
  prefix: string;
  createdAt: Date;
  lastUsedAt: Date | null;
  revokedAt: Date | null;
};

export type CreatedApiToken = {
  id: string;
  name: string;
  plaintext: string;
  prefix: string;
  createdAt: Date;
};

type ApiTokenRow = {
  id: string;
  owner_id: string;
  name: string;
  prefix: string;
  created_at: Date;
  last_used_at: Date | null;
  revoked_at: Date | null;
};

const TOKEN_PREFIX = "mdk_";
const TOKEN_RANDOM_BYTES = 32;
const PREFIX_DISPLAY_LENGTH = 8;

export type GeneratedToken = {
  plaintext: string;
  hash: string;
  prefix: string;
};

export function generateToken(): GeneratedToken {
  const body = randomBytes(TOKEN_RANDOM_BYTES).toString("base64url");
  const plaintext = `${TOKEN_PREFIX}${body}`;
  return {
    plaintext,
    hash: hashToken(plaintext),
    prefix: plaintext.slice(0, PREFIX_DISPLAY_LENGTH),
  };
}

export function hashToken(plaintext: string): string {
  return createHash("sha256").update(plaintext).digest("hex");
}

function rowToSummary(row: ApiTokenRow): ApiTokenSummary {
  return {
    id: row.id,
    name: row.name,
    prefix: row.prefix,
    createdAt: row.created_at,
    lastUsedAt: row.last_used_at,
    revokedAt: row.revoked_at,
  };
}

export async function findActiveTokenByHash(
  hash: string,
): Promise<{ id: string; ownerId: string } | null> {
  const result = await sql<{ id: string; owner_id: string }>`
    SELECT id, owner_id
    FROM api_tokens
    WHERE token_hash = ${hash} AND revoked_at IS NULL
    LIMIT 1
  `;
  const row = result.rows[0];
  return row ? { id: row.id, ownerId: row.owner_id } : null;
}

export async function touchLastUsed(id: string): Promise<void> {
  await sql`
    UPDATE api_tokens
    SET last_used_at = now()
    WHERE id = ${id} AND revoked_at IS NULL
  `;
}

export async function createApiToken(
  ownerId: string,
  name: string,
): Promise<CreatedApiToken> {
  const generated = generateToken();
  const result = await sql<ApiTokenRow>`
    INSERT INTO api_tokens (owner_id, name, token_hash, prefix)
    VALUES (${ownerId}, ${name}, ${generated.hash}, ${generated.prefix})
    RETURNING id, owner_id, name, prefix, created_at, last_used_at, revoked_at
  `;
  const row = result.rows[0];
  if (!row) throw new Error("INSERT returned no rows");
  return {
    id: row.id,
    name: row.name,
    plaintext: generated.plaintext,
    prefix: row.prefix,
    createdAt: row.created_at,
  };
}

export async function listTokensForOwner(
  ownerId: string,
): Promise<ApiTokenSummary[]> {
  const result = await sql<ApiTokenRow>`
    SELECT id, owner_id, name, prefix, created_at, last_used_at, revoked_at
    FROM api_tokens
    WHERE owner_id = ${ownerId} AND revoked_at IS NULL
    ORDER BY created_at DESC
  `;
  return result.rows.map(rowToSummary);
}

export async function revokeToken(
  ownerId: string,
  id: string,
): Promise<boolean> {
  const result = await sql`
    UPDATE api_tokens
    SET revoked_at = now()
    WHERE id = ${id} AND owner_id = ${ownerId} AND revoked_at IS NULL
  `;
  return (result.rowCount ?? 0) > 0;
}
