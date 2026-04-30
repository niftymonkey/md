import { redirect, notFound } from "next/navigation";
import { withAuth, signOut } from "@workos-inc/authkit-nextjs";
import { isEmailAllowed } from "@/lib/access";
import { getDocBySlug } from "@/lib/db";
import { EditForm } from "@/components/edit-form";

async function signOutAction() {
  "use server";
  await signOut();
}

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
    <main className="mx-auto w-full max-w-3xl flex-1 px-4 py-8 sm:px-6 sm:py-12">
      <EditForm
        slug={doc.slug}
        initialContent={doc.content}
        initialTitle={doc.title}
        initialKind={doc.kind}
        signOutAction={signOutAction}
      />
    </main>
  );
}
