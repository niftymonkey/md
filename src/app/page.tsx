import { redirect } from "next/navigation";
import { withAuth, signOut } from "@workos-inc/authkit-nextjs";
import { isEmailAllowed } from "@/lib/access";
import { UploadForm } from "@/components/upload-form";
import { DocList } from "@/components/doc-list";

async function signOutAction() {
  "use server";
  await signOut();
}

export default async function Home() {
  const { user } = await withAuth();

  if (!user) {
    redirect("/auth");
  }

  if (!isEmailAllowed(user.email)) {
    return (
      <main className="flex flex-1 items-center justify-center px-6 py-16">
        <div className="w-full max-w-md space-y-6 text-center">
          <h1 className="text-2xl font-semibold tracking-tight">Not authorized</h1>
          <p className="text-sm text-muted">
            <span className="font-mono">{user.email}</span> is not on the allow list.
          </p>
          <form action={signOutAction}>
            <button
              type="submit"
              className="cursor-pointer rounded-md border border-border px-4 py-2 text-sm font-medium hover:bg-paper-warm"
            >
              Sign out
            </button>
          </form>
        </div>
      </main>
    );
  }

  return (
    <main className="mx-auto w-full max-w-3xl flex-1 px-4 py-8 sm:px-6 sm:py-12">
      <section className="mb-10">
        <UploadForm signOutAction={signOutAction} />
      </section>
      <section className="space-y-3">
        <h2 className="text-[0.6875rem] font-semibold uppercase tracking-[0.12em] text-muted">
          Recent uploads
        </h2>
        <DocList ownerId={user.id} />
      </section>
    </main>
  );
}
