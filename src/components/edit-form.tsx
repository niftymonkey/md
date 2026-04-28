"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";

const MAX_BYTES = 1024 * 1024;

type Props = {
  slug: string;
  initialContent: string;
  initialTitle: string;
  initialKind: string | null;
};

export function EditForm({ slug, initialContent, initialTitle, initialKind }: Props) {
  const [content, setContent] = useState(initialContent);
  const [title, setTitle] = useState(initialTitle);
  const [kind, setKind] = useState(initialKind ?? "");
  const [isPending, startTransition] = useTransition();
  const router = useRouter();

  const dirty =
    content !== initialContent ||
    title !== initialTitle ||
    kind !== (initialKind ?? "");

  async function save() {
    if (!content.trim()) {
      toast.error("Content is empty");
      return;
    }
    if (new Blob([content]).size > MAX_BYTES) {
      toast.error("Content exceeds 1MB limit");
      return;
    }

    const payload: { content?: string; title?: string | null; kind?: string | null } = {};
    if (content !== initialContent) payload.content = content;
    if (title !== initialTitle) payload.title = title.trim() || null;
    if (kind !== (initialKind ?? "")) payload.kind = kind.trim() || null;

    if (Object.keys(payload).length === 0) return;

    let response: Response;
    try {
      response = await fetch(`/api/docs/${slug}`, {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(payload),
      });
    } catch {
      toast.error("Network error");
      return;
    }

    if (!response.ok) {
      let message = `Save failed (${response.status})`;
      try {
        const data = await response.json();
        if (data?.error) message = data.error;
      } catch {
        // ignore JSON parse failure
      }
      toast.error(message);
      return;
    }

    startTransition(() => {
      router.push(`/v/${slug}`);
    });
  }

  return (
    <div className="space-y-4">
      <input
        type="text"
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        placeholder="Title (clear to re-derive from first heading)"
        aria-label="Title"
        className="block w-full rounded-md border border-zinc-300 bg-white px-3 py-2 text-sm shadow-sm placeholder:text-zinc-400 focus:border-zinc-500 focus:outline-none dark:border-zinc-700 dark:bg-zinc-900 dark:placeholder:text-zinc-500"
      />
      <input
        type="text"
        value={kind}
        onChange={(e) => setKind(e.target.value)}
        placeholder="Kind (optional, e.g. note, rep, synthesis)"
        aria-label="Kind (optional)"
        className="block w-full rounded-md border border-zinc-300 bg-white px-3 py-2 text-sm shadow-sm placeholder:text-zinc-400 focus:border-zinc-500 focus:outline-none dark:border-zinc-700 dark:bg-zinc-900 dark:placeholder:text-zinc-500"
      />
      <textarea
        value={content}
        onChange={(e) => setContent(e.target.value)}
        rows={20}
        spellCheck={false}
        aria-label="Markdown content"
        className="block w-full resize-y rounded-md border border-zinc-300 bg-white px-3 py-2 font-mono text-sm shadow-sm placeholder:text-zinc-400 focus:border-zinc-500 focus:outline-none dark:border-zinc-700 dark:bg-zinc-900 dark:placeholder:text-zinc-500"
      />
      <div className="flex flex-wrap items-center gap-3">
        <button
          type="button"
          onClick={save}
          disabled={isPending || !content.trim() || !dirty}
          className="rounded-md bg-zinc-900 px-4 py-2 text-sm font-medium text-white hover:bg-zinc-800 disabled:cursor-not-allowed disabled:opacity-50 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-200"
        >
          {isPending ? "Saving…" : "Save"}
        </button>
        <button
          type="button"
          onClick={() => router.push("/")}
          className="rounded-md border border-zinc-300 px-4 py-2 text-sm font-medium hover:bg-zinc-100 dark:border-zinc-700 dark:hover:bg-zinc-900"
        >
          Cancel
        </button>
      </div>
    </div>
  );
}
