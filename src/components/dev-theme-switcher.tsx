"use client";

import { useEffect, useState } from "react";

type Mode = "system" | "light" | "dark";
const MODES = ["system", "light", "dark"] as const;
const STORAGE_KEY = "md.dev-theme";

function apply(mode: Mode) {
  const root = document.documentElement;
  root.classList.add("theme-changing");
  if (mode === "system") {
    root.removeAttribute("data-theme");
  } else {
    root.setAttribute("data-theme", mode);
  }
  requestAnimationFrame(() => {
    requestAnimationFrame(() => {
      root.classList.remove("theme-changing");
    });
  });
}

export function DevThemeSwitcher() {
  const [mode, setMode] = useState<Mode>("system");

  useEffect(() => {
    const saved = (localStorage.getItem(STORAGE_KEY) as Mode | null) ?? "system";
    setMode(saved);
    apply(saved);
  }, []);

  function pick(next: Mode) {
    localStorage.setItem(STORAGE_KEY, next);
    setMode(next);
    apply(next);
  }

  return (
    <div className="fixed bottom-3 left-3 z-[100] flex gap-1 rounded-md border border-border bg-paper p-1 font-mono text-[0.6875rem] shadow-[var(--shadow-soft)]">
      {MODES.map((m) => (
        <button
          key={m}
          type="button"
          onClick={() => pick(m)}
          className={
            mode === m
              ? "cursor-pointer rounded px-2 py-1 bg-ochre text-paper"
              : "cursor-pointer rounded px-2 py-1 text-muted hover:text-ink"
          }
        >
          {m}
        </button>
      ))}
    </div>
  );
}
