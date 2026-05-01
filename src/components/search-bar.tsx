"use client";

import { openCmdPalette } from "./cmd-palette";

function macKey(k: string): string {
  if (k === "mod") return "⌘";
  if (k.length === 1) return k.toUpperCase();
  return k;
}

function otherKey(k: string): string {
  if (k === "mod") return "Ctrl";
  if (k.length === 1) return k.toUpperCase();
  return k;
}

const KBD_KEYS = ["mod", "K"] as const;

export function SearchBar() {
  return (
    <button
      type="button"
      onClick={openCmdPalette}
      aria-label="Open command palette"
      className="flex h-11 flex-1 items-center gap-2.5 rounded-lg border border-border bg-paper-warm px-3.5 text-left text-sm text-muted transition-[border-color] duration-200 hover:border-ochre"
    >
      <span className="grid size-4 place-items-center text-muted">
        <SearchIcon />
      </span>
      <span className="flex-1 truncate">Search docs, settings, actions…</span>
      <span data-key-mac className="flex items-center gap-1">
        {KBD_KEYS.map((k, i) => (
          <kbd
            key={i}
            className="rounded-[3px] border border-border px-[5px] py-[1px] font-mono text-[0.6875rem] font-medium text-muted"
          >
            {macKey(k)}
          </kbd>
        ))}
      </span>
      <span data-key-other className="flex items-center gap-1">
        {KBD_KEYS.map((k, i) => (
          <kbd
            key={i}
            className="rounded-[3px] border border-border px-[5px] py-[1px] font-mono text-[0.6875rem] font-medium text-muted"
          >
            {otherKey(k)}
          </kbd>
        ))}
      </span>
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
      className="size-4"
      aria-hidden="true"
    >
      <circle cx="11" cy="11" r="7" />
      <line x1="21" y1="21" x2="16.65" y2="16.65" />
    </svg>
  );
}
