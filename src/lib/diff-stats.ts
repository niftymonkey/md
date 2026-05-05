import { diffChars } from "diff";

export type DiffStats = {
  bytesAdded: number;
  bytesRemoved: number;
};

export function computeDiff(prev: string, next: string): DiffStats {
  if (prev === next) {
    return { bytesAdded: 0, bytesRemoved: 0 };
  }

  const changes = diffChars(prev, next);
  let bytesAdded = 0;
  let bytesRemoved = 0;
  for (const change of changes) {
    if (change.added) {
      bytesAdded += Buffer.byteLength(change.value, "utf8");
    } else if (change.removed) {
      bytesRemoved += Buffer.byteLength(change.value, "utf8");
    }
  }
  return { bytesAdded, bytesRemoved };
}
