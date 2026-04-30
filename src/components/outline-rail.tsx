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

    function pickActive() {
      const measured = targets.map((el) => ({
        el,
        top: el.getBoundingClientRect().top,
      }));
      const upcoming = measured
        .filter((m) => m.top >= 0)
        .sort((a, b) => a.top - b.top)[0];
      if (upcoming) {
        setActiveId(upcoming.el.id);
        return;
      }
      const lastPassed = measured
        .filter((m) => m.top < 0)
        .sort((a, b) => b.top - a.top)[0];
      if (lastPassed) setActiveId(lastPassed.el.id);
    }

    const observer = new IntersectionObserver(() => pickActive(), {
      rootMargin: "0px 0px -70% 0px",
      threshold: 0,
    });
    targets.forEach((el) => observer.observe(el));
    pickActive();
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
