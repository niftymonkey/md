import Link from "next/link";
import { redirect, notFound } from "next/navigation";
import { withAuth } from "@workos-inc/authkit-nextjs";
import { isEmailAllowed } from "@/lib/access";
import { getDocBySlug } from "@/lib/db";
import * as RevisionLog from "@/lib/revision-log";

type PageProps = {
  params: Promise<{ slug: string }>;
};

export const metadata = {
  title: "Revisions",
  robots: { index: false, follow: false },
};

const DATE_FORMAT = new Intl.DateTimeFormat("en-US", {
  month: "short",
  day: "numeric",
  hour: "2-digit",
  minute: "2-digit",
  hour12: false,
});

const DATE_FORMAT_PRIOR_YEAR = new Intl.DateTimeFormat("en-US", {
  month: "short",
  day: "numeric",
  year: "numeric",
});

function formatDate(d: Date): string {
  const now = new Date();
  if (d.getFullYear() !== now.getFullYear()) {
    return DATE_FORMAT_PRIOR_YEAR.format(d).toUpperCase();
  }
  return DATE_FORMAT.format(d).toUpperCase().replace(",", "");
}

function formatBytes(added: number, removed: number): string | null {
  if (added === 0 && removed === 0) return null;
  return `+${added} −${removed}`;
}

const NO_MESSAGE = (
  <span className="text-muted">(no message)</span>
);

export default async function RevisionsListPage({ params }: PageProps) {
  const { user } = await withAuth();
  if (!user) redirect("/auth");
  if (!isEmailAllowed(user.email)) redirect("/");

  const { slug } = await params;
  const doc = await getDocBySlug(slug);
  if (!doc || doc.ownerId !== user.id) notFound();

  // Retention caps revisions at 50, and the architecture doc treats history
  // as bounded — request the full retention window so the surface never
  // hides revisions behind a Show-more button.
  const { revisions } = await RevisionLog.list(doc.id, { limit: 50 });

  return (
    <main className="mx-auto w-full max-w-3xl flex-1 px-4 py-8 sm:px-6 sm:py-12">
      <header className="mb-6 flex flex-col gap-1">
        <span className="font-mono text-[0.6875rem] font-semibold uppercase tracking-[0.12em] text-muted">
          Revisions
        </span>
        <h1 className="text-2xl font-bold leading-tight tracking-tight text-ink sm:text-3xl">
          {doc.title}
        </h1>
        <Link
          href={`/edit/${slug}`}
          prefetch={false}
          className="mt-2 self-start font-mono text-[0.6875rem] font-semibold uppercase tracking-[0.12em] text-muted transition-colors hover:text-ochre"
        >
          &larr; Back to edit
        </Link>
      </header>

      {revisions.length === 0 ? (
        <p className="mt-12 text-sm text-muted">
          No revisions yet. Edits to this document will appear here.
        </p>
      ) : (
        <ul className="flex flex-col gap-1.5">
          {revisions.map((rev) => {
            const bytes = formatBytes(rev.bytesAdded, rev.bytesRemoved);
            const dateLabel = formatDate(rev.createdAt);
            const summary = rev.summary ? rev.summary : NO_MESSAGE;
            return (
              <li
                key={rev.externalId}
                className="rounded-sm border border-border bg-paper-warm"
              >
                <Link
                  href={`/edit/${slug}/revisions/${rev.externalId}`}
                  prefetch={false}
                  className="group block px-3.5 py-2.5"
                >
                  {/* Mobile: stacked. Summary on line 1, meta on line 2. */}
                  <div className="sm:hidden">
                    <p className="truncate text-[0.9375rem] font-semibold text-ink transition-colors group-hover:text-ochre">
                      {summary}
                    </p>
                    <p className="mt-1 flex flex-wrap items-center gap-x-2 font-mono text-[0.6875rem] font-semibold uppercase tracking-[0.08em] text-muted [font-variant-numeric:tabular-nums]">
                      <span title={rev.createdAt.toISOString()}>{dateLabel}</span>
                      <span aria-hidden="true">·</span>
                      <span className="tracking-[0.12em]">{rev.source}</span>
                      {bytes ? (
                        <>
                          <span aria-hidden="true">·</span>
                          <span>{bytes}</span>
                        </>
                      ) : null}
                    </p>
                  </div>
                  {/* Desktop: single dense line. */}
                  <div className="hidden sm:grid sm:grid-cols-[7rem_1fr_5rem_auto] sm:items-center sm:gap-4">
                    <span
                      className="font-mono text-[0.6875rem] font-semibold uppercase tracking-[0.08em] text-muted [font-variant-numeric:tabular-nums]"
                      title={rev.createdAt.toISOString()}
                    >
                      {dateLabel}
                    </span>
                    <span className="min-w-0 truncate text-[0.9375rem] font-semibold text-ink transition-colors group-hover:text-ochre">
                      {summary}
                    </span>
                    <span className="font-mono text-[0.6875rem] font-semibold uppercase tracking-[0.12em] text-muted">
                      {rev.source}
                    </span>
                    <span className="min-w-[5rem] text-right font-mono text-[0.6875rem] text-muted [font-variant-numeric:tabular-nums]">
                      {bytes ?? ""}
                    </span>
                  </div>
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </main>
  );
}
