"use client";

import { useEffect, useId, useRef, useState } from "react";

let mermaidPromise: Promise<typeof import("mermaid").default> | null = null;

function loadMermaid() {
  if (!mermaidPromise) {
    mermaidPromise = import("mermaid").then(({ default: mermaid }) => {
      mermaid.initialize({
        startOnLoad: false,
        securityLevel: "strict",
        theme: typeof window !== "undefined" &&
          window.matchMedia("(prefers-color-scheme: dark)").matches
          ? "dark"
          : "default",
      });
      return mermaid;
    });
  }
  return mermaidPromise;
}

export function Mermaid({ chart }: { chart: string }) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [error, setError] = useState<string | null>(null);
  const reactId = useId();
  const id = `mermaid-${reactId.replace(/:/g, "")}`;

  useEffect(() => {
    let cancelled = false;

    const renderChart = async () => {
      const mermaid = await loadMermaid();
      // Wait for web fonts before rendering: mermaid sizes node boxes by
      // measuring label text, and a not-yet-loaded font measures too narrow,
      // which clips labels at the box edge once the real font swaps in.
      if (typeof document !== "undefined" && document.fonts) {
        await document.fonts.ready;
      }
      if (cancelled) return;
      const { svg } = await mermaid.render(id, chart);
      if (!cancelled && containerRef.current) {
        containerRef.current.innerHTML = svg;
      }
    };

    renderChart().catch((err) => {
      if (!cancelled) {
        setError(err instanceof Error ? err.message : String(err));
      }
    });

    return () => {
      cancelled = true;
    };
  }, [chart, id]);

  if (error) {
    return (
      <pre className="overflow-x-auto rounded-md border border-red-300 bg-red-50 p-3 text-xs text-red-800 dark:border-red-900 dark:bg-red-950 dark:text-red-200">
        Mermaid render error: {error}
      </pre>
    );
  }

  return <div ref={containerRef} className="my-4 flex justify-center" />;
}
