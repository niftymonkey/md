-- 004_create_user_preferences_table.sql
-- Per-user preferences (issue #24). Drives Reading section behavior on
-- /settings, and is read server-side by app/layout.tsx so the first paint
-- reflects the user's chosen width and outline auto-show state without a
-- localStorage round-trip. owner_id is the WorkOS user.id (text), matching
-- docs.owner_id and api_tokens.owner_id.
--
-- The default_kind column shipped here is dropped in migration 005; see
-- that file for context. It remains in this file's history so applied
-- migrations are never mutated retroactively.

CREATE TABLE user_preferences (
  owner_id text PRIMARY KEY,
  auto_show_outline boolean NOT NULL DEFAULT true,
  default_width text NOT NULL DEFAULT 'reading',
  default_kind text,
  updated_at timestamptz NOT NULL DEFAULT now()
);
