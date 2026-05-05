"use client";

import { useEffect, useReducer } from "react";
import { initial, reduce } from "@/lib/restore-confirm-state";

type Props = {
  onConfirm: () => void;
  disabled?: boolean;
};

export function RestoreButton({ onConfirm, disabled }: Props) {
  const [state, dispatch] = useReducer(reduce, initial);

  useEffect(() => {
    if (state.phase !== "confirming") return;
    const id = setInterval(() => dispatch({ type: "tick" }), 1000);
    return () => clearInterval(id);
  }, [state.phase]);

  const label =
    state.phase === "idle"
      ? "Restore this version"
      : `Confirm restore (${state.secondsLeft})`;

  function handleClick() {
    if (disabled) return;
    if (state.phase === "confirming") {
      onConfirm();
      return;
    }
    dispatch({ type: "click" });
  }

  return (
    <button
      type="button"
      onClick={handleClick}
      disabled={disabled}
      data-phase={state.phase}
      aria-live="polite"
      className="relative cursor-pointer overflow-hidden rounded-md border border-border bg-transparent px-3 py-1.5 font-mono text-[0.6875rem] font-semibold uppercase tracking-[0.12em] text-ink transition-colors hover:bg-paper-warm hover:text-ochre disabled:cursor-not-allowed disabled:opacity-50"
    >
      {label}
      {state.phase === "confirming" && (
        <span
          aria-hidden="true"
          data-restore-confirm-rule
          className="absolute bottom-0 left-0 h-[2px] w-full origin-left bg-ochre"
        />
      )}
    </button>
  );
}
