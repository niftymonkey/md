import Link from "next/link";
import { listDocs } from "@/lib/db";

const DATE_FORMAT = new Intl.DateTimeFormat("en-US", {
  year: "numeric",
  month: "short",
  day: "numeric",
});

export async function DocList({ ownerId }: { ownerId: string }) {
  const { docs } = await listDocs({ ownerId, limit: 20 });

  if (docs.length === 0) {
    return (
      <p className="text-sm text-zinc-500 dark:text-zinc-500">
        No uploads yet. Drop a markdown file or paste above to get started.
      </p>
    );
  }

  return (
    <ul className="divide-y divide-zinc-200 rounded-md border border-zinc-200 bg-white dark:divide-zinc-800 dark:border-zinc-800 dark:bg-zinc-900">
      {docs.map((doc) => (
        <li key={doc.id} className="flex items-center justify-between gap-3 px-4 py-3">
          <div className="min-w-0 flex-1">
            <Link
              href={`/v/${doc.slug}`}
              className="block truncate text-sm font-medium hover:underline"
              prefetch={false}
            >
              {doc.title}
            </Link>
            <p className="text-xs text-zinc-500 dark:text-zinc-500">
              {DATE_FORMAT.format(doc.createdAt)} · /v/{doc.slug}
            </p>
          </div>
        </li>
      ))}
    </ul>
  );
}
