-- 001_create_docs_table.sql
-- Initial schema for md.niftymonkey.dev: docs table with FTS + trigram indexes.

CREATE EXTENSION IF NOT EXISTS pg_trgm;

CREATE TABLE docs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  slug text UNIQUE NOT NULL,
  owner_id text NOT NULL,
  title text,
  content text NOT NULL,
  search_text text,
  search_vector tsvector,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_docs_search ON docs USING gin(search_vector);
CREATE INDEX idx_docs_owner_created ON docs(owner_id, created_at DESC);
CREATE INDEX idx_docs_title_trgm ON docs USING gin(title gin_trgm_ops);

CREATE OR REPLACE FUNCTION docs_search_vector_update() RETURNS trigger AS $$
BEGIN
  NEW.search_vector :=
    setweight(to_tsvector('english', coalesce(NEW.title, '')), 'A') ||
    setweight(to_tsvector('english', coalesce(NEW.search_text, '')), 'B');
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER docs_search_vector_trigger
  BEFORE INSERT OR UPDATE ON docs
  FOR EACH ROW EXECUTE FUNCTION docs_search_vector_update();
