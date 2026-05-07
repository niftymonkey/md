"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { MobileBar } from "@/components/mobile-bar";
import { TagInput } from "@/components/tag-input";

const MAX_BYTES = 1024 * 1024;

type Props = {
  slug: string;
  initialContent: string;
  initialTitle: string;
  initialTags: string[];
};

function arraysEqual(a: string[], b: string[]): boolean {
  if (a.length !== b.length) return false;
  for (let i = 0; i < a.length; i++) if (a[i] !== b[i]) return false;
  return true;
}

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
  initialTags,
}: Props) {
  const [content, setContent] = useState(initialContent);
  const [title, setTitle] = useState(initialTitle);
  const [tags, setTags] = useState<string[]>(initialTags);
  const [savedContent, setSavedContent] = useState(initialContent);
  const [savedTitle, setSavedTitle] = useState(initialTitle);
  const [savedTags, setSavedTags] = useState<string[]>(initialTags);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [justSaved, setJustSaved] = useState(false);
  const router = useRouter();

  const dirty =
    content !== savedContent ||
    title !== savedTitle ||
    !arraysEqual(tags, savedTags);

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
    const payload: {
      content?: string;
      title?: string | null;
      tags?: string[];
    } = {};
    if (content !== savedContent) payload.content = content;
    if (title !== savedTitle) payload.title = normalizedTitle || null;
    if (!arraysEqual(tags, savedTags)) payload.tags = tags;

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
    setSavedTags(tags);
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
        if (document.documentElement.dataset.hotkeysOpen === "true") return;
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
  }, [content, title, tags, dirty, saving]);

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
      <TagInput value={tags} onChange={setTags} />
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
        <div className="ml-auto hidden items-center gap-2 md:flex">
          <button
            type="button"
            onClick={() => router.push(`/v/${slug}`)}
            title="View document"
            className="inline-flex cursor-pointer items-center gap-1.5 rounded-md border border-border bg-paper px-3 py-1.5 text-[0.8125rem] font-semibold text-ink transition-[border-color,color] duration-150 hover:border-ochre hover:text-ochre"
          >
            View
          </button>
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
      <MobileBar palette>
        <button
          type="button"
          onClick={() => router.push(`/v/${slug}`)}
          aria-label="View document"
          className="grid size-11 cursor-pointer place-items-center rounded-md border border-border bg-paper text-muted transition-[border-color,color] duration-150 hover:border-ochre hover:text-ochre"
        >
          <ViewGlyph />
        </button>
        <button
          type="button"
          onClick={cancel}
          aria-label="Cancel"
          className="grid size-11 cursor-pointer place-items-center rounded-md border border-border bg-paper text-muted transition-[border-color,color] duration-150 hover:border-ochre hover:text-ochre"
        >
          <CancelGlyph />
        </button>
        <button
          type="button"
          onClick={() => void save()}
          disabled={saving || !dirty}
          aria-label={saving ? "Saving" : "Save"}
          className="grid size-11 cursor-pointer place-items-center rounded-md border border-ink bg-ink text-paper transition-colors duration-150 hover:bg-ochre-deep hover:border-ochre-deep disabled:cursor-not-allowed disabled:opacity-60 disabled:hover:bg-ink disabled:hover:border-ink"
        >
          <SaveGlyph />
        </button>
      </MobileBar>
    </div>
  );
}

function glyphProps() {
  return {
    xmlns: "http://www.w3.org/2000/svg",
    viewBox: "0 0 24 24",
    fill: "none" as const,
    stroke: "currentColor",
    strokeWidth: 2,
    strokeLinecap: "round" as const,
    strokeLinejoin: "round" as const,
    "aria-hidden": true,
    className: "size-[18px]",
  };
}

function ViewGlyph() {
  return (
    <svg {...glyphProps()}>
      <path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12z" />
      <circle cx="12" cy="12" r="3" />
    </svg>
  );
}

function CancelGlyph() {
  return (
    <svg {...glyphProps()}>
      <path d="M18 6 6 18" />
      <path d="m6 6 12 12" />
    </svg>
  );
}

function SaveGlyph() {
  return (
    <svg {...glyphProps()}>
      <path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z" />
      <polyline points="17 21 17 13 7 13 7 21" />
      <polyline points="7 3 7 8 15 8" />
    </svg>
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
