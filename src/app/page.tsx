import Link from "next/link";
import { redirect } from "next/navigation";
import { withAuth, signOut } from "@workos-inc/authkit-nextjs";
import { isEmailAllowed } from "@/lib/access";
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
      <div className="mb-6 flex items-center gap-3">
        <span className="inline-flex items-center gap-2 font-mono text-[0.6875rem] font-medium tracking-[0.04em] text-muted">
          press
          <span className="inline-flex gap-1">
            <span data-key-mac className="inline-flex gap-1">
              <kbd className="rounded-[3px] border border-border bg-paper-warm px-[5px] py-[1px] font-mono text-[0.6875rem] font-medium text-ink">
                ⌘
              </kbd>
              <kbd className="rounded-[3px] border border-border bg-paper-warm px-[5px] py-[1px] font-mono text-[0.6875rem] font-medium text-ink">
                K
              </kbd>
            </span>
            <span data-key-other className="inline-flex gap-1">
              <kbd className="rounded-[3px] border border-border bg-paper-warm px-[5px] py-[1px] font-mono text-[0.6875rem] font-medium text-ink">
                Ctrl
              </kbd>
              <kbd className="rounded-[3px] border border-border bg-paper-warm px-[5px] py-[1px] font-mono text-[0.6875rem] font-medium text-ink">
                K
              </kbd>
            </span>
          </span>
          to navigate
        </span>
        <Link
          href="/new"
          className="ml-auto inline-flex items-center gap-2 rounded-md bg-ink px-4 py-2 text-sm font-semibold text-paper transition-colors hover:bg-ochre-deep"
        >
          <svg
            xmlns="http://www.w3.org/2000/svg"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            className="size-3.5"
            aria-hidden="true"
          >
            <line x1="12" y1="5" x2="12" y2="19" />
            <line x1="5" y1="12" x2="19" y2="12" />
          </svg>
          New document
        </Link>
      </div>
      <DocList ownerId={user.id} />
    </main>
  );
}
