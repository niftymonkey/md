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
  // Preserves empty trailing line iff the string ends with a newline; for
  // preview purposes we only need indexable line text without their breaks.
  return content.split("\n");
}

function lineColumnFromOffset(
  offset: number,
  content: string,
): { line: number; column: number } {
  let line = 1;
  let lineStart = 0;
  for (let i = 0; i < offset; i++) {
    if (content.charCodeAt(i) === 10) {
      line++;
      lineStart = i + 1;
    }
  }
  return { line, column: offset - lineStart + 1 };
}

function endLineFromOffset(end: number, content: string): number {
  let line = 1;
  for (let i = 0; i < end; i++) {
    if (content.charCodeAt(i) === 10) {
      line++;
    }
  }
  return line;
}

function buildPreview(
  content: string,
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

export function findMatches(
  content: string,
  query: string,
  opts: FindOptions = {},
): Match[] {
  if (query.length === 0) return [];
  const context = opts.context ?? 0;
  const lines = splitLines(content);
  // splitLines on "a\n" gives ["a", ""] — drop the trailing empty entry so
  // line numbers don't exceed the visible line count.
  const lineCount =
    lines.length > 0 && lines[lines.length - 1] === ""
      ? lines.length - 1
      : lines.length;
  const visibleLines = lines.slice(0, lineCount);

  const matches: Match[] = [];
  let from = 0;
  while (from <= content.length - query.length) {
    const idx = content.indexOf(query, from);
    if (idx === -1) break;
    const end = idx + query.length;
    const { line, column } = lineColumnFromOffset(idx, content);
    const lastLine = endLineFromOffset(end, content);
    matches.push({
      start: idx,
      end,
      line,
      column,
      previewLines: buildPreview(content, line, lastLine, context, visibleLines),
    });
    // Non-overlapping advance: skip past the matched region.
    from = end;
  }
  return matches;
}
