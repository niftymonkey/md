import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { withAuth } from "@workos-inc/authkit-nextjs";
import { isEmailAllowed } from "@/lib/access";
import { getDocBySlug } from "@/lib/db";
import { MarkdownRenderer } from "@/components/markdown-renderer";
import { ReaderShell } from "@/components/reader-shell";
import { parseHeadings } from "@/lib/heading-utils";

type PageProps = {
  params: Promise<{ slug: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
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

export default async function ViewPage({ params, searchParams }: PageProps) {
  const { slug } = await params;
  const search = await searchParams;
  if (search.raw === "1") redirect(`/api/raw/${slug}`);

  const doc = await getDocBySlug(slug);
  if (!doc) notFound();

  const headings = parseHeadings(doc.content);
  const hasOutline = headings.filter((h) => h.level === 2).length >= 3;

  const { user } = await withAuth();
  const isAuthed = !!user && isEmailAllowed(user.email);

  return (
    <ReaderShell
      slug={doc.slug}
      rawHref={`/api/raw/${doc.slug}`}
      hasOutline={hasOutline}
      headings={headings}
      isAuthed={isAuthed}
    >
      <MarkdownRenderer content={doc.content} />
    </ReaderShell>
  );
}
