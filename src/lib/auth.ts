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

export async function requireAuth(req: Request): Promise<AuthResult> {
  const authHeader = req.headers.get("authorization");

  if (authHeader?.startsWith("Bearer ")) {
    const token = authHeader.slice("Bearer ".length).trim();
    if (!token) {
      return { authenticated: false, status: 401, reason: "Empty bearer token" };
    }

    const match = await findActiveTokenByHash(hashToken(token));
    if (!match) {
      return { authenticated: false, status: 401, reason: "Invalid API key" };
    }
    void touchLastUsed(match.id).catch(() => {});
    return { authenticated: true, ownerId: match.ownerId, via: "bearer" };
  }

  return await resolveSession();
}

export async function requireSessionAuth(
  req: Request,
): Promise<SessionAuthResult> {
  if (req.headers.get("authorization")?.startsWith("Bearer ")) {
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
