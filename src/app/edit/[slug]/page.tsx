import { redirect } from "next/navigation";
import { notFound } from "next/navigation";
import { withAuth } from "@workos-inc/authkit-nextjs";
import { isEmailAllowed } from "@/lib/access";
import { getDocBySlug } from "@/lib/db";
import { EditForm } from "@/components/edit-form";
import { SiteHeader } from "@/components/site-header";

type PageProps = {
  params: Promise<{ slug: string }>;
};

export const metadata = {
  title: "Edit",
  robots: { index: false, follow: false },
};

export default async function EditPage({ params }: PageProps) {
  const { user } = await withAuth();
  if (!user) redirect("/auth");
  if (!isEmailAllowed(user.email)) redirect("/");

  const { slug } = await params;
  const doc = await getDocBySlug(slug);
  if (!doc || doc.ownerId !== user.id) notFound();

  return (
    <>
      <SiteHeader />
      <main className="mx-auto w-full max-w-3xl flex-1 px-4 py-8 sm:px-6 sm:py-12">
        <header className="mb-8">
          <h1 className="text-2xl font-semibold tracking-tight">Edit</h1>
          <p className="mt-1 text-xs text-zinc-500 dark:text-zinc-500">
            /v/{doc.slug}
          </p>
        </header>
        <EditForm
          slug={doc.slug}
          initialContent={doc.content}
          initialTitle={doc.title}
          initialKind={doc.kind}
        />
      </main>
    </>
  );
}
