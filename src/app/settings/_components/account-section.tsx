import { signOutAction } from "@/lib/auth-actions";
import { maskEmail } from "@/lib/mask-email";

export function AccountSection({ email }: { email: string }) {
  return (
    <section className="settings__section">
      <h2 className="settings__section-h">Account</h2>

      <div className="settings__row">
        <div className="settings__row-label">
          <div className="settings__row-title">Signed in as</div>
          <div className="settings__row-help font-mono">{maskEmail(email)}</div>
        </div>
        <form action={signOutAction}>
          <button type="submit" className="settings__sign-out">
            Sign out
          </button>
        </form>
      </div>
    </section>
  );
}
