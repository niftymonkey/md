-- 009_add_current_revision_id.sql
-- Optimistic concurrency for the agent edits API (issue #51). The column
-- caches the latest doc_revisions.external_id for cheap If-Match comparison.
-- Writes populate it inside the same transaction that records the revision,
-- so the cache and the revision log can never diverge.
--
-- NULL means "no revisions yet" (the doc has not been edited since creation).
-- Existing rows pre-dating this migration also start as NULL. The first
-- write under the new code populates it.

ALTER TABLE docs ADD COLUMN current_revision_id text;
