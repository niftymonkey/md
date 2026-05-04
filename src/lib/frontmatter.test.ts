import { describe, expect, it } from "vitest";
import { parseFrontmatter } from "./frontmatter";

describe("parseFrontmatter", () => {
  it("returns no fields and the original body when no frontmatter is present", () => {
    const result = parseFrontmatter("# Hello\n\nbody text\n");
    expect(result.fields).toEqual([]);
    expect(result.body).toBe("# Hello\n\nbody text\n");
  });

  it("extracts simple key/value pairs and returns the stripped body", () => {
    const input = "---\nname: foo\ndescription: bar\n---\n# Heading\n\nBody.";
    const result = parseFrontmatter(input);
    expect(result.fields).toEqual([
      { key: "name", value: "foo" },
      { key: "description", value: "bar" },
    ]);
    expect(result.body).toBe("# Heading\n\nBody.");
  });

  it("preserves arbitrary key names including hyphens", () => {
    const result = parseFrontmatter("---\nallowed-tools: Read, Grep, Glob\n---\nbody");
    expect(result.fields).toEqual([{ key: "allowed-tools", value: "Read, Grep, Glob" }]);
  });

  it("strips matching surrounding quotes from values", () => {
    const result = parseFrontmatter('---\ntitle: "Quoted"\nname: \'single\'\n---\nbody');
    expect(result.fields).toEqual([
      { key: "title", value: "Quoted" },
      { key: "name", value: "single" },
    ]);
  });

  it("joins continuation lines into a single value", () => {
    const input = "---\ndescription: line one\n  line two\n  line three\nname: foo\n---\nbody";
    const result = parseFrontmatter(input);
    expect(result.fields).toEqual([
      { key: "description", value: "line one line two line three" },
      { key: "name", value: "foo" },
    ]);
  });

  it("handles a value-less key followed by an indented continuation", () => {
    const input = "---\ndescription:\n  multi-line value\n---\nbody";
    const result = parseFrontmatter(input);
    expect(result.fields).toEqual([{ key: "description", value: "multi-line value" }]);
  });

  it("returns the original content when the closing fence is missing", () => {
    const input = "---\nname: foo\n# Heading\nbody";
    const result = parseFrontmatter(input);
    expect(result.fields).toEqual([]);
    expect(result.body).toBe(input);
  });

  it("ignores blank lines inside the frontmatter block", () => {
    const result = parseFrontmatter("---\nname: foo\n\ndescription: bar\n---\nbody");
    expect(result.fields).toEqual([
      { key: "name", value: "foo" },
      { key: "description", value: "bar" },
    ]);
  });

  it("preserves CRLF line endings in the body", () => {
    const input = "---\r\nname: foo\r\n---\r\n# Heading\r\nbody\r\n";
    const result = parseFrontmatter(input);
    expect(result.fields).toEqual([{ key: "name", value: "foo" }]);
    expect(result.body).toBe("# Heading\r\nbody\r\n");
  });

  it("treats empty frontmatter as no fields and an empty body", () => {
    const result = parseFrontmatter("---\n---\nbody");
    expect(result.fields).toEqual([]);
    expect(result.body).toBe("body");
  });

  it("does not treat a thematic break in the body as a frontmatter fence", () => {
    const input = "Intro.\n\n---\n\nMore body.";
    const result = parseFrontmatter(input);
    expect(result.fields).toEqual([]);
    expect(result.body).toBe(input);
  });
});
