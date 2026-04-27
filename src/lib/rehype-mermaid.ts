import type { Element, Root } from "hast";
import { visit } from "unist-util-visit";
import { toString } from "hast-util-to-string";

/**
 * Rewrites ```mermaid fenced code blocks into a placeholder `div` that the
 * client-side `<Mermaid>` component renders as an SVG diagram. Must run BEFORE
 * `@shikijs/rehype` so shiki doesn't try to syntax-highlight the chart source.
 */
export function rehypeMermaid() {
  return (tree: Root) => {
    visit(tree, "element", (node: Element, index, parent) => {
      if (node.tagName !== "pre" || index === undefined || !parent) return;
      const code = node.children?.[0];
      if (!code || code.type !== "element" || code.tagName !== "code") return;
      const className = code.properties?.className;
      const classes = Array.isArray(className) ? className : [];
      if (!classes.includes("language-mermaid")) return;

      const chart = toString(code);
      parent.children[index] = {
        type: "element",
        tagName: "div",
        properties: { className: ["mermaid-block"], "data-chart": chart },
        children: [],
      };
    });
  };
}
