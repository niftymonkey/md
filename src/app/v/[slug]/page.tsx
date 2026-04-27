import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { getDocBySlug } from "@/lib/db";
import { MarkdownRenderer } from "@/components/markdown-renderer";

type PageProps = {
  params: Promise<{ slug: string }>;
};

function buildDescription(searchText: string | null): string | undefined {
  if (!searchText) return undefined;
  const trimmed = searchText.trim();
  if (!trimmed) return undefined;
  if (trimmed.length <= 160) return trimmed;
  return trimmed.slice(0, 157) + "…";
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { slug } = await params;
  const doc = await getDocBySlug(slug);
  if (!doc) {
    return { title: "Not found", robots: { index: false, follow: false } };
  }
  const description = buildDescription(doc.searchText);
  return {
    title: doc.title,
    description,
    robots: { index: false, follow: false },
    openGraph: {
      title: doc.title,
      description,
      type: "article",
      siteName: "md",
    },
    twitter: {
      card: "summary",
      title: doc.title,
      description,
    },
  };
}

export default async function ViewPage({ params }: PageProps) {
  const { slug } = await params;
  const doc = await getDocBySlug(slug);
  if (!doc) notFound();

  return (
    <main className="mx-auto w-full max-w-3xl px-6 py-10">
      <article className="prose prose-zinc dark:prose-invert max-w-none prose-pre:bg-transparent prose-pre:p-0">
        <MarkdownRenderer content={doc.content} />
      </article>
      <footer className="mt-16 border-t border-zinc-200 pt-6 text-xs text-zinc-500 dark:border-zinc-800 dark:text-zinc-500">
        <Link href="/" className="hover:underline">
          md.niftymonkey.dev
        </Link>
      </footer>
    </main>
  );
}
