import { withAuth } from "@workos-inc/authkit-nextjs";
import { isEmailAllowed } from "@/lib/access";

export type AuthResult =
  | { authenticated: true; ownerId: string; via: "bearer" | "session" }
  | { authenticated: false; status: 401 | 403; reason: string };

// Trim env values to defend against accidental trailing whitespace (e.g. from
// `echo "..." | vercel env add`, which pipes a trailing newline into the value).
const API_KEY = (process.env.MD_API_KEY ?? "").trim();
const API_OWNER_ID = (process.env.MD_API_OWNER_ID ?? "").trim();

function timingSafeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let mismatch = 0;
  for (let i = 0; i < a.length; i++) {
    mismatch |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }
  return mismatch === 0;
}

export async function requireAuth(req: Request): Promise<AuthResult> {
  const authHeader = req.headers.get("authorization");

  if (authHeader?.startsWith("Bearer ")) {
    const token = authHeader.slice("Bearer ".length).trim();
    if (!API_KEY || !API_OWNER_ID) {
      return {
        authenticated: false,
        status: 401,
        reason: "API authentication not configured on server",
      };
    }
    if (!timingSafeEqual(token, API_KEY)) {
      return { authenticated: false, status: 401, reason: "Invalid API key" };
    }
    return { authenticated: true, ownerId: API_OWNER_ID, via: "bearer" };
  }

  const { user } = await withAuth();
  if (!user) {
    return { authenticated: false, status: 401, reason: "Not signed in" };
  }
  if (!isEmailAllowed(user.email)) {
    return { authenticated: false, status: 403, reason: "Email not on allow list" };
  }
  return { authenticated: true, ownerId: user.id, via: "session" };
}
