-- 002_add_kind_column.sql
-- Add nullable `kind` to docs for typed-document scoping (issue #16).
-- Composite index supports owner-scoped, kind-filtered, recent-first listings
-- with the same (created_at, id) cursor shape used by the unfiltered listing.

ALTER TABLE docs ADD COLUMN kind text;

CREATE INDEX idx_docs_owner_kind_created
  ON docs (owner_id, kind, created_at DESC, id DESC);
