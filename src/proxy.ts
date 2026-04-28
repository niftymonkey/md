import { authkitProxy } from "@workos-inc/authkit-nextjs";

export default authkitProxy();

export const config = {
  matcher: ["/", "/edit/:slug*", "/api/upload", "/api/docs/:slug*", "/api/list"],
};
