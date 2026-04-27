const H1_REGEX = /^#\s+(.+?)\s*$/m;

export function resolveTitle(content: string, explicit?: string | null): string {
  const trimmedExplicit = explicit?.trim();
  if (trimmedExplicit) return trimmedExplicit;

  const match = content.match(H1_REGEX);
  if (match?.[1]) return match[1].trim();

  return "Untitled";
}
