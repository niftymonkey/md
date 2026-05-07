"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useTransition } from "react";
import { TagBadge } from "@/components/tag-badge";

type Props = {
  tags: { tag: string; count: number }[];
  active: string[];
};

/**
 * Multi-select pill row above the recent rail. Clicking a pill toggles its
 * presence in the URL `?tags=` filter (comma-separated, AND semantics enforced
 * server-side). "Clear" appears once at least one tag is active.
 */
export function TagFilter({ tags, active }: Props) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [isPending, startTransition] = useTransition();

  if (tags.length === 0) return null;

  function toggle(tag: string) {
    const next = active.includes(tag)
      ? active.filter((t) => t !== tag)
      : [...active, tag];
    const params = new URLSearchParams(searchParams.toString());
    if (next.length === 0) params.delete("tags");
    else params.set("tags", next.join(","));
    const qs = params.toString();
    startTransition(() => {
      router.push(qs ? `/?${qs}` : "/", { scroll: false });
    });
  }

  function clear() {
    const params = new URLSearchParams(searchParams.toString());
    params.delete("tags");
    const qs = params.toString();
    startTransition(() => {
      router.push(qs ? `/?${qs}` : "/", { scroll: false });
    });
  }

  return (
    <nav
      aria-label="Filter by tag"
      className="mb-4 flex flex-wrap items-center gap-1.5"
      data-pending={isPending ? "true" : undefined}
    >
      {tags.map(({ tag, count }) => (
        <TagBadge
          key={tag}
          name={`${tag} · ${count}`}
          size="md"
          active={active.includes(tag)}
          onClick={() => toggle(tag)}
        />
      ))}
      {active.length > 0 && (
        <button
          type="button"
          onClick={clear}
          className="ml-1 cursor-pointer text-xs font-medium uppercase tracking-[0.1em] text-muted transition-colors hover:text-ochre-deep"
        >
          Clear
        </button>
      )}
    </nav>
  );
}
