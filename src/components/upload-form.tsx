"use client";

import { useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";

const MAX_BYTES = 1024 * 1024;
const ACCEPTED_EXTENSIONS = [".md", ".markdown"];

function isAcceptedFile(file: File): boolean {
  const lower = file.name.toLowerCase();
  if (ACCEPTED_EXTENSIONS.some((ext) => lower.endsWith(ext))) return true;
  if (file.type === "text/markdown" || file.type === "text/x-markdown") return true;
  return false;
}

export function UploadForm() {
  const [content, setContent] = useState("");
  const [title, setTitle] = useState("");
  const [titleEdited, setTitleEdited] = useState(false);
  const [dragActive, setDragActive] = useState(false);
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
      if (!titleEdited) {
        setTitle(file.name.replace(/\.(md|markdown)$/i, ""));
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to read file");
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
    if (!content.trim()) {
      toast.error("Content is empty");
      return;
    }
    if (new Blob([content]).size > MAX_BYTES) {
      toast.error("Content exceeds 1MB limit");
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
      toast.error("Network error");
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
      toast.error(message);
      return;
    }

    const data = (await response.json()) as { viewUrl: string; title: string };

    toast.success(data.title || "Uploaded", {
      description: data.viewUrl,
      duration: 12000,
      action: {
        label: "Copy",
        onClick: () => {
          navigator.clipboard.writeText(data.viewUrl).catch(() => {
            toast.error("Could not copy to clipboard");
          });
        },
      },
      cancel: {
        label: "View",
        onClick: () => {
          window.open(data.viewUrl, "_blank", "noopener,noreferrer");
        },
      },
    });

    setContent("");
    setTitle("");
    setTitleEdited(false);
    if (fileInputRef.current) fileInputRef.current.value = "";

    startTransition(() => {
      router.refresh();
    });
  }

  return (
    <div className="space-y-4">
      <input
        type="text"
        value={title}
        onChange={(e) => {
          setTitle(e.target.value);
          setTitleEdited(true);
        }}
        placeholder="Title (optional — defaults to first heading)"
        className="block w-full rounded-md border border-zinc-300 bg-white px-3 py-2 text-sm shadow-sm placeholder:text-zinc-400 focus:border-zinc-500 focus:outline-none dark:border-zinc-700 dark:bg-zinc-900 dark:placeholder:text-zinc-500"
      />
      <div
        onDrop={handleDrop}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        className={`relative rounded-md border-2 border-dashed transition-colors ${
          dragActive
            ? "border-blue-500 bg-blue-50 dark:bg-blue-950"
            : "border-zinc-300 bg-white dark:border-zinc-700 dark:bg-zinc-900"
        }`}
      >
        <textarea
          value={content}
          onChange={(e) => setContent(e.target.value)}
          placeholder="Drop a .md file here, paste markdown, or type"
          rows={12}
          spellCheck={false}
          className="block w-full resize-y rounded-md bg-transparent px-3 py-2 font-mono text-sm placeholder:text-zinc-400 focus:outline-none dark:placeholder:text-zinc-500"
        />
      </div>
      <div className="flex flex-wrap items-center gap-3">
        <button
          type="button"
          onClick={submit}
          disabled={isPending || !content.trim()}
          className="rounded-md bg-zinc-900 px-4 py-2 text-sm font-medium text-white hover:bg-zinc-800 disabled:cursor-not-allowed disabled:opacity-50 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-200"
        >
          {isPending ? "Uploading…" : "Upload"}
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
          className="rounded-md border border-zinc-300 px-4 py-2 text-sm font-medium hover:bg-zinc-100 dark:border-zinc-700 dark:hover:bg-zinc-900"
        >
          Choose file
        </button>
      </div>
    </div>
  );
}
