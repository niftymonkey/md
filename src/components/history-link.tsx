import Link from "next/link";

export function HistoryLink({ slug, title }: { slug: string; title: string }) {
  return (
    <Link
      href={`/edit/${slug}/revisions`}
      aria-label={`History for ${title}`}
      prefetch={false}
      className="cursor-pointer rounded p-1 text-muted transition-colors hover:bg-paper hover:text-ochre"
    >
      <svg
        xmlns="http://www.w3.org/2000/svg"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        className="h-4 w-4"
        aria-hidden="true"
      >
        <path d="M3 12a9 9 0 1 0 3-6.7L3 8" />
        <path d="M3 3v5h5" />
        <path d="M12 7v5l3 2" />
      </svg>
    </Link>
  );
}
