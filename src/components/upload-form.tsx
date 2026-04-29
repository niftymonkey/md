"use client";

import { useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Watermark } from "./watermark";

const MAX_BYTES = 1024 * 1024;
const ACCEPTED_EXTENSIONS = [".md", ".markdown"];

function isAcceptedFile(file: File): boolean {
  const lower = file.name.toLowerCase();
  if (ACCEPTED_EXTENSIONS.some((ext) => lower.endsWith(ext))) return true;
  if (file.type === "text/markdown" || file.type === "text/x-markdown") return true;
  return false;
}

export function UploadForm({
  signOutAction,
}: {
  signOutAction?: () => Promise<void>;
}) {
  const [content, setContent] = useState("");
  const [title, setTitle] = useState("");
  const [dragActive, setDragActive] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const router = useRouter();

  async function readFileAsText(file: File): Promise<string> {
    if (!isAcceptedFile(file)) {
      throw new Error("Only .md / .markdown files are accepted");
    }
    if (file.size > MAX_BYTES) {
      throw new Error("File exceeds 1MB limit");
    }
    return file.text();
  }

  async function handleFiles(files: FileList | null) {
    if (!files || files.length === 0) return;
    const file = files[0]!;
    try {
      const text = await readFileAsText(file);
      setContent(text);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to read file");
    }
  }

  function handleDrop(e: React.DragEvent) {
    e.preventDefault();
    setDragActive(false);
    void handleFiles(e.dataTransfer.files);
  }

  function handleDragOver(e: React.DragEvent) {
    e.preventDefault();
    setDragActive(true);
  }

  function handleDragLeave(e: React.DragEvent) {
    e.preventDefault();
    setDragActive(false);
  }

  async function submit() {
    setError(null);
    if (!content.trim()) {
      setError("Content is empty");
      return;
    }
    if (new Blob([content]).size > MAX_BYTES) {
      setError("Content exceeds 1MB limit");
      return;
    }

    const payload: { content: string; title?: string } = { content };
    if (title.trim()) payload.title = title.trim();

    let response: Response;
    try {
      response = await fetch("/api/upload", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(payload),
      });
    } catch {
      setError("Network error");
      return;
    }

    if (!response.ok) {
      let message = `Upload failed (${response.status})`;
      try {
        const data = await response.json();
        if (data?.error) message = data.error;
      } catch {
        // ignore JSON parse failure; keep status-based message
      }
      setError(message);
      return;
    }

    const data = (await response.json()) as { viewUrl: string; slug: string };

    setContent("");
    setTitle("");
    if (fileInputRef.current) fileInputRef.current.value = "";

    startTransition(() => {
      router.push(`/v/${data.slug}`);
    });
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-3">
        <input
          type="text"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="Title (optional — defaults to first heading)"
          className="block flex-1 rounded-md border border-border bg-paper-warm px-3.5 py-2.5 text-sm placeholder:text-muted/70 focus:outline-none focus:ring-2 focus:ring-ochre"
        />
        <Watermark variant="operator" signOutAction={signOutAction} />
      </div>
      <div
        onDrop={handleDrop}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        className={`relative rounded-md border-[1.5px] border-dashed transition-colors ${
          dragActive
            ? "border-ochre"
            : "border-border focus-within:border-ochre"
        }`}
      >
        <textarea
          value={content}
          onChange={(e) => {
            setContent(e.target.value);
            if (error) setError(null);
          }}
          rows={10}
          spellCheck={false}
          aria-label="Markdown content"
          className="block w-full resize-y rounded-md bg-paper-warm px-3.5 py-3 font-mono text-sm focus:outline-none"
        />
        {!content && (
          <div className="pointer-events-none absolute inset-0 grid place-items-center px-7">
            <div className="text-center">
              <div className="text-[1.25rem] font-bold tracking-[-0.02em]">
                Drop or paste markdown here
              </div>
              <div className="mt-1.5 text-[0.8125rem] text-muted">
                or click Choose file · 1MB cap
              </div>
            </div>
          </div>
        )}
      </div>
      {error && (
        <p className="text-sm text-ochre" role="alert">
          {error}
        </p>
      )}
      <div className="flex flex-wrap items-center gap-3">
        <button
          type="button"
          onClick={submit}
          disabled={isPending || !content.trim()}
          className="cursor-pointer rounded-md bg-ink px-[18px] py-[9px] text-sm font-semibold text-paper transition-colors hover:bg-ochre-deep disabled:cursor-not-allowed disabled:opacity-50"
        >
          {isPending ? "Publishing…" : "Publish"}
        </button>
        <input
          ref={fileInputRef}
          type="file"
          accept=".md,.markdown,text/markdown"
          className="hidden"
          onChange={(e) => handleFiles(e.target.files)}
        />
        <button
          type="button"
          onClick={() => fileInputRef.current?.click()}
          className="cursor-pointer rounded-md border border-border px-[18px] py-[9px] text-[0.6875rem] font-semibold uppercase tracking-[0.12em] text-ink transition-colors hover:bg-paper-warm"
        >
          Choose file
        </button>
      </div>
    </div>
  );
}
