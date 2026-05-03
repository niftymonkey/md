import { describe, expect, it } from "vitest";
import { buildPreHydrationScript } from "./pre-hydration-script";

describe("buildPreHydrationScript", () => {
  describe("when the request is authed", () => {
    const script = buildPreHydrationScript(true);

    it("does NOT read md.width from localStorage (server attrs are authoritative)", () => {
      expect(script).not.toContain("md.width");
    });

    it("does NOT read md.outline.shown from localStorage", () => {
      expect(script).not.toContain("md.outline.shown");
    });

    it("does NOT set data-width client-side", () => {
      expect(script).not.toContain("data-width");
    });

    it("does NOT set data-outline-hidden client-side", () => {
      expect(script).not.toContain("data-outline-hidden");
    });

    it("still reads md.dev-theme (dev-only theme switcher remains client-side)", () => {
      expect(script).toContain("md.dev-theme");
    });

    it("still detects mac platform from UA", () => {
      expect(script).toContain("data-platform");
    });
  });

  describe("when the request is unauthed", () => {
    const script = buildPreHydrationScript(false);

    it("reads md.width from localStorage", () => {
      expect(script).toContain("md.width");
    });

    it("reads md.outline.shown from localStorage", () => {
      expect(script).toContain("md.outline.shown");
    });

    it("sets data-width when wide", () => {
      expect(script).toContain("data-width");
    });

    it("sets data-outline-hidden when shown=false", () => {
      expect(script).toContain("data-outline-hidden");
    });

    it("still reads md.dev-theme", () => {
      expect(script).toContain("md.dev-theme");
    });

    it("still detects mac platform", () => {
      expect(script).toContain("data-platform");
    });
  });

  describe("safety", () => {
    it("wraps the body in try/catch so a bad localStorage doesn't break first paint (authed)", () => {
      const script = buildPreHydrationScript(true);
      expect(script).toMatch(/try\s*{/);
      expect(script).toMatch(/catch\s*\(/);
    });

    it("wraps the body in try/catch (unauthed)", () => {
      const script = buildPreHydrationScript(false);
      expect(script).toMatch(/try\s*{/);
      expect(script).toMatch(/catch\s*\(/);
    });

    it("returns an IIFE so identifiers don't leak to window scope", () => {
      const script = buildPreHydrationScript(false);
      expect(script.trimStart().startsWith("(function()")).toBe(true);
      expect(script.trimEnd().endsWith("})();")).toBe(true);
    });
  });
});
