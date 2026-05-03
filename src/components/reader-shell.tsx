"use client";

import { useEffect, useState, useTransition, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { OutlineRail } from "./outline-rail";
import { ReaderToolbar } from "./reader-toolbar";
import { saveReadingPrefs } from "@/app/settings/actions";
import type { Heading } from "@/lib/heading-utils";
import type { Width } from "@/lib/user-preferences";

const WIDTH_KEY = "md.width";
const OUTLINE_KEY = "md.outline.shown";

export function ReaderShell({
  slug,
  rawHref,
  hasOutline,
  headings,
  isAuthed,
  initialWidth,
  initialOutlineShown,
  children,
}: {
  slug: string;
  rawHref: string;
  hasOutline: boolean;
  headings: Heading[];
  isAuthed: boolean;
  initialWidth: Width;
  initialOutlineShown: boolean;
  children: ReactNode;
}) {
  const [width, setWidth] = useState<Width>(initialWidth);
  const [outlineShown, setOutlineShown] = useState(initialOutlineShown);
  const router = useRouter();
  const dashboardHref = isAuthed ? "/" : undefined;
  const [, startTransition] = useTransition();

  // One-shot sync from localStorage (the unauth source of truth) after
  // hydration, since the server can't read it. Visual is already correct via
  // CSS keyed on :root[data-width] / :root[data-outline-hidden] — this just
  // keeps React state honest for the keyboard handlers below.
  useEffect(() => {
    if (isAuthed) return;
    const stored = localStorage.getItem(WIDTH_KEY) as Width | null;
    if (stored === "reading" || stored === "wide") {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setWidth(stored);
    }
    if (hasOutline) {
      const o = localStorage.getItem(OUTLINE_KEY);
      if (o !== null) setOutlineShown(o === "true");
    }
  }, [isAuthed, hasOutline]);

  function pickWidth(next: Width) {
    setWidth(next);
    if (next === "wide") document.documentElement.setAttribute("data-width", "wide");
    else document.documentElement.removeAttribute("data-width");
    if (isAuthed) {
      startTransition(async () => {
        await saveReadingPrefs({ defaultWidth: next });
      });
    } else {
      localStorage.setItem(WIDTH_KEY, next);
    }
  }

  function toggleOutline() {
    if (!hasOutline) return;
    const next = !outlineShown;
    setOutlineShown(next);
    if (next) document.documentElement.removeAttribute("data-outline-hidden");
    else document.documentElement.setAttribute("data-outline-hidden", "1");
    if (isAuthed) {
      startTransition(async () => {
        await saveReadingPrefs({ autoShowOutline: next });
      });
    } else {
      localStorage.setItem(OUTLINE_KEY, String(next));
    }
  }

  useEffect(() => {
    document.documentElement.setAttribute("data-scrolling", "1");
    let timer = window.setTimeout(() => {
      document.documentElement.removeAttribute("data-scrolling");
    }, 1500);
    function onScroll() {
      document.documentElement.setAttribute("data-scrolling", "1");
      window.clearTimeout(timer);
      timer = window.setTimeout(() => {
        document.documentElement.removeAttribute("data-scrolling");
      }, 1500);
    }
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => {
      window.removeEventListener("scroll", onScroll);
      window.clearTimeout(timer);
      document.documentElement.removeAttribute("data-scrolling");
    };
  }, []);

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      if (document.documentElement.dataset.cmdPaletteOpen === "true") return;
      const target = e.target as HTMLElement | null;
      const tag = target?.tagName;
      if (tag === "INPUT" || tag === "TEXTAREA" || target?.isContentEditable) return;
      switch (e.key) {
        case "r":
          window.location.assign(rawHref);
          break;
        case "c":
          void navigator.clipboard.writeText(window.location.href);
          break;
        case "w":
          pickWidth(width === "reading" ? "wide" : "reading");
          break;
        case "o":
          toggleOutline();
          break;
        case "e":
          if (isAuthed) router.push(`/edit/${slug}`);
          break;
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rawHref, width, hasOutline, isAuthed, slug]);

  return (
    <main className="reader-main mx-auto flex w-full justify-center gap-6 px-6 py-10">
      <div className="reader-article relative w-full min-w-0 max-w-[var(--md-article-max)]">
        <article className="prose max-w-none prose-pre:bg-transparent prose-pre:p-0">
          {children}
        </article>
      </div>
      {hasOutline && (
        <aside
          data-outline-aside
          className="hidden min-[1100px]:sticky min-[1100px]:top-12 min-[1100px]:block min-[1100px]:max-w-60 min-[1100px]:shrink-0 min-[1100px]:self-start"
        >
          <div className="pb-3 pt-1.5">
            <span className="text-[0.6875rem] font-semibold uppercase tracking-[0.12em] text-muted">
              On this page
            </span>
          </div>
          <div
            data-outline-scroll
            className="max-h-[calc(100vh-8rem)] overflow-y-auto pr-1"
          >
            <OutlineRail headings={headings} />
          </div>
        </aside>
      )}
      <div
        data-reader-toolbar-cluster
        className="hidden flex-col items-center gap-1.5 sm:sticky sm:top-14 sm:flex sm:shrink-0 sm:self-start"
      >
        {hasOutline && (
          <button
            type="button"
            data-outline-toggle
            onClick={toggleOutline}
            aria-label={outlineShown ? "Hide outline" : "Show outline"}
            title={outlineShown ? "Hide outline" : "Show outline"}
            aria-pressed={outlineShown}
            className="reader-outline-toggle grid size-8 cursor-pointer place-items-center rounded-md border border-border bg-paper text-muted transition-[background-color,border-color,color] duration-200 hover:border-ochre hover:text-ochre"
          >
            <OutlineIcon />
          </button>
        )}
        <ReaderToolbar
          width={width}
          onWidthChange={pickWidth}
          rawHref={rawHref}
          dashboardHref={dashboardHref}
        />
      </div>
    </main>
  );
}

function OutlineIcon() {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className="size-4"
      aria-hidden="true"
    >
      <line x1="4" y1="6" x2="20" y2="6" />
      <line x1="8" y1="12" x2="20" y2="12" />
      <line x1="12" y1="18" x2="20" y2="18" />
    </svg>
  );
}
