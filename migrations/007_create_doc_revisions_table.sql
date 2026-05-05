-- 007_create_doc_revisions_table.sql
-- Document revision history (issue #45).
-- Captures pre-write content snapshots so any successful mutation through
-- DocMutationPath is recoverable. Feeds the dashboard history UI and
-- (later, via #46) the agent edit/restore endpoints.
--
-- The 'agent' source value is reserved here for #46 so that ticket needs no
-- enum extension migration. Until #46 ships nothing inserts with source='agent'.

CREATE TYPE doc_revision_source AS ENUM ('manual', 'cli', 'agent', 'restore');

CREATE TABLE doc_revisions (
  id bigserial PRIMARY KEY,
  external_id text UNIQUE NOT NULL,
  doc_id uuid NOT NULL REFERENCES docs(id) ON DELETE CASCADE,
  content text NOT NULL,
  summary text,
  source doc_revision_source NOT NULL,
  created_by text NOT NULL,
  bytes_added integer NOT NULL DEFAULT 0,
  bytes_removed integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- List newest-first per doc, with (created_at, id) cursor support that mirrors
-- the docs listing pagination shape.
CREATE INDEX idx_doc_revisions_doc_created
  ON doc_revisions (doc_id, created_at DESC, id DESC);
