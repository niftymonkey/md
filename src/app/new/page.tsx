import { redirect } from "next/navigation";
import { withAuth } from "@workos-inc/authkit-nextjs";
import { isEmailAllowed } from "@/lib/access";
import { UploadForm } from "@/components/upload-form";

export const metadata = {
  title: "New document",
  robots: { index: false, follow: false },
};

export default async function NewDocPage() {
  const { user } = await withAuth();

  if (!user) redirect("/auth");
  if (!isEmailAllowed(user.email)) redirect("/");

  return (
    <main className="mx-auto w-full max-w-3xl flex-1 px-4 py-8 sm:px-6 sm:py-12">
      <UploadForm />
    </main>
  );
}
