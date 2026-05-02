"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

const PRELOAD_KEY = "md.new.preload";
const PRELOAD_EVENT = "md:new:preload";

export type PreloadPayload = {
  title: string;
  content: string;
};

export function DropAnywhere() {
  const [active, setActive] = useState(false);
  const router = useRouter();

  useEffect(() => {
    let depth = 0;

    function hasFiles(e: DragEvent): boolean {
      return Array.from(e.dataTransfer?.types ?? []).includes("Files");
    }

    function isMarkdownFile(file: File): boolean {
      const lower = file.name.toLowerCase();
      if (lower.endsWith(".md") || lower.endsWith(".markdown")) return true;
      if (file.type === "text/markdown" || file.type === "text/x-markdown") {
        return true;
      }
      return false;
    }

    function onDragEnter(e: DragEvent) {
      if (!hasFiles(e)) return;
      depth++;
      setActive(true);
    }

    function onDragLeave() {
      depth--;
      if (depth <= 0) {
        depth = 0;
        setActive(false);
      }
    }

    function onDragOver(e: DragEvent) {
      if (!hasFiles(e)) return;
      e.preventDefault();
    }

    async function onDrop(e: DragEvent) {
      depth = 0;
      setActive(false);
      if (!hasFiles(e)) return;
      const file = e.dataTransfer?.files?.[0];
      if (!file || !isMarkdownFile(file)) return;
      e.preventDefault();
      const text = await file.text();
      const payload: PreloadPayload = {
        content: text,
        title: file.name.replace(/\.(md|markdown)$/i, ""),
      };
      try {
        sessionStorage.setItem(PRELOAD_KEY, JSON.stringify(payload));
      } catch {
        // sessionStorage full or denied; bail silently
        return;
      }
      if (window.location.pathname !== "/new") {
        router.push("/new");
      } else {
        window.dispatchEvent(new Event(PRELOAD_EVENT));
      }
    }

    document.addEventListener("dragenter", onDragEnter);
    document.addEventListener("dragleave", onDragLeave);
    document.addEventListener("dragover", onDragOver);
    document.addEventListener("drop", onDrop);
    return () => {
      document.removeEventListener("dragenter", onDragEnter);
      document.removeEventListener("dragleave", onDragLeave);
      document.removeEventListener("dragover", onDragOver);
      document.removeEventListener("drop", onDrop);
    };
  }, [router]);

  if (!active) return null;
  return (
    <div
      aria-hidden
      className="pointer-events-none fixed inset-0 z-[100] border border-ochre"
    />
  );
}

export function readDropPreload(): PreloadPayload | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = sessionStorage.getItem(PRELOAD_KEY);
    if (!raw) return null;
    sessionStorage.removeItem(PRELOAD_KEY);
    const parsed = JSON.parse(raw) as PreloadPayload;
    if (typeof parsed.content !== "string") return null;
    return {
      title: typeof parsed.title === "string" ? parsed.title : "",
      content: parsed.content,
    };
  } catch {
    return null;
  }
}

export const DROP_PRELOAD_EVENT = PRELOAD_EVENT;
