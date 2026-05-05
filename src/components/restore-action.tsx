"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { RestoreButton } from "./restore-button";

type Props = {
  slug: string;
  revisionId: string;
};

export function RestoreAction({ slug, revisionId }: Props) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onConfirm() {
    if (busy) return;
    setBusy(true);
    setError(null);
    try {
      const response = await fetch(`/api/docs/${slug}/restore`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ revisionId }),
      });
      if (!response.ok) {
        let message = "Try again.";
        try {
          const data = (await response.json()) as { error?: string };
          if (data?.error) message = data.error;
        } catch {
          // ignore parse failure
        }
        setError(message);
        return;
      }
      router.push(`/edit/${slug}`);
    } catch {
      setError("Try again.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex flex-col items-end gap-2">
      <RestoreButton onConfirm={onConfirm} disabled={busy} />
      {error ? (
        <p
          role="alert"
          className="flex items-baseline gap-x-2 text-sm text-ink"
        >
          <span className="font-mono text-[0.6875rem] font-semibold uppercase tracking-[0.12em] text-ochre">
            Restore failed
          </span>
          <span>{error}</span>
        </p>
      ) : null}
    </div>
  );
}
