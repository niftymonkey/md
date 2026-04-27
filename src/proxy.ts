import { authkitProxy } from "@workos-inc/authkit-nextjs";

export default authkitProxy();

export const config = {
  matcher: ["/", "/api/upload", "/api/docs/:slug*"],
};
