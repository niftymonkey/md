-- 008_add_tags_column.sql
-- Multi-label tags on docs (issue #25). Coexists with `kind` (single
-- classification): tags label "what it's about." GIN index supports the
-- `tags @> ARRAY['x']` containment filter used by the listing query and
-- the unnest aggregation that powers the dashboard usage rail.

ALTER TABLE docs ADD COLUMN tags text[] NOT NULL DEFAULT '{}';

CREATE INDEX idx_docs_tags ON docs USING gin (tags);
