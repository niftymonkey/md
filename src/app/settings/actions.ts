"use server";

import { revalidatePath } from "next/cache";
import { withAuth } from "@workos-inc/authkit-nextjs";
import { isEmailAllowed } from "@/lib/access";
import {
  upsertUserPreferences,
  validatePartialPreferences,
  type PartialUserPreferences,
} from "@/lib/user-preferences";

export type SaveResult = { ok: true } | { ok: false; error: string };

async function authedOwnerId(): Promise<string | null> {
  const { user } = await withAuth();
  if (!user || !isEmailAllowed(user.email)) return null;
  return user.id;
}

export async function saveReadingPrefs(input: {
  autoShowOutline?: boolean;
  defaultWidth?: "reading" | "wide";
}): Promise<SaveResult> {
  const ownerId = await authedOwnerId();
  if (!ownerId) return { ok: false, error: "Not authorized" };

  const partial: PartialUserPreferences = {};
  if (input.autoShowOutline !== undefined) {
    partial.autoShowOutline = input.autoShowOutline;
  }
  if (input.defaultWidth !== undefined) {
    partial.defaultWidth = input.defaultWidth;
  }

  const validated = validatePartialPreferences(partial);
  if (!validated.ok) return { ok: false, error: validated.error };
  await upsertUserPreferences(ownerId, validated.value);
  revalidatePath("/settings");
  revalidatePath("/", "layout");
  return { ok: true };
}
