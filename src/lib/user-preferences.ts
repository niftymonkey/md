import { sql } from "@/lib/db";

export type Width = "reading" | "wide";

export type UserPreferences = {
  autoShowOutline: boolean;
  defaultWidth: Width;
};

export type PartialUserPreferences = Partial<UserPreferences>;

export const DEFAULT_PREFERENCES: UserPreferences = {
  autoShowOutline: true,
  defaultWidth: "reading",
};

type UserPreferencesRow = {
  auto_show_outline: boolean;
  default_width: string;
};

export type ValidatedPartial =
  | { ok: true; value: PartialUserPreferences }
  | { ok: false; error: string };

export function mergeWithDefaults(
  row: UserPreferencesRow | null,
): UserPreferences {
  if (!row) return { ...DEFAULT_PREFERENCES };
  return {
    autoShowOutline: row.auto_show_outline,
    defaultWidth: row.default_width === "wide" ? "wide" : "reading",
  };
}

export function validatePartialPreferences(
  input: PartialUserPreferences,
): ValidatedPartial {
  const value: PartialUserPreferences = {};

  if (input.autoShowOutline !== undefined) {
    if (typeof input.autoShowOutline !== "boolean") {
      return { ok: false, error: "autoShowOutline must be a boolean" };
    }
    value.autoShowOutline = input.autoShowOutline;
  }

  if (input.defaultWidth !== undefined) {
    if (input.defaultWidth !== "reading" && input.defaultWidth !== "wide") {
      return { ok: false, error: "defaultWidth must be 'reading' or 'wide'" };
    }
    value.defaultWidth = input.defaultWidth;
  }

  return { ok: true, value };
}

export async function getUserPreferences(
  ownerId: string,
): Promise<UserPreferences> {
  const result = await sql<UserPreferencesRow>`
    SELECT auto_show_outline, default_width
    FROM user_preferences
    WHERE owner_id = ${ownerId}
    LIMIT 1
  `;
  return mergeWithDefaults(result.rows[0] ?? null);
}

export async function upsertUserPreferences(
  ownerId: string,
  partial: PartialUserPreferences,
): Promise<UserPreferences> {
  const validated = validatePartialPreferences(partial);
  if (!validated.ok) throw new Error(validated.error);
  const merged: UserPreferences = {
    ...DEFAULT_PREFERENCES,
    ...validated.value,
  };

  const result = await sql<UserPreferencesRow>`
    INSERT INTO user_preferences (
      owner_id, auto_show_outline, default_width, updated_at
    )
    VALUES (
      ${ownerId},
      ${merged.autoShowOutline},
      ${merged.defaultWidth},
      now()
    )
    ON CONFLICT (owner_id) DO UPDATE SET
      auto_show_outline = COALESCE(${validated.value.autoShowOutline ?? null}, user_preferences.auto_show_outline),
      default_width     = COALESCE(${validated.value.defaultWidth ?? null}, user_preferences.default_width),
      updated_at = now()
    RETURNING auto_show_outline, default_width
  `;
  return mergeWithDefaults(result.rows[0] ?? null);
}
