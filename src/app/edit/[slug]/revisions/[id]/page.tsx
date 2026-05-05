import Link from "next/link";
import { redirect, notFound } from "next/navigation";
import { withAuth } from "@workos-inc/authkit-nextjs";
import { isEmailAllowed } from "@/lib/access";
import { getDocBySlug } from "@/lib/db";
import * as RevisionLog from "@/lib/revision-log";
import { MarkdownRenderer } from "@/components/markdown-renderer";
import { FrontmatterDisclosure } from "@/components/frontmatter-disclosure";
import { parseFrontmatter } from "@/lib/frontmatter";
import { formatSource, shouldShowSourceLabel } from "@/lib/revision-display";
import { RestoreAction } from "@/components/restore-action";

type PageProps = {
  params: Promise<{ slug: string; id: string }>;
};

export const metadata = {
  title: "Revision",
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
  hour: "2-digit",
  minute: "2-digit",
  hour12: false,
});

function formatDate(d: Date): string {
  const now = new Date();
  const fmt =
    d.getFullYear() !== now.getFullYear() ? DATE_FORMAT_PRIOR_YEAR : DATE_FORMAT;
  return fmt.format(d).toUpperCase().replace(",", "");
}

export default async function RevisionDetailPage({ params }: PageProps) {
  const { user } = await withAuth();
  if (!user) redirect("/auth");
  if (!isEmailAllowed(user.email)) redirect("/");

  const { slug, id } = await params;
  const doc = await getDocBySlug(slug);
  if (!doc || doc.ownerId !== user.id) notFound();

  const revision = await RevisionLog.get(doc.id, id);
  if (!revision) {
    return (
      <main className="mx-auto w-full max-w-3xl flex-1 px-4 py-8 sm:px-6 sm:py-12">
        <p className="text-sm text-muted">Revision not found.</p>
        <Link
          href={`/edit/${slug}/revisions`}
          prefetch={false}
          className="mt-4 inline-block font-mono text-[0.6875rem] font-semibold uppercase tracking-[0.12em] text-muted transition-colors hover:text-ochre"
        >
          &larr; All revisions
        </Link>
      </main>
    );
  }
  const { fields: frontmatterFields, body } = parseFrontmatter(revision.content);

  return (
    <main className="mx-auto w-full max-w-3xl flex-1 px-4 py-8 sm:px-6 sm:py-12">
      {/* Header strip — non-sticky context that says "this is historical". */}
      <header className="mb-8 border-b border-border pb-4">
        <Link
          href={`/edit/${slug}/revisions`}
          prefetch={false}
          className="mb-2 inline-block font-mono text-[0.6875rem] font-semibold uppercase tracking-[0.12em] text-muted transition-colors hover:text-ochre"
        >
          &larr; All revisions
        </Link>
        <div className="flex flex-col gap-3">
          {/* Row 1: revision metadata, full width. */}
          <p
            className="flex flex-wrap items-baseline gap-x-3 gap-y-1 font-mono text-[0.6875rem] font-semibold uppercase tracking-[0.12em] text-muted [font-variant-numeric:tabular-nums]"
            title={revision.createdAt.toISOString()}
          >
            <span>Revision</span>
            <span className="normal-case tracking-[0.04em] text-ink">
              {revision.externalId}
            </span>
            <span aria-hidden="true">·</span>
            <span>{formatDate(revision.createdAt)}</span>
            {shouldShowSourceLabel(revision.source) ? (
              <>
                <span aria-hidden="true">·</span>
                <span>{formatSource(revision.source)}</span>
              </>
            ) : null}
          </p>
          {/* Row 2: summary on the left, restore action on the right. */}
          <div className="flex flex-row items-center justify-between gap-4">
            <p className="min-w-0 flex-1 truncate text-[0.9375rem] text-ink">
              {revision.summary ?? (
                <span className="text-muted">(no message)</span>
              )}
            </p>
            <div className="shrink-0">
              <RestoreAction slug={slug} revisionId={revision.externalId} />
            </div>
          </div>
        </div>
      </header>

      <article className="prose prose-neutral max-w-none">
        <FrontmatterDisclosure fields={frontmatterFields} />
        <MarkdownRenderer content={body} />
      </article>
    </main>
  );
}
