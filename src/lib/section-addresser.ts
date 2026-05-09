import { fromMarkdown } from "mdast-util-from-markdown";
import { toString as mdastToString } from "mdast-util-to-string";
import type { Heading, Root, RootContent } from "mdast";

/**
 * Resolves a heading path (e.g., ["API", "Errors"]) to an inclusive 1-indexed
 * line range that covers the targeted section: from the matched heading's
 * line through the line before the next sibling-or-higher heading (or the
 * last line of the doc if none follows).
 *
 * Heading text is matched against the rendered text of the heading node
 * (inline formatting like **bold** is stripped), with whitespace trimmed on
 * both sides. Matching is case-sensitive.
 */

export type SectionResolution =
  | { ok: true; fromLine: number; toLine: number }
  | { ok: false; error: SectionError };

export type SectionError =
  | { kind: "heading_not_found"; headingPath: string[] }
  | {
      kind: "ambiguous_heading";
      headingPath: string[];
      matchCount: number;
    };

type HeadingHit = {
  depth: number;
  text: string;
  startLine: number;
};

export function resolveSection(
  content: string,
  headingPath: string[],
): SectionResolution {
  const path = headingPath.map((p) => p.trim());
  const tree = fromMarkdown(content);
  const headings = collectHeadings(tree);

  const matches = findHeadingsAtPath(headings, path);
  if (matches.length === 0) {
    return { ok: false, error: { kind: "heading_not_found", headingPath } };
  }
  if (matches.length > 1) {
    return {
      ok: false,
      error: {
        kind: "ambiguous_heading",
        headingPath,
        matchCount: matches.length,
      },
    };
  }

  const matchedIndex = matches[0]!;
  const matched = headings[matchedIndex]!;

  // The section ends just before the next heading whose depth is <= the matched
  // heading's depth (a sibling or shallower header). Children with greater depth
  // remain inside this section.
  let toLine = lineCount(content);
  for (let i = matchedIndex + 1; i < headings.length; i++) {
    if (headings[i]!.depth <= matched.depth) {
      toLine = headings[i]!.startLine - 1;
      break;
    }
  }

  return { ok: true, fromLine: matched.startLine, toLine };
}

function collectHeadings(tree: Root): HeadingHit[] {
  const hits: HeadingHit[] = [];
  for (const child of tree.children) {
    visitNode(child, hits);
  }
  return hits;
}

function visitNode(node: RootContent, hits: HeadingHit[]): void {
  if (node.type === "heading") {
    const heading = node as Heading;
    const startLine = heading.position?.start.line;
    if (startLine === undefined) return;
    hits.push({
      depth: heading.depth,
      text: mdastToString(heading).trim(),
      startLine,
    });
  }
  // Headings can only appear as direct root children in CommonMark / GFM,
  // so a shallow walk over Root.children is sufficient. Containers like
  // blockquotes can hold headings but we deliberately ignore those — a
  // section reference inside a blockquote is not a structural section.
}

function findHeadingsAtPath(
  headings: HeadingHit[],
  path: string[],
): number[] {
  if (path.length === 0) return [];

  // Reduce the path step by step. After step k, `candidates` are the headings
  // that match path[0..k] under valid ancestor chains.
  let candidates: number[] = [];
  for (let i = 0; i < headings.length; i++) {
    if (headings[i]!.text === path[0]) candidates.push(i);
  }
  if (path.length === 1) return candidates;

  for (let step = 1; step < path.length; step++) {
    const wanted = path[step]!;
    const next: number[] = [];
    for (const parentIdx of candidates) {
      const parent = headings[parentIdx]!;
      // Walk forward from parent until a sibling-or-shallower heading appears.
      // Within that span, any heading whose depth is exactly parent.depth + 1
      // and whose text matches `wanted` is a child match.
      for (let j = parentIdx + 1; j < headings.length; j++) {
        const h = headings[j]!;
        if (h.depth <= parent.depth) break;
        if (h.depth === parent.depth + 1 && h.text === wanted) {
          next.push(j);
        }
      }
    }
    candidates = next;
    if (candidates.length === 0) return candidates;
  }
  return candidates;
}

function lineCount(content: string): number {
  if (content.length === 0) return 0;
  let count = 1;
  for (let i = 0; i < content.length; i++) {
    if (content.charCodeAt(i) === 10) {
      if (i === content.length - 1) break;
      count++;
    }
  }
  return count;
}
