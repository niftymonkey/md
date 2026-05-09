import { describe, it, expect } from "vitest";
import { apply, type ApplyResult } from "./operation-applier";
import type { EditOp } from "./edit-op-schema";

function mkContent(lines: string[]): string {
  return lines.join("\n") + "\n";
}

function expectOk(r: ApplyResult): asserts r is Extract<ApplyResult, { ok: true }> {
  if (!r.ok) {
    throw new Error(
      `expected ok=true but got error ${JSON.stringify(r.error)} at op ${r.failedAt}`,
    );
  }
}

describe("apply — single replace op", () => {
  it("replaces a unique string match", () => {
    const ops: EditOp[] = [
      { type: "replace", find: "foo", replace: "bar", replaceAll: false },
    ];
    const result = apply("hello foo world\n", ops);
    expectOk(result);
    expect(result.content).toBe("hello bar world\n");
  });

  it("returns ambiguous_match when query matches multiple times without replaceAll", () => {
    const ops: EditOp[] = [
      { type: "replace", find: "foo", replace: "bar", replaceAll: false },
    ];
    const result = apply("foo foo\n", ops);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.kind).toBe("ambiguous_match");
      if (result.error.kind === "ambiguous_match") {
        expect(result.error.matchCount).toBe(2);
        expect(result.error.matches).toHaveLength(2);
        expect(result.error.matches[0]?.line).toBeGreaterThan(0);
        expect(result.error.matches[0]?.previewLines.length).toBeGreaterThan(0);
      }
      expect(result.failedAt).toBe(0);
    }
  });

  it("replaceAll: true replaces every occurrence", () => {
    const ops: EditOp[] = [
      { type: "replace", find: "foo", replace: "bar", replaceAll: true },
    ];
    const result = apply("foo foo foo\n", ops);
    expectOk(result);
    expect(result.content).toBe("bar bar bar\n");
  });

  it("returns no_match when query is absent", () => {
    const ops: EditOp[] = [
      { type: "replace", find: "missing", replace: "x", replaceAll: false },
    ];
    const result = apply("hello\n", ops);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.kind).toBe("no_match");
      expect(result.failedAt).toBe(0);
    }
  });
});

describe("apply — line-addressed ops, single", () => {
  const content = mkContent(["one", "two", "three", "four"]);

  it("insertAfterLine inserts after the given 1-indexed line", () => {
    const result = apply(content, [
      { type: "insertAfterLine", line: 2, content: "INSERTED" },
    ]);
    expectOk(result);
    expect(result.content).toBe(mkContent(["one", "two", "INSERTED", "three", "four"]));
  });

  it("insertAfterLine line=0 inserts at the very top", () => {
    const result = apply(content, [
      { type: "insertAfterLine", line: 0, content: "TOP" },
    ]);
    expectOk(result);
    expect(result.content).toBe(mkContent(["TOP", "one", "two", "three", "four"]));
  });

  it("insertBeforeLine inserts before the given 1-indexed line", () => {
    const result = apply(content, [
      { type: "insertBeforeLine", line: 3, content: "BEFORE" },
    ]);
    expectOk(result);
    expect(result.content).toBe(mkContent(["one", "two", "BEFORE", "three", "four"]));
  });

  it("deleteLineRange removes the inclusive range", () => {
    const result = apply(content, [
      { type: "deleteLineRange", from: 2, to: 3 },
    ]);
    expectOk(result);
    expect(result.content).toBe(mkContent(["one", "four"]));
  });

  it("replaceLineRange replaces the inclusive range with new content", () => {
    const result = apply(content, [
      { type: "replaceLineRange", from: 2, to: 3, content: "ALPHA\nBETA" },
    ]);
    expectOk(result);
    expect(result.content).toBe(mkContent(["one", "ALPHA", "BETA", "four"]));
  });

  it("returns line_out_of_range when line exceeds doc length", () => {
    const result = apply(content, [
      { type: "insertAfterLine", line: 99, content: "X" },
    ]);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.kind).toBe("line_out_of_range");
    }
  });

  it("returns range_out_of_range when 'to' exceeds doc length", () => {
    const result = apply(content, [
      { type: "deleteLineRange", from: 2, to: 99 },
    ]);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.kind).toBe("range_out_of_range");
    }
  });
});

describe("apply — batch with line-addressed ops resolving against snapshot", () => {
  const content = mkContent(["a", "b", "c", "d", "e"]);

  it("two deleteLineRange ops both resolve against the original line numbers", () => {
    // Naive left-to-right would shift the second range. Snapshot semantics
    // means both resolve against {a,b,c,d,e}: delete lines 1 and lines 4.
    const result = apply(content, [
      { type: "deleteLineRange", from: 1, to: 1 },
      { type: "deleteLineRange", from: 4, to: 4 },
    ]);
    expectOk(result);
    expect(result.content).toBe(mkContent(["b", "c", "e"]));
  });

  it("insertAfterLine ops resolve against snapshot line numbers", () => {
    const result = apply(content, [
      { type: "insertAfterLine", line: 1, content: "X" },
      { type: "insertAfterLine", line: 3, content: "Y" },
    ]);
    expectOk(result);
    // Both anchor to original line numbers: after line 1 ("a") and after line 3 ("c").
    expect(result.content).toBe(mkContent(["a", "X", "b", "c", "Y", "d", "e"]));
  });

  it("rejects overlapping line-addressed ops in the same batch", () => {
    const result = apply(content, [
      { type: "deleteLineRange", from: 2, to: 3 },
      { type: "replaceLineRange", from: 3, to: 4, content: "X" },
    ]);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.kind).toBe("overlapping_line_ops");
    }
  });
});

describe("apply — mixed line and string ops", () => {
  it("string ops resolve against running content (post-line-ops)", () => {
    // Line op converts "ALPHA" -> "ALPHA-X". String op then sees the new text.
    const content = mkContent(["one ALPHA", "two", "three"]);
    const result = apply(content, [
      { type: "replaceLineRange", from: 1, to: 1, content: "one ALPHA-X" },
      { type: "replace", find: "ALPHA-X", replace: "BETA", replaceAll: false },
    ]);
    expectOk(result);
    expect(result.content).toBe(mkContent(["one BETA", "two", "three"]));
  });

  it("string op against text not visible in snapshot still works (running-content semantics)", () => {
    // The first op produces text the second op then matches.
    const content = mkContent(["foo", "bar"]);
    const result = apply(content, [
      { type: "insertAfterLine", line: 1, content: "NEEDLE" },
      { type: "replace", find: "NEEDLE", replace: "FOUND", replaceAll: false },
    ]);
    expectOk(result);
    expect(result.content).toBe(mkContent(["foo", "FOUND", "bar"]));
  });
});

describe("apply — atomicity", () => {
  it("returns the original content unchanged when any op fails", () => {
    const content = mkContent(["one", "two", "three"]);
    const result = apply(content, [
      { type: "insertAfterLine", line: 1, content: "X" },
      { type: "replace", find: "missing", replace: "y", replaceAll: false },
    ]);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.failedAt).toBe(1);
      expect(result.error.kind).toBe("no_match");
    }
  });
});

describe("apply — setContent op", () => {
  it("replaces the entire document body", () => {
    const result = apply("# Old\n\nbody\n", [
      { type: "setContent", content: "# New\n\nbody2\n" },
    ]);
    expectOk(result);
    expect(result.content).toBe("# New\n\nbody2\n");
  });

  it("accepts empty content (empties the doc)", () => {
    const result = apply("# Old\n", [{ type: "setContent", content: "" }]);
    expectOk(result);
    expect(result.content).toBe("");
  });
});

describe("apply — to: -1 sentinel", () => {
  const content = mkContent(["a", "b", "c", "d", "e"]);

  it("deleteLineRange to: -1 deletes through end of doc", () => {
    const result = apply(content, [
      { type: "deleteLineRange", from: 3, to: -1 },
    ]);
    expectOk(result);
    expect(result.content).toBe(mkContent(["a", "b"]));
  });

  it("replaceLineRange to: -1 replaces from N through end with new content", () => {
    const result = apply(content, [
      { type: "replaceLineRange", from: 1, to: -1, content: "X\nY" },
    ]);
    expectOk(result);
    expect(result.content).toBe(mkContent(["X", "Y"]));
  });

  it("from: 1, to: -1 replaces the whole doc (alternative to setContent)", () => {
    const result = apply(content, [
      { type: "replaceLineRange", from: 1, to: -1, content: "ALL NEW" },
    ]);
    expectOk(result);
    expect(result.content).toBe(mkContent(["ALL NEW"]));
  });
});

describe("apply — replaceSection op", () => {
  const md = [
    "# Intro",
    "intro body",
    "",
    "# API",
    "old api body",
    "more old",
    "",
    "# Other",
    "other body",
    "",
  ].join("\n");

  it("replaces the addressed section, preserving siblings", () => {
    const result = apply(md, [
      {
        type: "replaceSection",
        headingPath: ["API"],
        content: "# API\nfresh body",
      },
    ]);
    expectOk(result);
    expect(result.content).toBe(
      [
        "# Intro",
        "intro body",
        "",
        "# API",
        "fresh body",
        "# Other",
        "other body",
        "",
      ].join("\n"),
    );
  });

  it("returns heading_not_found for an unknown path", () => {
    const result = apply(md, [
      {
        type: "replaceSection",
        headingPath: ["Missing"],
        content: "x",
      },
    ]);
    expect(result.ok).toBe(false);
    if (result.ok) throw new Error("unreachable");
    expect(result.error.kind).toBe("heading_not_found");
  });

  it("returns ambiguous_heading when duplicates match", () => {
    const dupes = ["# API", "first", "# API", "second"].join("\n");
    const result = apply(dupes, [
      {
        type: "replaceSection",
        headingPath: ["API"],
        content: "# API\nx",
      },
    ]);
    expect(result.ok).toBe(false);
    if (result.ok) throw new Error("unreachable");
    expect(result.error.kind).toBe("ambiguous_heading");
  });

  it("flags overlap when a replaceSection collides with a replaceLineRange in the same batch", () => {
    // The "API" section spans lines 4–7. A replaceLineRange at lines 5–5 lands
    // inside that same range, so the applier must flag overlapping_line_ops.
    const result = apply(md, [
      {
        type: "replaceSection",
        headingPath: ["API"],
        content: "# API\nx",
      },
      { type: "replaceLineRange", from: 5, to: 5, content: "y" },
    ]);
    expect(result.ok).toBe(false);
    if (result.ok) throw new Error("unreachable");
    expect(result.error.kind).toBe("overlapping_line_ops");
  });
});

describe("apply — empty ops batch", () => {
  it("returns the content unchanged for an empty batch", () => {
    // Defensive: parseEditOps rejects empty arrays at the boundary, but apply
    // should be safe to call with [].
    const content = "hello\n";
    const result = apply(content, []);
    expectOk(result);
    expect(result.content).toBe(content);
  });
});
