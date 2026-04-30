-- 003_create_api_tokens_table.sql
-- Personal API tokens (issue #14). Replaces the single shared MD_API_KEY env-var
-- with per-user, hashed, revocable tokens. The bearer auth path in
-- src/lib/auth.ts looks up the sha256 of the incoming token in token_hash.
-- The 8-char prefix is stored for UI display, plaintext is never persisted.
-- The partial index supports owner-scoped lists of active tokens.

CREATE TABLE api_tokens (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id text NOT NULL,
  name text NOT NULL,
  token_hash text NOT NULL UNIQUE,
  prefix text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  last_used_at timestamptz,
  revoked_at timestamptz
);

CREATE INDEX idx_api_tokens_owner_active
  ON api_tokens (owner_id, created_at DESC)
  WHERE revoked_at IS NULL;
