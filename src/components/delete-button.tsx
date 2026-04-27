"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";

export function DeleteButton({ slug, title }: { slug: string; title: string }) {
  const [isPending, startTransition] = useTransition();
  const [busy, setBusy] = useState(false);
  const router = useRouter();

  async function onClick() {
    if (busy) return;
    if (!window.confirm(`Delete "${title}"? This cannot be undone.`)) return;

    setBusy(true);
    try {
      const response = await fetch(`/api/docs/${slug}`, { method: "DELETE" });
      if (!response.ok) {
        let message = `Delete failed (${response.status})`;
        try {
          const data = await response.json();
          if (data?.error) message = data.error;
        } catch {
          // ignore parse failure
        }
        toast.error(message);
        return;
      }
      toast.success("Deleted");
      startTransition(() => {
        router.refresh();
      });
    } catch {
      toast.error("Network error");
    } finally {
      setBusy(false);
    }
  }

  return (
    <button
      type="button"
      onClick={onClick}
      disabled={busy || isPending}
      aria-label={`Delete ${title}`}
      className="rounded p-1 text-zinc-400 hover:bg-zinc-100 hover:text-red-600 disabled:opacity-50 dark:hover:bg-zinc-800"
    >
      <svg
        xmlns="http://www.w3.org/2000/svg"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        className="h-4 w-4"
        aria-hidden="true"
      >
        <path d="M3 6h18" />
        <path d="M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
        <path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6" />
        <path d="M10 11v6" />
        <path d="M14 11v6" />
      </svg>
    </button>
  );
}
