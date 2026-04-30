import { withAuth } from "@workos-inc/authkit-nextjs";
import { isEmailAllowed } from "@/lib/access";
import {
  findActiveTokenByHash,
  hashToken,
  touchLastUsed,
} from "@/lib/api-tokens";

export type AuthResult =
  | { authenticated: true; ownerId: string; via: "bearer" | "session" }
  | { authenticated: false; status: 401 | 403; reason: string };

export type SessionAuthResult =
  | { authenticated: true; ownerId: string; email: string }
  | { authenticated: false; status: 401 | 403; reason: string };

// RFC 7235 §2.1 — auth-scheme tokens are case-insensitive. The captured group
// may be empty (e.g. "Bearer " with trailing whitespace and no token), in
// which case the empty-bearer branch below fires.
const BEARER_RE = /^Bearer(?:\s+(.*))?$/i;

export async function requireAuth(req: Request): Promise<AuthResult> {
  const authHeader = req.headers.get("authorization");
  const bearerMatch = authHeader?.match(BEARER_RE);

  if (bearerMatch) {
    const token = (bearerMatch[1] ?? "").trim();
    if (!token) {
      return { authenticated: false, status: 401, reason: "Empty bearer token" };
    }

    const match = await findActiveTokenByHash(hashToken(token));
    if (!match) {
      return { authenticated: false, status: 401, reason: "Invalid API key" };
    }
    void touchLastUsed(match.id).catch((err) => {
      console.warn("[auth] failed to update last_used_at", err);
    });
    return { authenticated: true, ownerId: match.ownerId, via: "bearer" };
  }

  return await resolveSession();
}

export async function requireSessionAuth(
  req: Request,
): Promise<SessionAuthResult> {
  // Reject any Authorization header — token-management is session-only by design.
  // Stricter than `startsWith("Bearer ")` so future auth schemes (HMAC, ApiKey, etc.)
  // can't silently bypass this check, and so case variants like `bearer foo` are caught.
  if ((req.headers.get("authorization") ?? "").trim().length > 0) {
    return {
      authenticated: false,
      status: 401,
      reason: "Session required for token management",
    };
  }
  const { user } = await withAuth();
  if (!user) {
    return { authenticated: false, status: 401, reason: "Not signed in" };
  }
  if (!isEmailAllowed(user.email)) {
    return {
      authenticated: false,
      status: 403,
      reason: "Email not on allow list",
    };
  }
  return { authenticated: true, ownerId: user.id, email: user.email };
}

async function resolveSession(): Promise<AuthResult> {
  const { user } = await withAuth();
  if (!user) {
    return { authenticated: false, status: 401, reason: "Not signed in" };
  }
  if (!isEmailAllowed(user.email)) {
    return {
      authenticated: false,
      status: 403,
      reason: "Email not on allow list",
    };
  }
  return { authenticated: true, ownerId: user.id, via: "session" };
}
