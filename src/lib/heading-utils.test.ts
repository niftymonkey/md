import { describe, expect, it } from "vitest";
import {
  parseHeadings,
  shouldAutoShowOutline,
} from "./heading-utils";

describe("parseHeadings", () => {
  it("ignores headings inside fenced code blocks without losing later document headings", () => {
    const headings = parseHeadings(`# Install

\`\`\`text
=== BEGIN SKILL.md ===
# md-upload

## Authentication

\`\`\`bash
grep '^MD_API_KEY=' ~/.env
\`\`\`

## Content source
## Upload
### Title
## Delete

## Notes for the installing Claude
`);

    expect(headings).toEqual([
      { id: "content-source", level: 2, text: "Content source" },
      { id: "upload", level: 2, text: "Upload" },
      { id: "title", level: 3, text: "Title" },
      { id: "delete", level: 2, text: "Delete" },
      {
        id: "notes-for-the-installing-claude",
        level: 2,
        text: "Notes for the installing Claude",
      },
    ]);
  });

  it("ignores headings inside tilde fenced code blocks", () => {
    const headings = parseHeadings(`## Before

~~~text
## Inside fence
~~~

## After`);

    expect(headings).toEqual([
      { id: "before", level: 2, text: "Before" },
      { id: "after", level: 2, text: "After" },
    ]);
  });
});

describe("outline auto-show eligibility", () => {
  it("auto-shows for two top-level sections", () => {
    expect(
      shouldAutoShowOutline([
        { id: "objective", level: 2, text: "Objective" },
        { id: "steps", level: 2, text: "Steps" },
      ]),
    ).toBe(true);
  });

  it("auto-shows for one section with enough nested structure", () => {
    expect(
      shouldAutoShowOutline([
        { id: "usage", level: 2, text: "Usage" },
        { id: "setup", level: 3, text: "Setup" },
        { id: "auth", level: 3, text: "Auth" },
        { id: "limits", level: 3, text: "Limits" },
      ]),
    ).toBe(true);
  });

  it("keeps short single-section docs closed by default", () => {
    expect(
      shouldAutoShowOutline([
        { id: "objective", level: 2, text: "Objective" },
      ]),
    ).toBe(false);
  });
});
