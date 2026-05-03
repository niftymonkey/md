"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import { openCmdPalette } from "./cmd-palette";

const HIDE_THRESHOLD = 8;
const REVEAL_THRESHOLD = 4;
const FLOOR = 64;

type Props = {
  palette?: boolean;
  children?: ReactNode;
};

export function MobileBar({ palette = false, children }: Props) {
  const [hidden, setHidden] = useState(false);
  const lastY = useRef(0);

  useEffect(() => {
    document.documentElement.setAttribute("data-mobile-bar", "1");
    return () => {
      document.documentElement.removeAttribute("data-mobile-bar");
    };
  }, []);

  useEffect(() => {
    lastY.current = window.scrollY;
    function onScroll() {
      const y = window.scrollY;
      const dy = y - lastY.current;
      lastY.current = y;
      if (y < FLOOR) {
        setHidden(false);
        return;
      }
      if (dy > HIDE_THRESHOLD) setHidden(true);
      else if (dy < -REVEAL_THRESHOLD) setHidden(false);
    }
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  const hasContextual = !!children;

  return (
    <nav
      data-mobile-bar-nav
      data-hidden={hidden ? "true" : undefined}
      aria-label="Page actions"
      className="mobile-bar fixed inset-x-0 bottom-0 z-40 flex items-center gap-1.5 border-t border-border bg-paper/95 px-3 pt-2 backdrop-blur-sm md:hidden"
    >
      {palette && <PaletteGlyph />}
      {palette && hasContextual && (
        <span aria-hidden="true" className="mx-0.5 h-6 w-px bg-border" />
      )}
      {hasContextual && (
        <div className="ml-auto flex items-center gap-1.5">{children}</div>
      )}
    </nav>
  );
}

function PaletteGlyph() {
  return (
    <button
      type="button"
      onClick={() => openCmdPalette()}
      aria-label="Open command palette"
      className="grid size-11 cursor-pointer place-items-center rounded-md border border-border bg-paper text-muted transition-[border-color,color] duration-150 hover:border-ochre hover:text-ochre"
    >
      <SearchIcon />
    </button>
  );
}

function SearchIcon() {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className="size-[18px]"
      aria-hidden="true"
    >
      <circle cx="11" cy="11" r="7" />
      <line x1="21" y1="21" x2="16.65" y2="16.65" />
    </svg>
  );
}
