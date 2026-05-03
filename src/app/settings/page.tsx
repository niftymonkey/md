import { redirect } from "next/navigation";
import { withAuth } from "@workos-inc/authkit-nextjs";
import { isEmailAllowed } from "@/lib/access";
import { listTokensForOwner } from "@/lib/api-tokens";
import { getUserPreferences } from "@/lib/user-preferences";
import { ReadingSection } from "./_components/reading-section";
import { TokensSection } from "./_components/tokens-section";
import { AccountSection } from "./_components/account-section";
import { SettingsBackNav } from "./_components/settings-back-nav";

export const dynamic = "force-dynamic";

export default async function SettingsPage() {
  const { user } = await withAuth();

  if (!user) {
    redirect("/auth");
  }

  if (!isEmailAllowed(user.email)) {
    redirect("/");
  }

  const [tokens, prefs] = await Promise.all([
    listTokensForOwner(user.id),
    getUserPreferences(user.id),
  ]);

  return (
    <main className="mx-auto w-full max-w-3xl flex-1 px-4 py-8 sm:px-6 sm:py-12">
      <div className="settings">
        <SettingsBackNav />
        <h1 className="settings__h1">Settings</h1>
        <p className="settings__sub">
          Reading preferences, API tokens, and account.
        </p>

        <ReadingSection prefs={prefs} />

        <section className="settings__section">
          <h2 className="settings__section-h">API tokens</h2>
          <p className="settings__section-intro">
            Personal access tokens let scripts and AI agents call the API on your
            behalf. Each token is shown only at creation; we store a hash, not
            the value. Revoke a token to invalidate it immediately.
          </p>
          <TokensSection
            initialTokens={tokens.map((t) => ({
              id: t.id,
              name: t.name,
              prefix: t.prefix,
              createdAt: t.createdAt.toISOString(),
              lastUsedAt: t.lastUsedAt ? t.lastUsedAt.toISOString() : null,
            }))}
          />
        </section>

        <AccountSection email={user.email} />
      </div>
    </main>
  );
}
