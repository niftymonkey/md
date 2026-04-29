"use client";

import { useEffect, useState } from "react";
import type { Heading } from "@/lib/heading-utils";

export function OutlineRail({ headings }: { headings: Heading[] }) {
  const [activeId, setActiveId] = useState<string | null>(
    headings[0]?.id ?? null,
  );

  useEffect(() => {
    if (headings.length === 0) return;
    const targets = headings
      .map((h) => document.getElementById(h.id))
      .filter((el): el is HTMLElement => el !== null);
    if (targets.length === 0) return;

    const observer = new IntersectionObserver(
      (entries) => {
        const visible = entries
          .filter((e) => e.isIntersecting)
          .map((e) => e.target as HTMLElement)
          .sort(
            (a, b) =>
              a.getBoundingClientRect().top - b.getBoundingClientRect().top,
          );
        if (visible.length > 0) setActiveId(visible[0].id);
      },
      { rootMargin: "0px 0px -70% 0px", threshold: 0 },
    );
    targets.forEach((el) => observer.observe(el));
    return () => observer.disconnect();
  }, [headings]);

  if (headings.length === 0) return null;

  return (
    <ul className="flex flex-col gap-0.5 text-sm">
      {headings.map((h) => {
        const isActive = activeId === h.id;
        return (
          <li
            key={h.id}
            style={{ paddingLeft: h.level === 3 ? "14px" : "0" }}
          >
            <a
              href={`#${h.id}`}
              className={
                isActive
                  ? "block truncate rounded-md px-2 py-1 font-semibold text-ochre"
                  : "block truncate rounded-md px-2 py-1 text-muted hover:text-ink"
              }
            >
              {h.text}
            </a>
          </li>
        );
      })}
    </ul>
  );
}
