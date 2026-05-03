-- 005_drop_default_kind_column.sql
-- Drops the user_preferences.default_kind column added in migration 004.
-- The Defaults UI section was cut from issue #24 before merge: with the
-- broader kind/tag direction still under design, exposing a default-kind
-- input would entrench `kind` in the UI just as we were considering
-- replacing it with tags. The column had no UI surface and no API surface,
-- so removal is loss-free. Future-proof preference storage stays via the
-- table itself, and subsequent migrations re-add columns as real defaults
-- ship.

ALTER TABLE user_preferences DROP COLUMN IF EXISTS default_kind;
