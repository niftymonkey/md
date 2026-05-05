import Link from "next/link";

export function EditLink({ slug, title }: { slug: string; title: string }) {
  return (
    <Link
      href={`/edit/${slug}`}
      aria-label={`Edit ${title}`}
      title="Edit"
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
        <path d="M12 20h9" />
        <path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4Z" />
      </svg>
    </Link>
  );
}
