import { describe, expect, it } from "vitest";
import { generateToken, hashToken } from "./api-tokens";

describe("generateToken", () => {
  it("prefixes plaintext with mdk_", () => {
    const t = generateToken();
    expect(t.plaintext.startsWith("mdk_")).toBe(true);
  });

  it("produces a token long enough to be unguessable (~256 bits of entropy)", () => {
    const t = generateToken();
    // mdk_ (4) + base64url(32 bytes) = 4 + 43 = 47 chars
    expect(t.plaintext.length).toBe(47);
  });

  it("uses base64url alphabet for the random body", () => {
    const t = generateToken();
    const body = t.plaintext.slice("mdk_".length);
    expect(body).toMatch(/^[A-Za-z0-9_-]+$/);
  });

  it("yields a different value on every call", () => {
    const a = generateToken();
    const b = generateToken();
    expect(a.plaintext).not.toBe(b.plaintext);
    expect(a.hash).not.toBe(b.hash);
  });

  it("returns hash that matches hashToken(plaintext)", () => {
    const t = generateToken();
    expect(t.hash.length).toBeGreaterThan(0);
    expect(t.hash).toBe(hashToken(t.plaintext));
  });

  it("returns prefix equal to first 8 chars of plaintext", () => {
    const t = generateToken();
    expect(t.prefix).toBe(t.plaintext.slice(0, 8));
    expect(t.prefix.length).toBe(8);
  });
});

describe("hashToken", () => {
  it("is deterministic for the same input", () => {
    const h = hashToken("mdk_abc");
    expect(h.length).toBeGreaterThan(0);
    expect(hashToken("mdk_abc")).toBe(h);
  });

  it("differs for different inputs", () => {
    expect(hashToken("mdk_abc")).not.toBe(hashToken("mdk_xyz"));
  });

  it("returns a 64-char lowercase hex string (sha256 hex)", () => {
    const h = hashToken("any-input-value");
    expect(h).toMatch(/^[0-9a-f]{64}$/);
  });

  it("pins the sha256 hex of a known input — changing this would invalidate every existing token in the DB", () => {
    expect(hashToken("mdk_test")).toBe(
      "7b734232563402eeec9a4d637071044225ae4c9f3ed7ee5a956c5af37e81dc93",
    );
  });
});
