import { authkitProxy } from "@workos-inc/authkit-nextjs";

export default authkitProxy();

export const config = {
  matcher: [
    "/",
    "/new",
    "/v/:slug*",
    "/edit/:slug*",
    "/settings",
    "/api/upload",
    "/api/docs/:slug*",
    "/api/list",
    "/api/tokens",
    "/api/tokens/:id*",
  ],
};
