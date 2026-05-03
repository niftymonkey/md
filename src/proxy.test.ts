import { unstable_doesMiddlewareMatch } from "next/experimental/testing/server";
import { describe, expect, it, vi } from "vitest";

vi.mock("@workos-inc/authkit-nextjs", () => ({
  authkitProxy: () => vi.fn(),
}));

import { config } from "./proxy";

function doesProxyMatch(url: string) {
  return unstable_doesMiddlewareMatch({
    config,
    nextConfig: {},
    url,
  });
}

describe("proxy matcher", () => {
  it("covers app routes that read AuthKit session state", () => {
    expect(doesProxyMatch("/")).toBe(true);
    expect(doesProxyMatch("/new")).toBe(true);
    expect(doesProxyMatch("/v/GEnemJPK")).toBe(true);
    expect(doesProxyMatch("/edit/GEnemJPK")).toBe(true);
    expect(doesProxyMatch("/settings")).toBe(true);
  });

  it("covers AuthKit and server action routes outside the old allowlist", () => {
    expect(doesProxyMatch("/auth")).toBe(true);
    expect(doesProxyMatch("/callback")).toBe(true);
    expect(doesProxyMatch("/settings?reader=wide")).toBe(true);
  });

  it("covers API routes that may require session auth", () => {
    expect(doesProxyMatch("/api/list")).toBe(true);
    expect(doesProxyMatch("/api/docs/GEnemJPK")).toBe(true);
    expect(doesProxyMatch("/api/tokens/token-id")).toBe(true);
  });

  it("skips static assets that do not need AuthKit session headers", () => {
    expect(doesProxyMatch("/_next/static/chunks/app.js")).toBe(false);
    expect(doesProxyMatch("/_next/image?url=%2Flogo.png&w=64&q=75")).toBe(false);
    expect(doesProxyMatch("/favicon.ico")).toBe(false);
    expect(doesProxyMatch("/logo.png")).toBe(false);
  });
});
