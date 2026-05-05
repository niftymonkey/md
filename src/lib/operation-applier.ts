import { findMatches, type PreviewLine } from "./match-resolver";
import type {
  EditOp,
  InsertAfterLineOp,
  InsertBeforeLineOp,
  DeleteLineRangeOp,
  ReplaceLineRangeOp,
} from "./edit-op-schema";

export type ApplierError =
  | { kind: "no_match"; query: string }
  | {
      kind: "ambiguous_match";
      query: string;
      matchCount: number;
      previewLines: PreviewLine[];
    }
  | { kind: "line_out_of_range"; line: number; documentLines: number }
  | {
      kind: "range_out_of_range";
      from: number;
      to: number;
      documentLines: number;
    }
  | { kind: "overlapping_line_ops"; conflictsWith: number };

export type ApplyResult =
  | { ok: true; content: string }
  | { ok: false; failedAt: number; error: ApplierError };

type LineAddressedOp =
  | InsertAfterLineOp
  | InsertBeforeLineOp
  | DeleteLineRangeOp
  | ReplaceLineRangeOp;

type ResolvedRange = {
  start: number;
  end: number;
  replacement: string;
};

function isLineOp(op: EditOp): op is LineAddressedOp {
  return op.type !== "replace";
}

function visibleLineCount(content: string): number {
  if (content.length === 0) return 0;
  let count = 1;
  for (let i = 0; i < content.length; i++) {
    if (content.charCodeAt(i) === 10) {
      // Trailing newline doesn't introduce an additional visible line.
      if (i === content.length - 1) break;
      count++;
    }
  }
  return count;
}

function lineStartOffset(content: string, line: number): number {
  if (line <= 1) return 0;
  let currentLine = 1;
  for (let i = 0; i < content.length; i++) {
    if (content.charCodeAt(i) === 10) {
      currentLine++;
      if (currentLine === line) return i + 1;
    }
  }
  // Caller guards against out-of-range; reaching here means line === lineCount+1
  // (one past the end), which we represent as the end of the content.
  return content.length;
}

function resolveLineOp(
  op: LineAddressedOp,
  snapshot: string,
  visibleCount: number,
): { ok: true; range: ResolvedRange } | { ok: false; error: ApplierError } {
  switch (op.type) {
    case "insertAfterLine": {
      if (op.line < 0 || op.line > visibleCount) {
        return {
          ok: false,
          error: {
            kind: "line_out_of_range",
            line: op.line,
            documentLines: visibleCount,
          },
        };
      }
      const insertAt =
        op.line === visibleCount
          ? snapshot.length
          : lineStartOffset(snapshot, op.line + 1);
      // Tail-of-file insertion needs a leading newline if the snapshot doesn't
      // end with one — otherwise the inserted line would fuse with the prior.
      const needsLeading =
        op.line === visibleCount &&
        snapshot.length > 0 &&
        snapshot.charCodeAt(snapshot.length - 1) !== 10;
      const replacement = (needsLeading ? "\n" : "") + op.content + "\n";
      return { ok: true, range: { start: insertAt, end: insertAt, replacement } };
    }
    case "insertBeforeLine": {
      if (op.line < 1 || op.line > visibleCount) {
        return {
          ok: false,
          error: {
            kind: "line_out_of_range",
            line: op.line,
            documentLines: visibleCount,
          },
        };
      }
      const insertAt = lineStartOffset(snapshot, op.line);
      return {
        ok: true,
        range: { start: insertAt, end: insertAt, replacement: op.content + "\n" },
      };
    }
    case "deleteLineRange":
    case "replaceLineRange": {
      if (op.from < 1 || op.to > visibleCount) {
        return {
          ok: false,
          error: {
            kind: "range_out_of_range",
            from: op.from,
            to: op.to,
            documentLines: visibleCount,
          },
        };
      }
      const start = lineStartOffset(snapshot, op.from);
      const end =
        op.to === visibleCount
          ? snapshot.length
          : lineStartOffset(snapshot, op.to + 1);
      let replacement: string;
      if (op.type === "deleteLineRange") {
        replacement = "";
      } else {
        // Empty content collapses to deletion (no empty line left behind).
        replacement = op.content === "" ? "" : op.content + "\n";
      }
      return { ok: true, range: { start, end, replacement } };
    }
  }
}

export function apply(snapshot: string, ops: EditOp[]): ApplyResult {
  if (ops.length === 0) return { ok: true, content: snapshot };

  const visibleCount = visibleLineCount(snapshot);

  type Resolved = { opIndex: number; range: ResolvedRange };
  const resolvedLineOps: Resolved[] = [];
  for (let i = 0; i < ops.length; i++) {
    const op = ops[i]!;
    if (!isLineOp(op)) continue;
    const r = resolveLineOp(op, snapshot, visibleCount);
    if (!r.ok) return { ok: false, failedAt: i, error: r.error };
    resolvedLineOps.push({ opIndex: i, range: r.range });
  }

  for (let i = 0; i < resolvedLineOps.length; i++) {
    for (let j = i + 1; j < resolvedLineOps.length; j++) {
      const a = resolvedLineOps[i]!.range;
      const b = resolvedLineOps[j]!.range;
      if (a.start < b.end && b.start < a.end) {
        return {
          ok: false,
          failedAt: resolvedLineOps[j]!.opIndex,
          error: {
            kind: "overlapping_line_ops",
            conflictsWith: resolvedLineOps[i]!.opIndex,
          },
        };
      }
    }
  }

  // Apply line ops right-to-left so left-side offsets remain stable.
  // Tie-break: later input index applied first => earlier input ends up first
  // in the output for ops sharing an insertion offset.
  const sorted = [...resolvedLineOps].sort((a, b) => {
    if (b.range.start !== a.range.start) return b.range.start - a.range.start;
    return b.opIndex - a.opIndex;
  });
  let running = snapshot;
  for (const { range } of sorted) {
    running =
      running.slice(0, range.start) + range.replacement + running.slice(range.end);
  }

  for (let i = 0; i < ops.length; i++) {
    const op = ops[i]!;
    if (op.type !== "replace") continue;
    if (op.replaceAll) {
      const matches = findMatches(running, op.find);
      if (matches.length === 0) {
        return {
          ok: false,
          failedAt: i,
          error: { kind: "no_match", query: op.find },
        };
      }
      for (let m = matches.length - 1; m >= 0; m--) {
        const match = matches[m]!;
        running =
          running.slice(0, match.start) + op.replace + running.slice(match.end);
      }
    } else {
      const matches = findMatches(running, op.find, { context: 1 });
      if (matches.length === 0) {
        return {
          ok: false,
          failedAt: i,
          error: { kind: "no_match", query: op.find },
        };
      }
      if (matches.length > 1) {
        return {
          ok: false,
          failedAt: i,
          error: {
            kind: "ambiguous_match",
            query: op.find,
            matchCount: matches.length,
            previewLines: matches.flatMap((m) => m.previewLines),
          },
        };
      }
      const match = matches[0]!;
      running =
        running.slice(0, match.start) + op.replace + running.slice(match.end);
    }
  }

  return { ok: true, content: running };
}
