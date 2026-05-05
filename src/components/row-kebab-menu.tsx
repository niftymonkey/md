"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";

export function RowKebabMenu({ slug, title }: { slug: string; title: string }) {
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [isPending, startTransition] = useTransition();
  const ref = useRef<HTMLDivElement>(null);
  const router = useRouter();

  useEffect(() => {
    if (!open) return;
    function onDown(e: MouseEvent | TouchEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }
    document.addEventListener("mousedown", onDown);
    document.addEventListener("touchstart", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("touchstart", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  async function onDelete() {
    if (busy) return;
    setOpen(false);
    if (!window.confirm(`Delete "${title}"? This cannot be undone.`)) return;
    setBusy(true);
    try {
      let response: Response;
      try {
        response = await fetch(`/api/docs/${slug}`, { method: "DELETE" });
      } catch {
        window.alert("Network error");
        return;
      }
      if (!response.ok) {
        let message = `Delete failed (${response.status})`;
        try {
          const data = await response.json();
          if (data?.error) message = data.error;
        } catch {
          // ignore parse failure
        }
        window.alert(message);
        return;
      }
      startTransition(() => {
        router.refresh();
      });
    } finally {
      setBusy(false);
    }
  }

  return (
    <div ref={ref} className="relative md:hidden">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-label={`Actions for ${title}`}
        aria-expanded={open}
        aria-haspopup="menu"
        className="grid h-9 w-6 cursor-pointer place-items-center rounded-md text-muted transition-colors hover:bg-paper hover:text-ochre"
      >
        <KebabIcon />
      </button>
      {open && (
        <div
          role="menu"
          aria-label={`Actions for ${title}`}
          className="absolute right-0 top-full z-30 mt-1 min-w-40 overflow-hidden rounded-md border border-border bg-paper shadow-[var(--shadow-soft)]"
        >
          <Link
            href={`/edit/${slug}`}
            role="menuitem"
            prefetch={false}
            onClick={() => setOpen(false)}
            className="flex items-center gap-2.5 px-3 py-2.5 text-sm text-ink transition-colors hover:bg-paper-warm"
          >
            <EditIcon />
            <span>Edit</span>
          </Link>
          <Link
            href={`/edit/${slug}/revisions`}
            role="menuitem"
            prefetch={false}
            onClick={() => setOpen(false)}
            className="flex items-center gap-2.5 border-t border-border px-3 py-2.5 text-sm text-ink transition-colors hover:bg-paper-warm"
          >
            <HistoryIcon />
            <span>History</span>
          </Link>
          <button
            type="button"
            role="menuitem"
            onClick={onDelete}
            disabled={busy || isPending}
            className="flex w-full cursor-pointer items-center gap-2.5 border-t border-border px-3 py-2.5 text-left text-sm text-ink transition-colors hover:bg-paper-warm disabled:cursor-not-allowed disabled:opacity-50"
          >
            <DeleteIcon />
            <span>Delete</span>
          </button>
        </div>
      )}
    </div>
  );
}

function strokeProps() {
  return {
    xmlns: "http://www.w3.org/2000/svg",
    viewBox: "0 0 24 24",
    fill: "none" as const,
    stroke: "currentColor",
    strokeWidth: 2,
    strokeLinecap: "round" as const,
    strokeLinejoin: "round" as const,
    "aria-hidden": true,
    className: "size-4",
  };
}

function KebabIcon() {
  return (
    <svg {...strokeProps()}>
      <circle cx="12" cy="5" r="1" />
      <circle cx="12" cy="12" r="1" />
      <circle cx="12" cy="19" r="1" />
    </svg>
  );
}

function EditIcon() {
  return (
    <svg {...strokeProps()}>
      <path d="M12 20h9" />
      <path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4Z" />
    </svg>
  );
}

function DeleteIcon() {
  return (
    <svg {...strokeProps()}>
      <path d="M3 6h18" />
      <path d="M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
      <path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6" />
      <path d="M10 11v6" />
      <path d="M14 11v6" />
    </svg>
  );
}

function HistoryIcon() {
  return (
    <svg {...strokeProps()}>
      <path d="M3 12a9 9 0 1 0 3-6.7L3 8" />
      <path d="M3 3v5h5" />
      <path d="M12 7v5l3 2" />
    </svg>
  );
}
