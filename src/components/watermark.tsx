"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";

type Variant = "reader" | "operator" | "editor" | "settings";

type WatermarkProps = {
  variant: Variant;
  rawHref?: string;
};

export function Watermark({ variant, rawHref }: WatermarkProps) {
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }
    function onPointer(e: MouseEvent) {
      if (!containerRef.current) return;
      if (containerRef.current.contains(e.target as Node)) return;
      setOpen(false);
    }
    window.addEventListener("keydown", onKey);
    window.addEventListener("mousedown", onPointer);
    return () => {
      window.removeEventListener("keydown", onKey);
      window.removeEventListener("mousedown", onPointer);
    };
  }, [open]);

  return (
    <div ref={containerRef} className="relative inline-block">
      <button
        type="button"
        aria-label="md.niftymonkey.dev menu"
        aria-expanded={open}
        onClick={() => setOpen((v) => !v)}
        className="watermark-glyph relative grid size-8 cursor-pointer place-items-center rounded-md border border-border bg-paper text-ochre transition-[border-color] duration-200 hover:border-ochre"
      >
        <MdGlyph />
        <span className="watermark-underline pointer-events-none absolute -bottom-[7px] left-0 h-[2px] w-full bg-ochre" />
      </button>
      {open && <Menu variant={variant} rawHref={rawHref} />}
    </div>
  );
}

function Menu({ variant, rawHref }: WatermarkProps) {
  return (
    <div
      role="menu"
      className="absolute right-0 top-[calc(100%+8px)] z-50 min-w-[280px] rounded-lg border border-border bg-paper p-2 shadow-[var(--shadow-soft)]"
    >
      {variant === "reader" && <ReaderRows rawHref={rawHref} />}
      {variant === "operator" && <OperatorRows />}
      {variant === "editor" && <EditorRows />}
      {variant === "settings" && <SettingsRows />}
      <GroupDivider />
      <RowLabel>md.niftymonkey.dev</RowLabel>
    </div>
  );
}

function ReaderRows({ rawHref }: { rawHref?: string }) {
  function copyLink() {
    if (typeof window === "undefined") return;
    void navigator.clipboard.writeText(window.location.href);
  }
  return (
    <Group label="Document">
      {rawHref && (
        <RowLink href={rawHref} kbd="r">
          View raw
        </RowLink>
      )}
      <RowButton onClick={copyLink} kbd="c">
        Copy link
      </RowButton>
    </Group>
  );
}

function OperatorRows() {
  return (
    <Group label="Operator">
      <RowButton kbd="⌘K">Command palette</RowButton>
      <RowLink href="/settings">Settings</RowLink>
      <RowLink href="/all">All docs</RowLink>
    </Group>
  );
}

function EditorRows() {
  return (
    <Group label="Editing">
      <RowButton kbd="⌘S">Save</RowButton>
      <RowButton kbd="Esc">Cancel</RowButton>
    </Group>
  );
}

function SettingsRows() {
  return (
    <Group label="Settings">
      <RowButton kbd="⌘K">Command palette</RowButton>
      <RowLink href="/">Back to dashboard</RowLink>
    </Group>
  );
}

function Group({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="px-1 pb-1">
      <RowLabel>{label}</RowLabel>
      <div className="mt-1 flex flex-col">{children}</div>
    </div>
  );
}

function GroupDivider() {
  return <div className="my-1 h-px bg-border" />;
}

function RowLabel({ children }: { children: ReactNode }) {
  return (
    <div className="px-2 pt-1 text-[0.6875rem] font-semibold uppercase tracking-[0.12em] text-muted">
      {children}
    </div>
  );
}

function RowLink({
  href,
  kbd,
  children,
}: {
  href: string;
  kbd?: string;
  children: ReactNode;
}) {
  return (
    <a
      href={href}
      role="menuitem"
      className="flex items-center justify-between rounded-md px-2 py-1.5 text-sm text-ink hover:bg-paper-warm"
    >
      <span>{children}</span>
      {kbd && <Kbd>{kbd}</Kbd>}
    </a>
  );
}

function RowButton({
  onClick,
  kbd,
  children,
}: {
  onClick?: () => void;
  kbd?: string;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      role="menuitem"
      className="flex items-center justify-between rounded-md px-2 py-1.5 text-left text-sm text-ink hover:bg-paper-warm"
    >
      <span>{children}</span>
      {kbd && <Kbd>{kbd}</Kbd>}
    </button>
  );
}

function Kbd({ children }: { children: ReactNode }) {
  return (
    <kbd className="ml-3 rounded border border-border bg-paper-warm px-1.5 py-0.5 font-mono text-[0.6875rem] font-medium text-muted">
      {children}
    </kbd>
  );
}

function MdGlyph() {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className="size-4"
      aria-hidden="true"
    >
      <path d="M3 19V5l5 7 5-7v14" />
      <path d="M16 5l5 14" />
    </svg>
  );
}
