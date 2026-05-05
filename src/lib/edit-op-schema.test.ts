import { describe, it, expect } from "vitest";
import { parseEditOp, parseEditOps, type EditOp } from "./edit-op-schema";

describe("parseEditOp — replace", () => {
  it("accepts a minimal replace op", () => {
    const result = parseEditOp({
      type: "replace",
      find: "foo",
      replace: "bar",
    });
    expect(result.ok).toBe(true);
    if (result.ok) {
      const op = result.op;
      expect(op).toEqual({
        type: "replace",
        find: "foo",
        replace: "bar",
        replaceAll: false,
      });
    }
  });

  it("accepts replace with replaceAll: true", () => {
    const result = parseEditOp({
      type: "replace",
      find: "foo",
      replace: "bar",
      replaceAll: true,
    });
    expect(result.ok).toBe(true);
    if (result.ok && result.op.type === "replace") {
      expect(result.op.replaceAll).toBe(true);
    }
  });

  it("rejects replace with empty find", () => {
    const result = parseEditOp({
      type: "replace",
      find: "",
      replace: "bar",
    });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toMatch(/find/i);
  });

  it("rejects replace with non-string find", () => {
    const result = parseEditOp({
      type: "replace",
      find: 42,
      replace: "bar",
    });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toMatch(/find.*string/i);
  });

  it("rejects replace with non-string replace", () => {
    const result = parseEditOp({
      type: "replace",
      find: "foo",
      replace: null,
    });
    expect(result.ok).toBe(false);
  });

  it("rejects replace with non-boolean replaceAll", () => {
    const result = parseEditOp({
      type: "replace",
      find: "foo",
      replace: "bar",
      replaceAll: "yes",
    });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toMatch(/replaceAll/i);
  });
});

describe("parseEditOp — insertAfterLine / insertBeforeLine", () => {
  it("accepts a valid insertAfterLine op", () => {
    const result = parseEditOp({
      type: "insertAfterLine",
      line: 5,
      content: "new content",
    });
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.op).toEqual({
        type: "insertAfterLine",
        line: 5,
        content: "new content",
      });
    }
  });

  it("accepts insertBeforeLine at line 1", () => {
    const result = parseEditOp({
      type: "insertBeforeLine",
      line: 1,
      content: "first",
    });
    expect(result.ok).toBe(true);
  });

  it("accepts insertAfterLine at line 0 (insert at top)", () => {
    // Convention: insertAfterLine line=0 means "before line 1".
    // Allowed so callers don't need a separate insertAtTop op.
    const result = parseEditOp({
      type: "insertAfterLine",
      line: 0,
      content: "header",
    });
    expect(result.ok).toBe(true);
  });

  it("rejects insertBeforeLine at line 0", () => {
    const result = parseEditOp({
      type: "insertBeforeLine",
      line: 0,
      content: "x",
    });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toMatch(/line/i);
  });

  it("rejects negative line", () => {
    const result = parseEditOp({
      type: "insertAfterLine",
      line: -1,
      content: "x",
    });
    expect(result.ok).toBe(false);
  });

  it("rejects non-integer line", () => {
    const result = parseEditOp({
      type: "insertAfterLine",
      line: 1.5,
      content: "x",
    });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toMatch(/integer/i);
  });

  it("rejects non-string content", () => {
    const result = parseEditOp({
      type: "insertAfterLine",
      line: 1,
      content: 42,
    });
    expect(result.ok).toBe(false);
  });
});

describe("parseEditOp — deleteLineRange", () => {
  it("accepts a valid range", () => {
    const result = parseEditOp({
      type: "deleteLineRange",
      from: 3,
      to: 7,
    });
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.op).toEqual({ type: "deleteLineRange", from: 3, to: 7 });
    }
  });

  it("accepts a single-line range (from === to)", () => {
    const result = parseEditOp({
      type: "deleteLineRange",
      from: 5,
      to: 5,
    });
    expect(result.ok).toBe(true);
  });

  it("rejects from > to", () => {
    const result = parseEditOp({
      type: "deleteLineRange",
      from: 7,
      to: 3,
    });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toMatch(/from.*to|range/i);
  });

  it("rejects from < 1", () => {
    const result = parseEditOp({
      type: "deleteLineRange",
      from: 0,
      to: 5,
    });
    expect(result.ok).toBe(false);
  });

  it("rejects non-integer to", () => {
    const result = parseEditOp({
      type: "deleteLineRange",
      from: 1,
      to: 5.5,
    });
    expect(result.ok).toBe(false);
  });
});

describe("parseEditOp — replaceLineRange", () => {
  it("accepts a valid replaceLineRange", () => {
    const result = parseEditOp({
      type: "replaceLineRange",
      from: 2,
      to: 4,
      content: "new\nlines",
    });
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.op).toEqual({
        type: "replaceLineRange",
        from: 2,
        to: 4,
        content: "new\nlines",
      });
    }
  });

  it("accepts empty content (degenerate to deletion)", () => {
    const result = parseEditOp({
      type: "replaceLineRange",
      from: 2,
      to: 4,
      content: "",
    });
    expect(result.ok).toBe(true);
  });

  it("rejects from > to", () => {
    const result = parseEditOp({
      type: "replaceLineRange",
      from: 5,
      to: 2,
      content: "x",
    });
    expect(result.ok).toBe(false);
  });

  it("rejects missing content", () => {
    const result = parseEditOp({
      type: "replaceLineRange",
      from: 1,
      to: 2,
    });
    expect(result.ok).toBe(false);
  });
});

describe("parseEditOp — discriminator and shape", () => {
  it("rejects non-object input", () => {
    expect(parseEditOp(null).ok).toBe(false);
    expect(parseEditOp("foo").ok).toBe(false);
    expect(parseEditOp(42).ok).toBe(false);
    expect(parseEditOp([]).ok).toBe(false);
  });

  it("rejects missing type", () => {
    const result = parseEditOp({ find: "a", replace: "b" });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toMatch(/type/i);
  });

  it("rejects unknown type", () => {
    const result = parseEditOp({ type: "moveLines", from: 1, to: 2 });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toMatch(/type|unknown/i);
  });
});

describe("parseEditOps (batch)", () => {
  it("accepts a non-empty array of ops", () => {
    const result = parseEditOps([
      { type: "replace", find: "a", replace: "b" },
      { type: "deleteLineRange", from: 1, to: 1 },
    ]);
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.ops).toHaveLength(2);
  });

  it("rejects non-array input", () => {
    expect(parseEditOps({ type: "replace", find: "a", replace: "b" }).ok).toBe(
      false,
    );
    expect(parseEditOps(null).ok).toBe(false);
  });

  it("rejects empty array", () => {
    const result = parseEditOps([]);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toMatch(/empty|at least/i);
  });

  it("reports the index of a malformed op", () => {
    const result = parseEditOps([
      { type: "replace", find: "a", replace: "b" },
      { type: "deleteLineRange", from: 5, to: 1 }, // invalid range
    ]);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error).toMatch(/\[1\]|index 1|second/i);
    }
  });
});

describe("EditOp type narrowing", () => {
  it("compiles when narrowing on the type discriminator", () => {
    const op: EditOp = {
      type: "replace",
      find: "a",
      replace: "b",
      replaceAll: false,
    };
    if (op.type === "replace") {
      expect(typeof op.find).toBe("string");
      expect(typeof op.replaceAll).toBe("boolean");
    }
  });
});
