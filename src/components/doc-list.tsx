import Link from "next/link";
import { listDocs } from "@/lib/db";
import { DeleteButton } from "@/components/delete-button";
import { EditLink } from "@/components/edit-link";

const DATE_FORMAT = new Intl.DateTimeFormat("en-US", {
  year: "numeric",
  month: "short",
  day: "numeric",
});

export async function DocList({ ownerId }: { ownerId: string }) {
  const { docs } = await listDocs({ ownerId, limit: 20 });

  if (docs.length === 0) {
    return (
      <p className="text-sm text-muted">
        No uploads yet. Drop a markdown file or paste above to get started.
      </p>
    );
  }

  return (
    <ul className="flex flex-col gap-1.5">
      {docs.map((doc) => (
        <li
          key={doc.id}
          className="grid grid-cols-[1fr_auto_auto] items-center gap-3 rounded-sm border border-border bg-paper-warm px-3.5 py-2.5"
        >
          <Link
            href={`/v/${doc.slug}`}
            className="min-w-0 truncate text-[0.9375rem] font-semibold text-ink transition-colors hover:text-ochre"
            prefetch={false}
          >
            {doc.title}
          </Link>
          <span className="font-mono text-xs text-muted [font-variant-numeric:tabular-nums]">
            {DATE_FORMAT.format(doc.createdAt)}
          </span>
          <span className="flex items-center gap-1">
            <EditLink slug={doc.slug} title={doc.title} />
            <DeleteButton slug={doc.slug} title={doc.title} />
          </span>
        </li>
      ))}
    </ul>
  );
}
