export type ReplaceOp = {
  type: "replace";
  find: string;
  replace: string;
  replaceAll: boolean;
};

export type InsertAfterLineOp = {
  type: "insertAfterLine";
  /** 1-indexed. `0` is allowed as a sentinel meaning "insert at top of file". */
  line: number;
  content: string;
};

export type InsertBeforeLineOp = {
  type: "insertBeforeLine";
  /** 1-indexed. Must be >= 1. */
  line: number;
  content: string;
};

export type DeleteLineRangeOp = {
  type: "deleteLineRange";
  /** 1-indexed inclusive. */
  from: number;
  to: number;
};

export type ReplaceLineRangeOp = {
  type: "replaceLineRange";
  /** 1-indexed inclusive. */
  from: number;
  to: number;
  content: string;
};

export type EditOp =
  | ReplaceOp
  | InsertAfterLineOp
  | InsertBeforeLineOp
  | DeleteLineRangeOp
  | ReplaceLineRangeOp;

export type ParseResult<T> =
  | { ok: true; op: T }
  | { ok: false; error: string };

export type ParseBatchResult =
  | { ok: true; ops: EditOp[] }
  | { ok: false; error: string };

const KNOWN_TYPES = new Set([
  "replace",
  "insertAfterLine",
  "insertBeforeLine",
  "deleteLineRange",
  "replaceLineRange",
]);

function isPlainObject(v: unknown): v is Record<string, unknown> {
  return typeof v === "object" && v !== null && !Array.isArray(v);
}

function isPositiveInteger(v: unknown): v is number {
  return typeof v === "number" && Number.isInteger(v) && v >= 1;
}

function isNonNegativeInteger(v: unknown): v is number {
  return typeof v === "number" && Number.isInteger(v) && v >= 0;
}

function parseReplace(input: Record<string, unknown>): ParseResult<ReplaceOp> {
  if (typeof input.find !== "string") {
    return { ok: false, error: "replace: find must be a string" };
  }
  if (input.find.length === 0) {
    return { ok: false, error: "replace: find must be non-empty" };
  }
  if (typeof input.replace !== "string") {
    return { ok: false, error: "replace: replace must be a string" };
  }
  let replaceAll = false;
  if (input.replaceAll !== undefined) {
    if (typeof input.replaceAll !== "boolean") {
      return { ok: false, error: "replace: replaceAll must be a boolean" };
    }
    replaceAll = input.replaceAll;
  }
  return {
    ok: true,
    op: { type: "replace", find: input.find, replace: input.replace, replaceAll },
  };
}

function parseInsert(
  input: Record<string, unknown>,
  type: "insertAfterLine" | "insertBeforeLine",
): ParseResult<InsertAfterLineOp | InsertBeforeLineOp> {
  const lineMin = type === "insertAfterLine" ? 0 : 1;
  const lineCheck =
    lineMin === 0 ? isNonNegativeInteger : isPositiveInteger;
  if (!lineCheck(input.line)) {
    return {
      ok: false,
      error: `${type}: line must be an integer >= ${lineMin}`,
    };
  }
  if (typeof input.content !== "string") {
    return { ok: false, error: `${type}: content must be a string` };
  }
  return {
    ok: true,
    op: { type, line: input.line, content: input.content },
  };
}

function parseDeleteRange(
  input: Record<string, unknown>,
): ParseResult<DeleteLineRangeOp> {
  if (!isPositiveInteger(input.from)) {
    return { ok: false, error: "deleteLineRange: from must be an integer >= 1" };
  }
  if (!isPositiveInteger(input.to)) {
    return { ok: false, error: "deleteLineRange: to must be an integer >= 1" };
  }
  if (input.from > input.to) {
    return {
      ok: false,
      error: "deleteLineRange: from must be <= to (invalid range)",
    };
  }
  return {
    ok: true,
    op: { type: "deleteLineRange", from: input.from, to: input.to },
  };
}

function parseReplaceRange(
  input: Record<string, unknown>,
): ParseResult<ReplaceLineRangeOp> {
  if (!isPositiveInteger(input.from)) {
    return { ok: false, error: "replaceLineRange: from must be an integer >= 1" };
  }
  if (!isPositiveInteger(input.to)) {
    return { ok: false, error: "replaceLineRange: to must be an integer >= 1" };
  }
  if (input.from > input.to) {
    return {
      ok: false,
      error: "replaceLineRange: from must be <= to (invalid range)",
    };
  }
  if (typeof input.content !== "string") {
    return { ok: false, error: "replaceLineRange: content must be a string" };
  }
  return {
    ok: true,
    op: {
      type: "replaceLineRange",
      from: input.from,
      to: input.to,
      content: input.content,
    },
  };
}

export function parseEditOp(input: unknown): ParseResult<EditOp> {
  if (!isPlainObject(input)) {
    return { ok: false, error: "op must be a plain object" };
  }
  const type = input.type;
  if (typeof type !== "string") {
    return { ok: false, error: "op.type is required and must be a string" };
  }
  if (!KNOWN_TYPES.has(type)) {
    return { ok: false, error: `unknown op type: ${type}` };
  }

  switch (type) {
    case "replace":
      return parseReplace(input);
    case "insertAfterLine":
    case "insertBeforeLine":
      return parseInsert(input, type);
    case "deleteLineRange":
      return parseDeleteRange(input);
    case "replaceLineRange":
      return parseReplaceRange(input);
    default:
      return { ok: false, error: `unknown op type: ${type}` };
  }
}

export function parseEditOps(input: unknown): ParseBatchResult {
  if (!Array.isArray(input)) {
    return { ok: false, error: "ops must be an array" };
  }
  if (input.length === 0) {
    return { ok: false, error: "ops must contain at least one operation" };
  }
  const ops: EditOp[] = [];
  for (let i = 0; i < input.length; i++) {
    const result = parseEditOp(input[i]);
    if (!result.ok) {
      return { ok: false, error: `ops[${i}]: ${result.error}` };
    }
    ops.push(result.op);
  }
  return { ok: true, ops };
}
