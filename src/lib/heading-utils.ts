import type { Element, Root } from "hast";
import { toString as hastToString } from "hast-util-to-string";
import { visit } from "unist-util-visit";

export type Heading = { id: string; level: 2 | 3; text: string };

export function slugify(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^\w\s-]/g, "")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");
}

export function parseHeadings(markdown: string): Heading[] {
  const lines = markdown.split("\n");
  const headings: Heading[] = [];
  const seen = new Map<string, number>();
  let inFence = false;
  for (const line of lines) {
    if (line.startsWith("```")) {
      inFence = !inFence;
      continue;
    }
    if (inFence) continue;
    const m = /^(#{2,3}) (.+?)\s*#*\s*$/.exec(line);
    if (!m) continue;
    const level = m[1].length === 2 ? 2 : 3;
    const text = m[2].trim();
    const base = slugify(text);
    if (!base) continue;
    const count = seen.get(base) ?? 0;
    const id = count === 0 ? base : `${base}-${count}`;
    seen.set(base, count + 1);
    headings.push({ id, level, text });
  }
  return headings;
}

export function rehypeHeadingIds() {
  return (tree: Root) => {
    const seen = new Map<string, number>();
    visit(tree, "element", (node: Element) => {
      if (node.tagName !== "h2" && node.tagName !== "h3") return;
      if (node.properties?.id) return;
      const text = hastToString(node).trim();
      const base = slugify(text);
      if (!base) return;
      const count = seen.get(base) ?? 0;
      const id = count === 0 ? base : `${base}-${count}`;
      seen.set(base, count + 1);
      node.properties = node.properties ?? {};
      node.properties.id = id;
    });
  };
}
