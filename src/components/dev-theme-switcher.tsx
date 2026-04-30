"use client";

import { useEffect } from "react";

type Mode = "system" | "light" | "dark";
const MODES = ["system", "light", "dark"] as const;
const STORAGE_KEY = "md.dev-theme";

function isMode(value: string): value is Mode {
  return (MODES as readonly string[]).includes(value);
}

function apply(mode: Mode) {
  const root = document.documentElement;
  root.classList.add("theme-changing");
  if (mode === "system") {
    root.removeAttribute("data-theme");
    root.removeAttribute("data-dev-theme");
  } else {
    root.setAttribute("data-theme", mode);
    root.setAttribute("data-dev-theme", mode);
  }
  requestAnimationFrame(() => {
    requestAnimationFrame(() => {
      root.classList.remove("theme-changing");
    });
  });
}

export function DevThemeSwitcher() {
  useEffect(() => {
    const raw = localStorage.getItem(STORAGE_KEY);
    const saved: Mode = raw && isMode(raw) ? raw : "system";
    apply(saved);
  }, []);

  function pick(next: Mode) {
    localStorage.setItem(STORAGE_KEY, next);
    apply(next);
  }

  return (
    <div className="dev-theme-switcher fixed bottom-3 left-3 z-[100] flex gap-1 rounded-md border border-border bg-paper p-1 font-mono text-[0.6875rem] shadow-[var(--shadow-soft)]">
      {MODES.map((m) => (
        <button
          key={m}
          type="button"
          data-mode={m}
          onClick={() => pick(m)}
          className="cursor-pointer rounded px-2 py-1"
        >
          {m}
        </button>
      ))}
    </div>
  );
}
