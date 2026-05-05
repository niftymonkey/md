import { requireAuth, type AuthResult } from "@/lib/auth";
import { getDocBySlug, type Doc } from "@/lib/db";

export type AuthSuccess = Extract<AuthResult, { authenticated: true }>;

export type OwnedDocResult =
  | { ok: true; auth: AuthSuccess; doc: Doc }
  | { ok: false; response: Response };

export function jsonError(status: number, message: string): Response {
  return new Response(JSON.stringify({ error: message }), {
    status,
    headers: { "content-type": "application/json" },
  });
}

export async function requireOwnedDoc(
  req: Request,
  slug: string,
): Promise<OwnedDocResult> {
  const auth = await requireAuth(req);
  if (!auth.authenticated) {
    return { ok: false, response: jsonError(auth.status, auth.reason) };
  }
  const doc = await getDocBySlug(slug);
  if (!doc || doc.ownerId !== auth.ownerId) {
    return { ok: false, response: jsonError(404, "Document not found") };
  }
  return { ok: true, auth, doc };
}
