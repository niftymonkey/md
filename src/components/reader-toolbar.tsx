"use client";

import { useState, type ReactNode } from "react";
import { useRouter } from "next/navigation";

type Width = "reading" | "wide";

type Props = {
  width: Width;
  onWidthChange: (next: Width) => void;
  rawHref: string;
  dashboardHref?: string;
  editHref?: string;
};

export function ReaderToolbar({
  width,
  onWidthChange,
  rawHref,
  dashboardHref,
  editHref,
}: Props) {
  return (
    <div className="reader-toolbar flex flex-col items-center gap-1.5">
      <WidthPill value={width} onChange={onWidthChange} />
      {editHref && <EditButton href={editHref} />}
      <CopyLinkButton />
      <RawButton href={rawHref} />
      {dashboardHref && <DashboardButton href={dashboardHref} />}
    </div>
  );
}

function WidthPill({
  value,
  onChange,
}: {
  value: Width;
  onChange: (next: Width) => void;
}) {
  return (
    <div
      role="group"
      aria-label="Article width"
      className="reader-toolbar__width-pill flex w-8 flex-col overflow-hidden rounded-md border border-border bg-paper"
    >
      {(["reading", "wide"] as const).map((w) => (
        <button
          key={w}
          type="button"
          data-width-pill={w}
          onClick={() => onChange(w)}
          aria-label={`Width: ${w}`}
          title={w === "reading" ? "Reading width (w)" : "Wide width (w)"}
          aria-pressed={value === w}
          className="reader-toolbar__width-btn cursor-pointer border-0 bg-transparent py-1 font-mono text-[0.625rem] font-medium leading-none tracking-[0.04em] text-muted"
        >
          {w === "reading" ? "R" : "W"}
        </button>
      ))}
    </div>
  );
}

function CopyLinkButton() {
  const [copied, setCopied] = useState(false);

  function copy() {
    if (typeof window === "undefined") return;
    if (!navigator.clipboard?.writeText) return;
    void navigator.clipboard
      .writeText(window.location.href)
      .then(() => {
        setCopied(true);
        window.setTimeout(() => setCopied(false), 1500);
      })
      .catch(() => {
        // clipboard denied; silent
      });
  }

  return (
    <ToolbarButton
      onClick={copy}
      label={copied ? "Copied" : "Copy link (c)"}
      data-copied={copied ? "true" : undefined}
    >
      {copied ? <CheckIcon /> : <LinkIcon />}
    </ToolbarButton>
  );
}

function RawButton({ href }: { href: string }) {
  return (
    <ToolbarButton
      label="View raw (r)"
      onClick={() => window.location.assign(href)}
    >
      <RawIcon />
    </ToolbarButton>
  );
}

function EditButton({ href }: { href: string }) {
  const router = useRouter();
  return (
    <ToolbarButton
      label="Edit (e)"
      onClick={() => router.push(href)}
    >
      <EditIcon />
    </ToolbarButton>
  );
}

function DashboardButton({ href }: { href: string }) {
  const router = useRouter();
  return (
    <ToolbarButton
      label="Back to dashboard"
      onClick={() => router.push(href)}
    >
      <BackIcon />
    </ToolbarButton>
  );
}

function ToolbarButton({
  onClick,
  label,
  children,
  ...rest
}: {
  onClick: () => void;
  label: string;
  children: ReactNode;
} & Record<string, unknown>) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={label}
      title={label}
      className="reader-toolbar__btn grid size-8 cursor-pointer place-items-center rounded-md border border-border bg-paper text-muted transition-[border-color,color] duration-200 hover:border-ochre hover:text-ochre"
      {...rest}
    >
      {children}
    </button>
  );
}

function strokeProps() {
  return {
    xmlns: "http://www.w3.org/2000/svg",
    viewBox: "0 0 24 24",
    fill: "none" as const,
    stroke: "currentColor",
    strokeWidth: 2,
    strokeLinecap: "round" as const,
    strokeLinejoin: "round" as const,
    className: "size-4",
    "aria-hidden": true,
  };
}

function LinkIcon() {
  return (
    <svg {...strokeProps()}>
      <path d="M10 13a5 5 0 0 0 7.07 0l3-3a5 5 0 1 0-7.07-7.07L11 5" />
      <path d="M14 11a5 5 0 0 0-7.07 0l-3 3a5 5 0 1 0 7.07 7.07L13 19" />
    </svg>
  );
}

function CheckIcon() {
  return (
    <svg {...strokeProps()}>
      <polyline points="20 6 9 17 4 12" />
    </svg>
  );
}

function RawIcon() {
  return (
    <svg {...strokeProps()}>
      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
      <path d="M14 2v6h6" />
    </svg>
  );
}

function EditIcon() {
  return (
    <svg {...strokeProps()}>
      <path d="M12 20h9" />
      <path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4z" />
    </svg>
  );
}

function BackIcon() {
  return (
    <svg {...strokeProps()}>
      <line x1="19" y1="12" x2="5" y2="12" />
      <polyline points="12 19 5 12 12 5" />
    </svg>
  );
}
