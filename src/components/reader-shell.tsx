"use client";

import { useEffect, useState, type ReactNode } from "react";
import { Watermark } from "./watermark";
import { OutlineRail } from "./outline-rail";
import type { Heading } from "@/lib/heading-utils";

type Width = "reading" | "wide";

const WIDTH_KEY = "md.width";
const OUTLINE_KEY = "md.outline.shown";

export function ReaderShell({
  rawHref,
  hasOutline,
  headings,
  dashboardHref,
  signOutAction,
  children,
}: {
  rawHref: string;
  hasOutline: boolean;
  headings: Heading[];
  dashboardHref?: string;
  signOutAction?: () => Promise<void>;
  children: ReactNode;
}) {
  const [width, setWidth] = useState<Width>("reading");
  const [outlineShown, setOutlineShown] = useState(hasOutline);

  useEffect(() => {
    const w = localStorage.getItem(WIDTH_KEY) as Width | null;
    if (w === "reading" || w === "wide") setWidth(w);
    if (hasOutline) {
      const o = localStorage.getItem(OUTLINE_KEY);
      if (o !== null) setOutlineShown(o === "true");
    } else {
      setOutlineShown(false);
    }
  }, [hasOutline]);

  function pickWidth(next: Width) {
    setWidth(next);
    localStorage.setItem(WIDTH_KEY, next);
    if (next === "wide") document.documentElement.setAttribute("data-width", "wide");
    else document.documentElement.removeAttribute("data-width");
  }

  function toggleOutline() {
    if (!hasOutline) return;
    setOutlineShown((prev) => {
      const next = !prev;
      localStorage.setItem(OUTLINE_KEY, String(next));
      if (next) document.documentElement.removeAttribute("data-outline-hidden");
      else document.documentElement.setAttribute("data-outline-hidden", "1");
      return next;
    });
  }

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.metaKey || e.ctrlKey || e.altKey) return;
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
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rawHref, width, hasOutline]);

  return (
    <main className="relative mx-auto w-full px-6 py-10 min-[1100px]:flex min-[1100px]:justify-center min-[1100px]:gap-10">
      <div className="relative mx-auto w-full max-w-[var(--md-article-max)] min-[1100px]:mx-0">
        {hasOutline ? (
          <div
            data-outline-toggle-cluster
            className="absolute -right-2 top-0 flex items-center gap-2 sm:-right-12"
          >
            <ToolbarIconButton
              onClick={toggleOutline}
              label="Show outline"
              pressed={false}
            >
              <OutlineIcon />
            </ToolbarIconButton>
            <Watermark
              variant="reader"
              rawHref={rawHref}
              width={width}
              onWidthChange={pickWidth}
              dashboardHref={dashboardHref}
              signOutAction={signOutAction}
            />
          </div>
        ) : (
          <div className="absolute -right-2 top-0 sm:-right-12">
            <Watermark
              variant="reader"
              rawHref={rawHref}
              width={width}
              onWidthChange={pickWidth}
              dashboardHref={dashboardHref}
              signOutAction={signOutAction}
            />
          </div>
        )}
        <article className="prose max-w-none prose-pre:bg-transparent prose-pre:p-0">
          {children}
        </article>
      </div>
      {hasOutline && (
        <aside
          data-outline-aside
          className="hidden min-[1100px]:block min-[1100px]:w-60 min-[1100px]:shrink-0 min-[1100px]:sticky min-[1100px]:top-10 min-[1100px]:self-start"
        >
          <div className="flex items-center justify-between gap-2 pb-3 pt-1">
            <span className="text-[0.6875rem] font-semibold uppercase tracking-[0.12em] text-muted">
              On this page
            </span>
            <div className="flex items-center gap-2">
              <ToolbarIconButton
                onClick={toggleOutline}
                label="Hide outline"
                pressed={true}
              >
                <OutlineIcon />
              </ToolbarIconButton>
              <Watermark
                variant="reader"
                rawHref={rawHref}
                width={width}
                onWidthChange={pickWidth}
                dashboardHref={dashboardHref}
                signOutAction={signOutAction}
              />
            </div>
          </div>
          <div className="max-h-[calc(100vh-8rem)] overflow-y-auto pr-1">
            <OutlineRail headings={headings} />
          </div>
        </aside>
      )}
    </main>
  );
}

function ToolbarIconButton({
  onClick,
  label,
  pressed,
  children,
}: {
  onClick: () => void;
  label: string;
  pressed?: boolean;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={label}
      title={label}
      aria-pressed={pressed}
      className={
        pressed
          ? "grid size-8 cursor-pointer place-items-center rounded-md border border-ochre bg-ochre text-paper transition-[border-color] duration-200"
          : "grid size-8 cursor-pointer place-items-center rounded-md border border-border bg-paper text-muted transition-[border-color,color] duration-200 hover:border-ochre hover:text-ochre"
      }
    >
      {children}
    </button>
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
