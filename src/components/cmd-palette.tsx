"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import { useRouter, usePathname } from "next/navigation";

const PALETTE_OPEN_EVENT = "md:cmd-palette:open";
const SEARCH_DEBOUNCE_MS = 120;
const RESULT_LIMIT = 8;

type DocResult = {
  id: string;
  slug: string;
  title: string;
};

type ActionItem = {
  id: string;
  title: string;
  icon: ReactNode;
  kbd?: string[];
  run: () => void | Promise<void>;
};

export function openCmdPalette() {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new Event(PALETTE_OPEN_EVENT));
}

type Props = {
  signOutAction?: () => Promise<void>;
};

export function CmdPalette({ signOutAction }: Props) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [docs, setDocs] = useState<DocResult[]>([]);
  const [docsLoading, setDocsLoading] = useState(false);
  const [selectedIndex, setSelectedIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const navRef = useRef<{ totalRows: number; safeIndex: number; pick: (i: number) => void; close: () => void }>({
    totalRows: 0,
    safeIndex: 0,
    pick: () => {},
    close: () => {},
  });
  const router = useRouter();
  const pathname = usePathname() ?? "/";

  function close() {
    setQuery("");
    setSelectedIndex(0);
    setDocs([]);
    setDocsLoading(false);
    setOpen(false);
  }

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && (e.key === "k" || e.key === "K")) {
        e.preventDefault();
        setOpen((v) => {
          if (v) {
            setQuery("");
            setSelectedIndex(0);
            setDocs([]);
            setDocsLoading(false);
          }
          return !v;
        });
      }
    }
    function onOpen() {
      setOpen(true);
    }
    window.addEventListener("keydown", onKey);
    window.addEventListener(PALETTE_OPEN_EVENT, onOpen);
    return () => {
      window.removeEventListener("keydown", onKey);
      window.removeEventListener(PALETTE_OPEN_EVENT, onOpen);
    };
  }, []);

  useEffect(() => {
    let waiting = false;
    let timer: number | null = null;
    function reset() {
      waiting = false;
      if (timer !== null) {
        window.clearTimeout(timer);
        timer = null;
      }
    }
    function onKey(e: KeyboardEvent) {
      if (e.metaKey || e.ctrlKey || e.altKey) {
        reset();
        return;
      }
      const target = e.target as HTMLElement | null;
      const tag = target?.tagName;
      if (
        tag === "INPUT" ||
        tag === "TEXTAREA" ||
        target?.isContentEditable
      ) {
        reset();
        return;
      }
      if (document.documentElement.dataset.cmdPaletteOpen === "true") {
        reset();
        return;
      }
      if (waiting && (e.key === "d" || e.key === "D")) {
        e.preventDefault();
        reset();
        if (window.location.pathname !== "/") router.push("/");
        return;
      }
      if (waiting && (e.key === "n" || e.key === "N")) {
        e.preventDefault();
        reset();
        if (window.location.pathname !== "/new") router.push("/new");
        return;
      }
      if (e.key === "g" || e.key === "G") {
        waiting = true;
        if (timer !== null) window.clearTimeout(timer);
        timer = window.setTimeout(reset, 1000);
        return;
      }
      reset();
    }
    window.addEventListener("keydown", onKey);
    return () => {
      window.removeEventListener("keydown", onKey);
      reset();
    };
  }, [router]);

  useEffect(() => {
    if (!open) return;
    const root = document.documentElement;
    root.setAttribute("data-cmd-palette-open", "true");
    const focusHandle = window.setTimeout(() => inputRef.current?.focus(), 0);
    return () => {
      root.removeAttribute("data-cmd-palette-open");
      window.clearTimeout(focusHandle);
    };
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const trimmed = query.trim();
    const url = trimmed
      ? `/api/list?search=${encodeURIComponent(trimmed)}&limit=${RESULT_LIMIT}`
      : `/api/list?limit=${RESULT_LIMIT}`;
    const ctrl = new AbortController();
    const handle = window.setTimeout(() => {
      setDocsLoading(true);
      void fetch(url, { signal: ctrl.signal })
        .then((r) => (r.ok ? r.json() : { docs: [] }))
        .then((data: { docs?: DocResult[] }) => {
          setDocs(data.docs ?? []);
          setDocsLoading(false);
        })
        .catch((err: unknown) => {
          if (err instanceof DOMException && err.name === "AbortError") return;
          setDocsLoading(false);
        });
    }, SEARCH_DEBOUNCE_MS);
    return () => {
      ctrl.abort();
      window.clearTimeout(handle);
    };
  }, [open, query]);

  const isDashboard = pathname === "/";
  const isReader = pathname.startsWith("/v/");
  const isEdit = pathname.startsWith("/edit/");
  const isSettings = pathname === "/settings";
  const docSlug =
    isReader || isEdit ? decodeURIComponent(pathname.split("/")[2] ?? "") : "";

  const actions: ActionItem[] = [];

  if (!isDashboard) {
    actions.push({
      id: "go-dashboard",
      title: "Back to dashboard",
      icon: <BackIcon />,
      kbd: ["g", "d"],
      run: () => {
        close();
        router.push("/");
      },
    });
  }

  actions.push({
    id: "new-document",
    title: "New document",
    icon: <NewIcon />,
    kbd: ["g", "n"],
    run: () => {
      close();
      router.push("/new");
    },
  });

  if (isReader && docSlug) {
    actions.push({
      id: "edit-doc",
      title: "Edit this document",
      icon: <EditIcon />,
      run: () => {
        close();
        router.push(`/edit/${docSlug}`);
      },
    });
  }

  if (isEdit && docSlug) {
    actions.push({
      id: "view-doc",
      title: "View this document",
      icon: <DocIcon />,
      run: () => {
        close();
        router.push(`/v/${docSlug}`);
      },
    });
  }

  if (isReader && docSlug) {
    actions.push({
      id: "view-raw",
      title: "View raw markdown",
      icon: <RawIcon />,
      run: () => {
        close();
        window.location.assign(`/api/raw/${docSlug}`);
      },
    });
  }

  if ((isReader || isEdit) && docSlug) {
    actions.push({
      id: "copy-link",
      title: "Copy link to this document",
      icon: <LinkIcon />,
      run: async () => {
        const url = `${window.location.origin}/v/${docSlug}`;
        try {
          await navigator.clipboard.writeText(url);
        } catch {
          // clipboard denied; silent
        }
        close();
      },
    });
  }

  if (!isSettings) {
    actions.push({
      id: "open-settings",
      title: "Open settings",
      icon: <SettingsIcon />,
      run: () => {
        close();
        router.push("/settings");
      },
    });
  }

  if (signOutAction) {
    actions.push({
      id: "sign-out",
      title: "Sign out",
      icon: <SignOutIcon />,
      run: async () => {
        close();
        await signOutAction();
      },
    });
  }

  const q = query.trim().toLowerCase();
  const filteredActions = q
    ? actions.filter((a) => a.title.toLowerCase().includes(q))
    : actions;

  const totalRows = docs.length + filteredActions.length;
  const safeIndex =
    totalRows === 0 ? 0 : Math.min(selectedIndex, totalRows - 1);

  function pick(index: number) {
    if (index < docs.length) {
      const doc = docs[index];
      if (!doc) return;
      close();
      router.push(`/v/${doc.slug}`);
      return;
    }
    const action = filteredActions[index - docs.length];
    if (!action) return;
    void action.run();
  }

  useEffect(() => {
    navRef.current = { totalRows, safeIndex, pick, close };
  });

  useEffect(() => {
    if (!open) return;
    function onKey(e: KeyboardEvent) {
      const { totalRows, safeIndex, pick, close } = navRef.current;
      if (e.key === "Escape") {
        e.preventDefault();
        close();
        return;
      }
      if (e.key === "ArrowDown") {
        e.preventDefault();
        setSelectedIndex((i) =>
          totalRows === 0 ? 0 : Math.min(totalRows - 1, i + 1),
        );
        return;
      }
      if (e.key === "ArrowUp") {
        e.preventDefault();
        setSelectedIndex((i) => Math.max(0, i - 1));
        return;
      }
      if (e.key === "Enter") {
        e.preventDefault();
        pick(safeIndex);
        return;
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);

  if (!open) return null;

  return (
    <div
      className="cmd-palette-backdrop fixed inset-0 z-[60] flex items-start justify-center px-4 pt-[15vh]"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) close();
      }}
      role="presentation"
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Command palette"
        className="cmd-palette flex w-full max-w-[560px] flex-col overflow-hidden rounded-lg border border-border bg-paper shadow-[var(--shadow-soft)]"
      >
        <div className="flex items-center gap-3 border-b border-border px-4 py-3">
          <span className="grid size-4 place-items-center text-muted">
            <SearchIcon />
          </span>
          <input
            ref={inputRef}
            value={query}
            onChange={(e) => {
              setQuery(e.target.value);
              setSelectedIndex(0);
            }}
            placeholder="Search docs, settings, actions…"
            aria-label="Search"
            className="block flex-1 bg-transparent text-base text-ink placeholder:text-muted/70 focus:outline-none"
          />
        </div>
        <div className="max-h-[60vh] overflow-y-auto px-2 py-2">
          {totalRows === 0 ? (
            <div className="px-3 py-6 text-center text-sm text-muted">
              {docsLoading ? "Searching…" : "No results"}
            </div>
          ) : (
            <>
              {docs.length > 0 && (
                <Group label="Documents">
                  {docs.map((d, i) => (
                    <Row
                      key={d.id}
                      selected={safeIndex === i}
                      onMouseEnter={() => setSelectedIndex(i)}
                      onClick={() => pick(i)}
                      icon={<DocIcon />}
                      title={d.title || "Untitled"}
                      meta={d.slug}
                    />
                  ))}
                </Group>
              )}
              {filteredActions.length > 0 && (
                <Group label="Actions">
                  {filteredActions.map((a, i) => {
                    const idx = docs.length + i;
                    return (
                      <Row
                        key={a.id}
                        selected={safeIndex === idx}
                        onMouseEnter={() => setSelectedIndex(idx)}
                        onClick={() => pick(idx)}
                        icon={a.icon}
                        title={a.title}
                        kbd={a.kbd}
                      />
                    );
                  })}
                </Group>
              )}
            </>
          )}
        </div>
        <div className="flex flex-wrap items-center justify-end gap-x-4 gap-y-2 border-t border-border bg-paper-warm px-4 py-2">
          <FooterHint glyphs={["↑", "↓"]} label="navigate" />
          <FooterHint glyphs={["↵"]} label="open" />
          <FooterHint glyphs={["esc"]} label="close" />
        </div>
      </div>
    </div>
  );
}

function Group({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="px-1 pb-1.5 [&+&]:border-t [&+&]:border-border [&+&]:pt-2">
      <div className="px-2 pb-1 pt-1.5 text-[0.625rem] font-semibold uppercase tracking-[0.12em] text-muted">
        {label}
      </div>
      <div className="flex flex-col">{children}</div>
    </div>
  );
}

function Row({
  selected,
  onMouseEnter,
  onClick,
  icon,
  title,
  meta,
  kbd,
}: {
  selected: boolean;
  onMouseEnter: () => void;
  onClick: () => void;
  icon: ReactNode;
  title: string;
  meta?: string;
  kbd?: string[];
}) {
  return (
    <button
      type="button"
      onMouseEnter={onMouseEnter}
      onClick={onClick}
      data-selected={selected ? "true" : undefined}
      className="cmd-palette-row flex w-full items-center gap-3 px-2 py-2 text-left text-sm text-ink"
    >
      <span className="grid size-6 shrink-0 place-items-center text-muted">
        {icon}
      </span>
      <span className="flex-1 truncate">{title}</span>
      {meta && (
        <span className="shrink-0 font-mono text-[0.6875rem] text-muted [font-feature-settings:'tnum']">
          {meta}
        </span>
      )}
      {kbd && (
        <span className="flex shrink-0 items-center gap-1">
          {kbd.map((k, i) => (
            <kbd
              key={i}
              className="rounded-[3px] border border-border px-[5px] py-[1px] font-mono text-[0.6875rem] font-medium text-muted"
            >
              {k}
            </kbd>
          ))}
        </span>
      )}
    </button>
  );
}

function FooterHint({ glyphs, label }: { glyphs: string[]; label: string }) {
  return (
    <span className="flex items-center gap-1.5">
      <span className="flex items-center gap-1">
        {glyphs.map((g, i) => (
          <kbd
            key={i}
            className="rounded-[3px] border border-border px-[5px] py-[1px] font-mono text-[0.6875rem] font-medium text-muted"
          >
            {g}
          </kbd>
        ))}
      </span>
      <span className="text-[0.6875rem] font-semibold uppercase tracking-[0.12em] text-muted">
        {label}
      </span>
    </span>
  );
}

function strokeProps(size: string) {
  return {
    xmlns: "http://www.w3.org/2000/svg",
    viewBox: "0 0 24 24",
    fill: "none" as const,
    stroke: "currentColor",
    strokeWidth: 2,
    strokeLinecap: "round" as const,
    strokeLinejoin: "round" as const,
    className: size,
    "aria-hidden": true,
  };
}

function SearchIcon() {
  return (
    <svg {...strokeProps("size-4")}>
      <circle cx="11" cy="11" r="7" />
      <line x1="21" y1="21" x2="16.65" y2="16.65" />
    </svg>
  );
}

function DocIcon() {
  return (
    <svg {...strokeProps("size-3.5")}>
      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
      <path d="M14 2v6h6" />
      <line x1="8" y1="13" x2="16" y2="13" />
      <line x1="8" y1="17" x2="13" y2="17" />
    </svg>
  );
}

function NewIcon() {
  return (
    <svg {...strokeProps("size-3.5")}>
      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
      <path d="M14 2v6h6" />
      <line x1="12" y1="12" x2="12" y2="18" />
      <line x1="9" y1="15" x2="15" y2="15" />
    </svg>
  );
}

function SettingsIcon() {
  return (
    <svg {...strokeProps("size-3.5")}>
      <circle cx="12" cy="12" r="3" />
      <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 1 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 1 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 1 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 1 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" />
    </svg>
  );
}

function SignOutIcon() {
  return (
    <svg {...strokeProps("size-3.5")}>
      <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
      <polyline points="16 17 21 12 16 7" />
      <line x1="21" y1="12" x2="9" y2="12" />
    </svg>
  );
}

function EditIcon() {
  return (
    <svg {...strokeProps("size-3.5")}>
      <path d="M12 20h9" />
      <path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4z" />
    </svg>
  );
}

function RawIcon() {
  return (
    <svg {...strokeProps("size-3.5")}>
      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
      <path d="M14 2v6h6" />
    </svg>
  );
}

function LinkIcon() {
  return (
    <svg {...strokeProps("size-3.5")}>
      <path d="M10 13a5 5 0 0 0 7.07 0l3-3a5 5 0 1 0-7.07-7.07L11 5" />
      <path d="M14 11a5 5 0 0 0-7.07 0l-3 3a5 5 0 1 0 7.07 7.07L13 19" />
    </svg>
  );
}

function BackIcon() {
  return (
    <svg {...strokeProps("size-3.5")}>
      <line x1="19" y1="12" x2="5" y2="12" />
      <polyline points="12 19 5 12 12 5" />
    </svg>
  );
}
