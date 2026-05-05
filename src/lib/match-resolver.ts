export type PreviewLine = {
  /** 1-indexed line number in the source content. */
  line: number;
  /** The line text without its trailing newline. */
  text: string;
};

export type Match = {
  /** UTF-16 code-unit offset in `content` where the match begins. */
  start: number;
  /** Exclusive end offset. */
  end: number;
  /** 1-indexed line of the match start. */
  line: number;
  /** 1-indexed column of the match start. */
  column: number;
  /** Snippet around the match — match line plus optional context lines. */
  previewLines: PreviewLine[];
};

export type FindOptions = {
  /** Number of context lines to include before and after the match. Default 0. */
  context?: number;
};

function splitLines(content: string): string[] {
  return content.split("\n");
}

function buildPreview(
  startLine: number,
  endLine: number,
  context: number,
  allLines: string[],
): PreviewLine[] {
  const first = Math.max(1, startLine - context);
  const last = Math.min(allLines.length, endLine + context);
  const out: PreviewLine[] = [];
  for (let i = first; i <= last; i++) {
    out.push({ line: i, text: allLines[i - 1] ?? "" });
  }
  return out;
}

/**
 * Linear scan: track current line and line-start column while advancing
 * through `indexOf` matches in document order. Each match advances the
 * cursor only as far as the match's end offset, so total work is O(n)
 * in `content.length` regardless of match count.
 */
export function findMatches(
  content: string,
  query: string,
  opts: FindOptions = {},
): Match[] {
  if (query.length === 0) return [];
  const context = opts.context ?? 0;
  const lines = splitLines(content);
  const lineCount =
    lines.length > 0 && lines[lines.length - 1] === ""
      ? lines.length - 1
      : lines.length;
  const visibleLines = lines.slice(0, lineCount);

  const matches: Match[] = [];
  let from = 0;
  let cursor = 0;
  let line = 1;
  let lineStart = 0;

  while (from <= content.length - query.length) {
    const idx = content.indexOf(query, from);
    if (idx === -1) break;

    while (cursor < idx) {
      if (content.charCodeAt(cursor) === 10) {
        line++;
        lineStart = cursor + 1;
      }
      cursor++;
    }
    const startLine = line;
    const column = idx - lineStart + 1;

    const end = idx + query.length;
    while (cursor < end) {
      if (content.charCodeAt(cursor) === 10) {
        line++;
        lineStart = cursor + 1;
      }
      cursor++;
    }
    const lastLine = line;

    matches.push({
      start: idx,
      end,
      line: startLine,
      column,
      previewLines: buildPreview(startLine, lastLine, context, visibleLines),
    });

    from = end;
  }
  return matches;
}
