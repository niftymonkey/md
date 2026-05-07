import Link from "next/link";
import { listDocs } from "@/lib/db";
import * as RevisionLog from "@/lib/revision-log";
import { DeleteButton } from "@/components/delete-button";
import { EditLink } from "@/components/edit-link";
import { HistoryLink } from "@/components/history-link";
import { RowKebabMenu } from "@/components/row-kebab-menu";
import { TagBadge } from "@/components/tag-badge";

const DATE_FORMAT = new Intl.DateTimeFormat("en-US", {
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
});

const TOOLTIP_DATE_FORMAT = new Intl.DateTimeFormat("en-US", {
  month: "short",
  day: "numeric",
  year: "numeric",
  hour: "2-digit",
  minute: "2-digit",
  hour12: false,
});

export async function DocList({
  ownerId,
  tags,
}: {
  ownerId: string;
  tags?: string[];
}) {
  const filter = tags && tags.length > 0 ? tags : undefined;
  const { docs } = await listDocs({ ownerId, limit: 20, tags: filter });

  if (docs.length === 0) {
    if (filter) {
      return (
        <p className="text-sm text-muted">
          No documents tagged{" "}
          <span className="font-mono text-ink">{filter.join(", ")}</span>.
        </p>
      );
    }
    return (
      <p className="text-sm text-muted">
        No uploads yet. Drop a markdown file or paste above to get started.
      </p>
    );
  }

  const revisionCounts = await RevisionLog.countByDoc(docs.map((d) => d.id));

  return (
    <ul className="flex flex-col gap-1.5">
      {docs.map((doc) => (
        <li
          key={doc.id}
          className="rounded-sm border border-border bg-paper-warm px-3.5 py-2.5"
        >
          <div className="grid grid-cols-[1fr_auto_auto] items-center gap-3">
            <Link
              href={`/v/${doc.slug}`}
              className="min-w-0 truncate text-[0.9375rem] font-semibold text-ink transition-colors hover:text-ochre"
              prefetch={false}
            >
              {doc.title}
            </Link>
            <span
              className="font-mono text-xs text-muted [font-variant-numeric:tabular-nums]"
              title={`Last updated ${TOOLTIP_DATE_FORMAT.format(doc.updatedAt).toUpperCase().replace(",", "")}`}
            >
              {DATE_FORMAT.format(doc.updatedAt)}
            </span>
            <span className="hidden items-center gap-1 md:flex">
              <HistoryLink
                slug={doc.slug}
                title={doc.title}
                revisionCount={revisionCounts[doc.id] ?? 0}
              />
              <EditLink slug={doc.slug} title={doc.title} />
              <DeleteButton slug={doc.slug} title={doc.title} />
            </span>
            <RowKebabMenu slug={doc.slug} title={doc.title} />
          </div>
          {doc.tags.length > 0 && (
            <div className="mt-1.5 flex flex-wrap items-center gap-1 pl-px">
              {doc.tags.map((tag) => (
                <Link
                  key={tag}
                  href={`/?tags=${encodeURIComponent(tag)}`}
                  prefetch={false}
                  scroll={false}
                  className="inline-flex"
                  aria-label={`Filter by tag ${tag}`}
                >
                  <TagBadge name={tag} size="sm" className="cursor-pointer" />
                </Link>
              ))}
            </div>
          )}
        </li>
      ))}
    </ul>
  );
}
