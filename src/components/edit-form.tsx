"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

const MAX_BYTES = 1024 * 1024;

type Props = {
  slug: string;
  initialContent: string;
  initialTitle: string;
};

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

export function EditForm({
  slug,
  initialContent,
  initialTitle,
}: Props) {
  const [content, setContent] = useState(initialContent);
  const [title, setTitle] = useState(initialTitle);
  const [savedContent, setSavedContent] = useState(initialContent);
  const [savedTitle, setSavedTitle] = useState(initialTitle);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [justSaved, setJustSaved] = useState(false);
  const router = useRouter();

  const dirty = content !== savedContent || title !== savedTitle;

  async function save() {
    if (saving) return;
    setError(null);
    if (!content.trim()) {
      setError("Content is empty");
      return;
    }
    if (new Blob([content]).size > MAX_BYTES) {
      setError("Content exceeds 1MB limit");
      return;
    }
    if (!dirty) return;

    const normalizedTitle = title.trim();
    const payload: { content?: string; title?: string | null } = {};
    if (content !== savedContent) payload.content = content;
    if (title !== savedTitle) payload.title = normalizedTitle || null;

    setSaving(true);
    let response: Response;
    try {
      response = await fetch(`/api/docs/${slug}`, {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(payload),
      });
    } catch {
      setError("Network error");
      setSaving(false);
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
      setError(message);
      setSaving(false);
      return;
    }

    setSavedContent(content);
    setSavedTitle(normalizedTitle);
    setTitle(normalizedTitle);
    setSaving(false);
    setJustSaved(true);
    window.setTimeout(() => setJustSaved(false), 1500);
  }

  function cancel() {
    if (dirty && !window.confirm("Discard unsaved changes?")) return;
    router.push(`/v/${slug}`);
  }

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && (e.key === "s" || e.key === "S")) {
        e.preventDefault();
        void save();
        return;
      }
      if (e.key === "Escape") {
        if (document.documentElement.dataset.cmdPaletteOpen === "true") return;
        const target = e.target as HTMLElement | null;
        const tag = target?.tagName;
        if (tag === "INPUT" || tag === "TEXTAREA") {
          (target as HTMLInputElement | HTMLTextAreaElement).blur();
          return;
        }
        cancel();
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [content, title, dirty, saving]);

  let statusLabel: string;
  let statusClass: string;
  if (saving) {
    statusLabel = "saving…";
    statusClass = "text-muted";
  } else if (justSaved) {
    statusLabel = "saved";
    statusClass = "saved-pulse text-ochre";
  } else if (dirty) {
    statusLabel = "unsaved changes";
    statusClass = "text-ochre";
  } else {
    statusLabel = "no changes";
    statusClass = "text-muted";
  }

  return (
    <div className="space-y-4">
      <input
        type="text"
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        placeholder="Untitled"
        aria-label="Title"
        className="block h-11 w-full rounded-md border border-border bg-paper-warm px-3.5 text-base font-semibold tracking-[-0.01em] placeholder:text-muted/70 focus:outline-none focus:ring-2 focus:ring-ochre"
      />
      <textarea
        value={content}
        onChange={(e) => {
          setContent(e.target.value);
          if (error) setError(null);
        }}
        rows={24}
        spellCheck={false}
        aria-label="Markdown content"
        className="block w-full resize-y rounded-md border border-border bg-paper-warm px-3.5 py-3 font-mono text-sm focus:outline-none focus:ring-2 focus:ring-ochre"
      />
      <div className="flex flex-wrap items-center gap-3">
        <span
          key={statusLabel}
          className={`text-[0.6875rem] font-semibold uppercase tracking-[0.12em] ${statusClass}`}
        >
          {statusLabel}
        </span>
        <div className="ml-auto flex items-center gap-2">
          <button
            type="button"
            onClick={cancel}
            className="inline-flex cursor-pointer items-center gap-1.5 rounded-md border border-border bg-paper px-3 py-1.5 text-[0.8125rem] font-semibold text-ink transition-[border-color,color] duration-150 hover:border-ochre hover:text-ochre"
          >
            Cancel
            <KbdHintInline keys={["Esc"]} />
          </button>
          <button
            type="button"
            onClick={() => void save()}
            disabled={saving || !dirty}
            className="inline-flex cursor-pointer items-center gap-1.5 rounded-md border border-ink bg-ink px-3 py-1.5 text-[0.8125rem] font-semibold text-paper transition-colors duration-150 hover:bg-ochre-deep hover:border-ochre-deep disabled:cursor-not-allowed disabled:opacity-60 disabled:hover:bg-ink disabled:hover:border-ink"
          >
            {saving ? "Saving…" : "Save"}
            <KbdHintInline keys={["mod", "S"]} variant="primary" />
          </button>
        </div>
      </div>
      {error && (
        <p className="text-sm text-ochre" role="alert">
          {error}
        </p>
      )}
    </div>
  );
}

function KbdHintInline({
  keys,
  variant = "ghost",
}: {
  keys: string[];
  variant?: "ghost" | "primary";
}) {
  const ghostClass =
    "rounded-[3px] border border-border bg-paper-warm/60 px-[5px] py-[1px] font-mono text-[0.625rem] font-medium text-muted";
  const primaryClass =
    "rounded-[3px] border border-paper/20 bg-paper/15 px-[5px] py-[1px] font-mono text-[0.625rem] font-medium text-paper/80";
  const cls = variant === "primary" ? primaryClass : ghostClass;
  return (
    <>
      <span data-key-mac className="ml-1 inline-flex items-center gap-1">
        {keys.map((k, i) => (
          <kbd key={i} className={cls}>
            {macKey(k)}
          </kbd>
        ))}
      </span>
      <span data-key-other className="ml-1 inline-flex items-center gap-1">
        {keys.map((k, i) => (
          <kbd key={i} className={cls}>
            {otherKey(k)}
          </kbd>
        ))}
      </span>
    </>
  );
}
