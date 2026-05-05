import type { RevisionSource } from "./revision-log";

const SOURCE_LABELS: Record<RevisionSource, string> = {
  manual: "Edit",
  cli: "API",
  agent: "Agent",
  restore: "Restored",
};

export function formatSource(source: RevisionSource): string {
  return SOURCE_LABELS[source];
}

export function shouldShowSourceLabel(source: RevisionSource): boolean {
  return source !== "restore";
}
