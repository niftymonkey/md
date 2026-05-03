-- 006_constrain_default_width.sql
-- Adds a CHECK constraint so user_preferences.default_width can only hold the
-- values the application actually accepts. validatePartialPreferences in
-- src/lib/user-preferences.ts already validates at the API boundary, and
-- mergeWithDefaults silently coerces unknown values back to 'reading' on read,
-- but a direct DB write (manual fix-up, future migration, anything bypassing
-- validation) could otherwise persist a bad value. Defense-in-depth at the
-- column boundary keeps the schema honest.

ALTER TABLE user_preferences
  ADD CONSTRAINT user_preferences_default_width_check
  CHECK (default_width IN ('reading', 'wide'));
