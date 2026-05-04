"use client";

import { useEffect, useRef, useState } from "react";

type Hotkey = {
  label: string;
  keys: string[];
  macKeys?: string[];
  authedOnly?: boolean;
};

type Group = {
  label: string;
  items: Hotkey[];
};

const GROUPS: Group[] = [
  {
    label: "Global",
    items: [
      { label: "Command palette", keys: ["Ctrl", "K"], macKeys: ["⌘", "K"], authedOnly: true },
      { label: "Dashboard", keys: ["g", "d"], authedOnly: true },
      { label: "New document", keys: ["g", "n"], authedOnly: true },
      { label: "Hotkeys", keys: ["?"] },
    ],
  },
  {
    label: "Reader",
    items: [
      { label: "View raw", keys: ["r"] },
      { label: "Copy link", keys: ["c"] },
      { label: "Toggle outline", keys: ["o"] },
      { label: "Toggle width", keys: ["w"] },
      { label: "Edit", keys: ["e"], authedOnly: true },
    ],
  },
  {
    label: "Editor",
    items: [
      { label: "Save", keys: ["Ctrl", "S"], macKeys: ["⌘", "S"], authedOnly: true },
      { label: "Cancel", keys: ["Esc"], authedOnly: true },
    ],
  },
  {
    label: "Settings",
    items: [{ label: "Back", keys: ["Esc"], authedOnly: true }],
  },
];

export function HotkeyCheatSheet({ isAuthed }: { isAuthed: boolean }) {
  const [open, setOpen] = useState(false);
  const closeButtonRef = useRef<HTMLButtonElement>(null);

  function close() {
    setOpen(false);
  }

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.repeat) return;
      if (document.documentElement.dataset.cmdPaletteOpen === "true") return;

      const target = e.target as HTMLElement | null;
      const tag = target?.tagName;
      if (
        tag === "INPUT" ||
        tag === "TEXTAREA" ||
        target?.isContentEditable
      ) {
        return;
      }

      if (e.key === "Escape") {
        if (!open) return;
        e.preventDefault();
        close();
        return;
      }

      if (e.key === "?" || (e.key === "/" && e.shiftKey)) {
        if (window.matchMedia("(max-width: 767px)").matches) return;
        e.preventDefault();
        setOpen((v) => !v);
      }
    }

    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);

  useEffect(() => {
    if (!open) return;
    document.documentElement.setAttribute("data-hotkeys-open", "true");
    const focusHandle = window.setTimeout(() => closeButtonRef.current?.focus(), 0);
    return () => {
      document.documentElement.removeAttribute("data-hotkeys-open");
      window.clearTimeout(focusHandle);
    };
  }, [open]);

  if (!open) return null;

  return (
    <div
      className="hotkey-sheet-backdrop fixed inset-0 z-[70] flex items-start justify-center px-4 pt-[16vh]"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) close();
      }}
      role="presentation"
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Hotkeys"
        className="w-full max-w-[520px] overflow-hidden rounded-lg border border-border bg-paper shadow-[var(--shadow-soft)]"
      >
        <div className="flex items-center justify-between gap-3 border-b border-border px-4 py-3">
          <h2 className="text-sm font-semibold text-ink">Hotkeys</h2>
          <button
            ref={closeButtonRef}
            type="button"
            onClick={close}
            aria-label="Close hotkeys"
            className="grid size-8 place-items-center rounded-md border border-border bg-paper text-muted transition-[border-color,color] duration-150 hover:border-ochre hover:text-ochre"
          >
            <CloseIcon />
          </button>
        </div>
        <div className="grid gap-3 px-4 py-4 sm:grid-cols-2">
          {GROUPS.map((group) => {
            const items = group.items.filter((item) => isAuthed || !item.authedOnly);
            if (items.length === 0) return null;
            return (
              <section key={group.label} className="min-w-0">
                <h3 className="mb-1.5 text-[0.625rem] font-semibold uppercase tracking-[0.12em] text-muted">
                  {group.label}
                </h3>
                <div className="flex flex-col rounded-md border border-border bg-paper-warm/35">
                  {items.map((item) => (
                    <div
                      key={`${group.label}:${item.label}`}
                      className="flex min-h-9 items-center justify-between gap-3 border-b border-border px-2.5 py-1.5 last:border-b-0"
                    >
                      <span className="truncate text-sm text-ink">{item.label}</span>
                      <KbdSequence item={item} />
                    </div>
                  ))}
                </div>
              </section>
            );
          })}
        </div>
      </div>
    </div>
  );
}

function KbdSequence({ item }: { item: Hotkey }) {
  return (
    <>
      <span data-key-mac className="flex shrink-0 items-center gap-1">
        {(item.macKeys ?? item.keys).map((key) => (
          <kbd
            key={key}
            className="rounded-[3px] border border-border bg-paper px-[5px] py-[1px] font-mono text-[0.6875rem] font-medium text-muted"
          >
            {key}
          </kbd>
        ))}
      </span>
      <span data-key-other className="flex shrink-0 items-center gap-1">
        {item.keys.map((key) => (
          <kbd
            key={key}
            className="rounded-[3px] border border-border bg-paper px-[5px] py-[1px] font-mono text-[0.6875rem] font-medium text-muted"
          >
            {key}
          </kbd>
        ))}
      </span>
    </>
  );
}

function CloseIcon() {
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
      <path d="M18 6 6 18" />
      <path d="m6 6 12 12" />
    </svg>
  );
}
