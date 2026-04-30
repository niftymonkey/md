"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";

const RELATIVE_DIVISIONS: Array<{ unit: Intl.RelativeTimeFormatUnit; ms: number }> = [
  { unit: "year", ms: 365 * 24 * 60 * 60 * 1000 },
  { unit: "month", ms: 30 * 24 * 60 * 60 * 1000 },
  { unit: "day", ms: 24 * 60 * 60 * 1000 },
  { unit: "hour", ms: 60 * 60 * 1000 },
  { unit: "minute", ms: 60 * 1000 },
  { unit: "second", ms: 1000 },
];

const RELATIVE_FORMATTER = new Intl.RelativeTimeFormat("en-US", {
  numeric: "auto",
});

function relativeTime(iso: string | null): string {
  if (!iso) return "never";
  const target = new Date(iso).getTime();
  if (Number.isNaN(target)) return "—";
  const delta = target - Date.now();
  if (Math.abs(delta) < 30 * 1000) return "just now";
  for (const { unit, ms } of RELATIVE_DIVISIONS) {
    if (Math.abs(delta) >= ms || unit === "second") {
      return RELATIVE_FORMATTER.format(Math.round(delta / ms), unit);
    }
  }
  return "just now";
}

type TokenRow = {
  id: string;
  name: string;
  prefix: string;
  createdAt: string;
  lastUsedAt: string | null;
};

type CreatedToken = {
  id: string;
  name: string;
  prefix: string;
  plaintext: string;
  createdAt: string;
};

export function TokensSection({
  initialTokens,
}: {
  initialTokens: TokenRow[];
}) {
  const [tokens, setTokens] = useState<TokenRow[]>(initialTokens);
  const [modalOpen, setModalOpen] = useState(false);
  const [created, setCreated] = useState<CreatedToken | null>(null);
  const [revokingId, setRevokingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();
  const [, startTransition] = useTransition();

  function closeModal() {
    setModalOpen(false);
    setCreated(null);
    setError(null);
  }

  function onCreated(token: CreatedToken) {
    setCreated(token);
    setTokens((prev) => [
      {
        id: token.id,
        name: token.name,
        prefix: token.prefix,
        createdAt: token.createdAt,
        lastUsedAt: null,
      },
      ...prev,
    ]);
    startTransition(() => router.refresh());
  }

  async function revoke(id: string, name: string) {
    if (revokingId) return;
    if (!window.confirm(`Revoke "${name}"? This cannot be undone.`)) return;
    setRevokingId(id);
    setError(null);
    try {
      const res = await fetch(`/api/tokens/${id}`, { method: "DELETE" });
      if (!res.ok) {
        let message = `Revoke failed (${res.status})`;
        try {
          const data = await res.json();
          if (data?.error) message = data.error;
        } catch {}
        setError(message);
        return;
      }
      setTokens((prev) => prev.filter((t) => t.id !== id));
      startTransition(() => router.refresh());
    } catch {
      setError("Network error");
    } finally {
      setRevokingId(null);
    }
  }

  return (
    <>
      {tokens.length === 0 ? (
        <p className="settings__empty">
          No tokens yet. Create one to start uploading via the API.
        </p>
      ) : (
        <table className="token-table">
          <thead>
            <tr>
              <th>Name</th>
              <th>ID</th>
              <th>Last used</th>
              <th aria-label="actions" />
            </tr>
          </thead>
          <tbody>
            {tokens.map((t) => (
              <tr key={t.id}>
                <td className="token-table__name">{t.name}</td>
                <td className="token-table__id">{t.prefix}…</td>
                <td className="token-table__last-used">
                  {relativeTime(t.lastUsedAt)}
                </td>
                <td className="token-table__actions">
                  <button
                    type="button"
                    onClick={() => revoke(t.id, t.name)}
                    disabled={revokingId === t.id}
                    className="token-table__revoke"
                  >
                    {revokingId === t.id ? "revoking…" : "revoke"}
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}

      {error && (
        <p className="settings__error" role="alert">
          {error}
        </p>
      )}

      <button
        type="button"
        onClick={() => {
          setModalOpen(true);
          setCreated(null);
          setError(null);
        }}
        className="settings__create-btn"
      >
        Create new token
      </button>

      {modalOpen && (
        <CreateTokenModal
          onClose={closeModal}
          onCreated={onCreated}
          created={created}
        />
      )}
    </>
  );
}

function CreateTokenModal({
  onClose,
  onCreated,
  created,
}: {
  onClose: () => void;
  onCreated: (t: CreatedToken) => void;
  created: CreatedToken | null;
}) {
  const [name, setName] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  useEffect(() => {
    if (!created) inputRef.current?.focus();
  }, [created]);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (submitting) return;
    const trimmed = name.trim();
    if (!trimmed) {
      setError("Name is required");
      return;
    }
    setSubmitting(true);
    setError(null);
    try {
      const res = await fetch("/api/tokens", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ name: trimmed }),
      });
      if (!res.ok) {
        let message = `Create failed (${res.status})`;
        try {
          const data = await res.json();
          if (data?.error) message = data.error;
        } catch {}
        setError(message);
        return;
      }
      const data = (await res.json()) as CreatedToken;
      onCreated(data);
    } catch {
      setError("Network error");
    } finally {
      setSubmitting(false);
    }
  }

  async function copy() {
    if (!created) return;
    try {
      await navigator.clipboard.writeText(created.plaintext);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1500);
    } catch {
      // clipboard denied; user can select manually
    }
  }

  return (
    <div
      className="modal-backdrop"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget && !created) onClose();
      }}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="create-token-title"
        className="modal"
      >
        {!created ? (
          <form onSubmit={submit} className="modal__form">
            <h3 id="create-token-title" className="modal__title">
              Create new token
            </h3>
            <p className="modal__desc">
              Give the token a name so you can recognize it later (e.g.{" "}
              <code>claude-laptop</code>, <code>browser-extension</code>).
            </p>
            <label className="modal__label">
              <span>Name</span>
              <input
                ref={inputRef}
                type="text"
                value={name}
                onChange={(e) => {
                  setName(e.target.value);
                  if (error) setError(null);
                }}
                maxLength={64}
                placeholder="claude-laptop"
                className="modal__input"
                autoComplete="off"
                spellCheck={false}
              />
            </label>
            {error && (
              <p className="modal__error" role="alert">
                {error}
              </p>
            )}
            <div className="modal__actions">
              <button
                type="button"
                onClick={onClose}
                className="modal__btn modal__btn--ghost"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={submitting || !name.trim()}
                className="modal__btn modal__btn--primary"
              >
                {submitting ? "Creating…" : "Create"}
              </button>
            </div>
          </form>
        ) : (
          <div className="modal__form">
            <h3 id="create-token-title" className="modal__title">
              Token created
            </h3>
            <p className="modal__desc">
              Copy the value below and store it somewhere safe. You won&apos;t
              see it again — if you lose it, revoke and create a new one.
            </p>
            <div className="modal__token">
              <code className="modal__token-value">{created.plaintext}</code>
              <button
                type="button"
                onClick={copy}
                className="modal__btn modal__btn--ghost"
              >
                {copied ? "copied" : "copy"}
              </button>
            </div>
            <div className="modal__actions">
              <button
                type="button"
                onClick={onClose}
                className="modal__btn modal__btn--primary"
              >
                Done
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
