"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import { openCmdPalette } from "./cmd-palette";

function macKey(k: string): string {
  if (k === "mod") return "⌘";
  if (k === "shift") return "⇧";
  if (k === "alt") return "⌥";
  if (k.length === 1) return k.toUpperCase();
  return k;
}

function otherKey(k: string): string {
  if (k === "mod") return "Ctrl";
  if (k === "shift") return "Shift";
  if (k === "alt") return "Alt";
  if (k.length === 1) return k.toUpperCase();
  return k;
}

type Variant = "reader" | "operator" | "editor" | "settings";

type Width = "reading" | "wide";

type Size = "md" | "lg";

const SIZE_CLASSES: Record<Size, { button: string; glyph: string }> = {
  md: { button: "size-8", glyph: "size-4" },
  lg: { button: "size-11", glyph: "size-5" },
};

type WatermarkProps = {
  variant: Variant;
  size?: Size;
  rawHref?: string;
  width?: Width;
  onWidthChange?: (next: Width) => void;
  signOutAction?: () => Promise<void>;
  dashboardHref?: string;
  onSave?: () => void;
  onCancel?: () => void;
  pulse?: boolean;
};

export function Watermark({
  variant,
  size = "md",
  rawHref,
  width,
  onWidthChange,
  signOutAction,
  dashboardHref,
  onSave,
  onCancel,
  pulse,
}: WatermarkProps) {
  const sizeClass = SIZE_CLASSES[size];
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
    <div
      ref={containerRef}
      className="relative inline-block"
      data-watermark-open={open ? "true" : undefined}
    >
      <button
        type="button"
        aria-label="md.niftymonkey.dev menu"
        title="md.niftymonkey.dev menu"
        aria-haspopup="true"
        aria-expanded={open}
        data-pulse={pulse ? "true" : undefined}
        onClick={() => setOpen((v) => !v)}
        className={`watermark-glyph relative grid ${sizeClass.button} cursor-pointer place-items-center rounded-md border bg-paper text-ochre transition-[border-color] duration-200 hover:border-ochre ${
          pulse ? "border-ochre" : "border-border"
        }`}
      >
        <MdGlyph className={sizeClass.glyph} />
        <span className="watermark-underline pointer-events-none absolute -bottom-[7px] left-0 h-[2px] w-full bg-ochre" />
      </button>
      {open && (
        <Menu
          variant={variant}
          rawHref={rawHref}
          width={width}
          onWidthChange={onWidthChange}
          signOutAction={signOutAction}
          dashboardHref={dashboardHref}
          onSave={onSave}
          onCancel={onCancel}
          closeMenu={() => setOpen(false)}
        />
      )}
    </div>
  );
}

function Menu({
  variant,
  rawHref,
  width,
  onWidthChange,
  signOutAction,
  dashboardHref,
  onSave,
  onCancel,
  closeMenu,
}: WatermarkProps & { closeMenu: () => void }) {
  const hasOperatorExtras =
    (variant === "reader" || variant === "editor") &&
    (dashboardHref || signOutAction);

  return (
    <div
      className="absolute right-0 top-[calc(100%+8px)] z-50 min-w-[280px] rounded-lg border border-border bg-paper p-2.5 shadow-[var(--shadow-soft)]"
    >
      {variant === "reader" && (
        <ReaderRows rawHref={rawHref} width={width} onWidthChange={onWidthChange} />
      )}
      {variant === "operator" && (
        <OperatorRows signOutAction={signOutAction} closeMenu={closeMenu} />
      )}
      {variant === "editor" && (
        <EditorRows
          rawHref={rawHref}
          onSave={onSave}
          onCancel={onCancel}
          closeMenu={closeMenu}
        />
      )}
      {variant === "settings" && <SettingsRows closeMenu={closeMenu} />}
      {hasOperatorExtras && (
        <Group>
          {dashboardHref && (
            <RowLink href={dashboardHref} icon={<BackIcon />}>
              dashboard
            </RowLink>
          )}
          {signOutAction && (
            <RowButton
              onClick={() => void signOutAction()}
              icon={<SignOutIcon />}
            >
              sign out
            </RowButton>
          )}
        </Group>
      )}
    </div>
  );
}

function ReaderRows({
  rawHref,
  width,
  onWidthChange,
}: {
  rawHref?: string;
  width?: Width;
  onWidthChange?: (next: Width) => void;
}) {
  const [copied, setCopied] = useState(false);
  function copyLink() {
    if (typeof window === "undefined") return;
    if (!navigator.clipboard?.writeText) return;
    void navigator.clipboard
      .writeText(window.location.href)
      .then(() => {
        setCopied(true);
        window.setTimeout(() => setCopied(false), 1500);
      })
      .catch(() => {
        // clipboard denied; silent — user can grab URL from address bar
      });
  }
  return (
    <>
      <Group label="document">
        {rawHref && (
          <RowLink href={rawHref} kbd={["r"]} icon={<RawIcon />}>
            view raw
          </RowLink>
        )}
        <RowButton
          onClick={copyLink}
          kbd={copied ? undefined : ["c"]}
          rightSlot={copied ? <CopiedBadge /> : undefined}
          icon={<LinkIcon />}
        >
          {copied ? "copied" : "copy link"}
        </RowButton>
      </Group>
      {width && onWidthChange && (
        <Group label="view">
          <WidthRow value={width} onChange={onWidthChange} />
        </Group>
      )}
    </>
  );
}

function CopiedBadge() {
  return (
    <span className="text-ochre">
      <svg
        xmlns="http://www.w3.org/2000/svg"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2.5"
        strokeLinecap="round"
        strokeLinejoin="round"
        className="size-3.5"
        aria-hidden="true"
      >
        <polyline points="20 6 9 17 4 12" />
      </svg>
    </span>
  );
}

function OperatorRows({
  signOutAction,
  closeMenu,
}: {
  signOutAction?: () => Promise<void>;
  closeMenu: () => void;
}) {
  return (
    <>
      <Group>
        <RowButton
          icon={<CommandIcon />}
          kbd={["mod", "K"]}
          onClick={() => {
            closeMenu();
            openCmdPalette();
          }}
        >
          command palette
        </RowButton>
        <RowLink href="/settings" icon={<SettingsIcon />}>
          settings
        </RowLink>
        <RowSoon icon={<ListIcon />}>all docs</RowSoon>
      </Group>
      {signOutAction && (
        <Group>
          <RowButton onClick={() => void signOutAction()} icon={<SignOutIcon />}>
            sign out
          </RowButton>
        </Group>
      )}
    </>
  );
}

function RowSoon({
  icon,
  kbd,
  children,
}: {
  icon?: ReactNode;
  kbd?: string[];
  children: ReactNode;
}) {
  return (
    <div
      aria-disabled
      className="flex w-full cursor-not-allowed items-center justify-between gap-3 rounded-md px-2 py-[7px] text-sm text-muted"
    >
      <span className="flex items-center gap-2">
        {icon && (
          <span className="grid size-3.5 place-items-center text-muted/70">
            {icon}
          </span>
        )}
        <span>{children}</span>
      </span>
      {kbd && <Kbd keys={kbd} />}
    </div>
  );
}

function EditorRows({
  rawHref,
  onSave,
  onCancel,
  closeMenu,
}: {
  rawHref?: string;
  onSave?: () => void;
  onCancel?: () => void;
  closeMenu: () => void;
}) {
  return (
    <Group label="editing">
      <RowButton
        kbd={["mod", "S"]}
        icon={<SaveIcon />}
        onClick={() => {
          closeMenu();
          onSave?.();
        }}
      >
        save
      </RowButton>
      <RowButton
        kbd={["Esc"]}
        icon={<CancelIcon />}
        onClick={() => {
          closeMenu();
          onCancel?.();
        }}
      >
        cancel
      </RowButton>
      {rawHref && (
        <RowLink href={rawHref} icon={<RawIcon />}>
          view raw
        </RowLink>
      )}
    </Group>
  );
}

function SettingsRows({ closeMenu }: { closeMenu: () => void }) {
  return (
    <Group label="settings">
      <RowButton
        icon={<CommandIcon />}
        kbd={["mod", "K"]}
        onClick={() => {
          closeMenu();
          openCmdPalette();
        }}
      >
        command palette
      </RowButton>
      <RowLink href="/" icon={<BackIcon />}>
        back to dashboard
      </RowLink>
    </Group>
  );
}

function WidthRow({
  value,
  onChange,
}: {
  value: Width;
  onChange: (next: Width) => void;
}) {
  return (
    <div className="flex items-center justify-between gap-3 rounded px-2 py-1.5 text-sm text-ink">
      <span className="flex items-center gap-2">
        <span className="grid size-3.5 place-items-center text-muted">
          <WidthIcon />
        </span>
        <span>width</span>
      </span>
      <div className="flex overflow-hidden rounded-full border border-border">
        {(["reading", "wide"] as const).map((w) => (
          <button
            key={w}
            type="button"
            onClick={() => onChange(w)}
            className={
              value === w
                ? "bg-ochre px-2.5 py-[3px] font-mono text-[0.6875rem] font-semibold text-paper"
                : "bg-transparent px-2.5 py-[3px] font-mono text-[0.6875rem] font-medium text-muted transition-colors hover:text-ink"
            }
          >
            {w}
          </button>
        ))}
      </div>
    </div>
  );
}

function Group({ label, children }: { label?: string; children: ReactNode }) {
  return (
    <div className="px-1 py-1.5 [&+&]:mt-1 [&+&]:border-t [&+&]:border-border [&+&]:pt-2">
      {label && <RowLabel>{label}</RowLabel>}
      <div className={label ? "mt-1 flex flex-col" : "flex flex-col"}>
        {children}
      </div>
    </div>
  );
}

function RowLabel({ children }: { children: ReactNode }) {
  return (
    <div className="px-2 text-[0.625rem] font-semibold uppercase tracking-[0.12em] text-muted">
      {children}
    </div>
  );
}

function RowLink({
  href,
  kbd,
  icon,
  children,
}: {
  href: string;
  kbd?: string[];
  icon?: ReactNode;
  children: ReactNode;
}) {
  return (
    <a
      href={href}
      className="flex items-center justify-between gap-3 rounded-md px-2 py-[7px] text-sm text-ink transition-colors hover:bg-paper-warm"
    >
      <span className="flex items-center gap-2">
        {icon && (
          <span className="grid size-3.5 place-items-center text-muted">
            {icon}
          </span>
        )}
        <span>{children}</span>
      </span>
      {kbd && <Kbd keys={kbd} />}
    </a>
  );
}

function RowButton({
  onClick,
  kbd,
  icon,
  rightSlot,
  children,
}: {
  onClick?: () => void;
  kbd?: string[];
  icon?: ReactNode;
  rightSlot?: ReactNode;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="flex w-full items-center justify-between gap-3 rounded-md px-2 py-[7px] text-left text-sm text-ink transition-colors hover:bg-paper-warm"
    >
      <span className="flex items-center gap-2">
        {icon && (
          <span className="grid size-3.5 place-items-center text-muted">
            {icon}
          </span>
        )}
        <span>{children}</span>
      </span>
      {rightSlot ?? (kbd && <Kbd keys={kbd} />)}
    </button>
  );
}

function Kbd({ keys }: { keys: string[] }) {
  return (
    <>
      <span data-key-mac className="flex items-center gap-1">
        {keys.map((k, i) => (
          <kbd
            key={i}
            className="rounded-[3px] border border-border px-[5px] py-[1px] font-mono text-[0.6875rem] font-medium text-muted"
          >
            {macKey(k)}
          </kbd>
        ))}
      </span>
      <span data-key-other className="flex items-center gap-1">
        {keys.map((k, i) => (
          <kbd
            key={i}
            className="rounded-[3px] border border-border px-[5px] py-[1px] font-mono text-[0.6875rem] font-medium text-muted"
          >
            {otherKey(k)}
          </kbd>
        ))}
      </span>
    </>
  );
}

function MdGlyph({ className }: { className?: string }) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className ?? "size-4"}
      aria-hidden="true"
    >
      <path d="M3 19V5l5 7 5-7v14" />
      <path d="M16 5l5 14" />
    </svg>
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
    className: "size-3.5",
    "aria-hidden": true,
  };
}

function RawIcon() {
  return (
    <svg {...strokeProps()}>
      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
      <path d="M14 2v6h6" />
    </svg>
  );
}

function LinkIcon() {
  return (
    <svg {...strokeProps()}>
      <path d="M10 13a5 5 0 0 0 7.07 0l3-3a5 5 0 1 0-7.07-7.07L11 5" />
      <path d="M14 11a5 5 0 0 0-7.07 0l-3 3a5 5 0 1 0 7.07 7.07L13 19" />
    </svg>
  );
}

function CommandIcon() {
  return (
    <svg {...strokeProps()}>
      <path d="M9 6V4.5a2.5 2.5 0 1 0-2.5 2.5H9zm0 0v12m0-12h6m0 0V4.5A2.5 2.5 0 1 1 17.5 7H15zm0 0v12m0 0v1.5a2.5 2.5 0 1 0 2.5-2.5H15zm0 0H9m0 0v1.5A2.5 2.5 0 1 1 6.5 17H9z" />
    </svg>
  );
}

function SettingsIcon() {
  return (
    <svg {...strokeProps()}>
      <circle cx="12" cy="12" r="3" />
      <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 1 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 1 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 1 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 1 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" />
    </svg>
  );
}

function ListIcon() {
  return (
    <svg {...strokeProps()}>
      <line x1="8" y1="6" x2="21" y2="6" />
      <line x1="8" y1="12" x2="21" y2="12" />
      <line x1="8" y1="18" x2="21" y2="18" />
      <line x1="3" y1="6" x2="3.01" y2="6" />
      <line x1="3" y1="12" x2="3.01" y2="12" />
      <line x1="3" y1="18" x2="3.01" y2="18" />
    </svg>
  );
}

function SignOutIcon() {
  return (
    <svg {...strokeProps()}>
      <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
      <polyline points="16 17 21 12 16 7" />
      <line x1="21" y1="12" x2="9" y2="12" />
    </svg>
  );
}

function SaveIcon() {
  return (
    <svg {...strokeProps()}>
      <path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z" />
      <polyline points="17 21 17 13 7 13 7 21" />
      <polyline points="7 3 7 8 15 8" />
    </svg>
  );
}

function CancelIcon() {
  return (
    <svg {...strokeProps()}>
      <line x1="18" y1="6" x2="6" y2="18" />
      <line x1="6" y1="6" x2="18" y2="18" />
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

function WidthIcon() {
  return (
    <svg {...strokeProps()}>
      <polyline points="9 18 3 12 9 6" />
      <polyline points="15 6 21 12 15 18" />
      <line x1="3" y1="12" x2="21" y2="12" />
    </svg>
  );
}
