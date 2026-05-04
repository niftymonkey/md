export type FrontmatterField = { key: string; value: string };

export type ParsedFrontmatter = {
  fields: FrontmatterField[];
  body: string;
};

const FRONTMATTER_RE = /^---\r?\n(?:([\s\S]*?)\r?\n)?---(?:\r?\n|$)/;

/**
 * Extracts a YAML-ish frontmatter block from the start of a markdown
 * document. Returns the parsed key/value pairs and the body without the
 * fenced block. If no closing fence is found, treats the document as
 * having no frontmatter and returns the original content unchanged.
 *
 * Intentionally minimal: handles `key: value` lines (including continuation
 * lines indented under a key), strips surrounding matching quotes, and
 * preserves arbitrary key names. Doesn't try to parse nested objects,
 * arrays-as-blocks, or anchors — those are vanishingly rare in the
 * skill/agent/prompt files this app actually receives, and the worst case
 * is a verbatim string in the rendered disclosure.
 */
export function parseFrontmatter(content: string): ParsedFrontmatter {
  const match = content.match(FRONTMATTER_RE);
  if (!match) return { fields: [], body: content };

  const yaml = match[1] ?? "";
  const body = content.slice(match[0].length);
  const fields: FrontmatterField[] = [];

  let currentKey: string | null = null;
  let currentParts: string[] = [];

  function flush() {
    if (currentKey === null) return;
    const value = stripQuotes(currentParts.join(" ").trim());
    fields.push({ key: currentKey, value });
    currentKey = null;
    currentParts = [];
  }

  for (const line of yaml.split(/\r?\n/)) {
    if (line.trim() === "") continue;

    if (/^\s/.test(line) && currentKey !== null) {
      currentParts.push(line.trim());
      continue;
    }

    const colon = line.indexOf(":");
    if (colon === -1) {
      if (currentKey !== null) currentParts.push(line.trim());
      continue;
    }

    flush();
    currentKey = line.slice(0, colon).trim();
    const after = line.slice(colon + 1).trim();
    if (after) currentParts.push(after);
  }
  flush();

  return { fields, body };
}

function stripQuotes(value: string): string {
  if (value.length < 2) return value;
  const first = value[0];
  const last = value[value.length - 1];
  if ((first === '"' || first === "'") && first === last) {
    return value.slice(1, -1);
  }
  return value;
}
