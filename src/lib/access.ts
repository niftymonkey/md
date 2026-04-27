const ALLOWED_EMAILS_ENV = process.env.ALLOWED_EMAILS ?? "";

function getAllowedEmails(): Set<string> {
  if (!ALLOWED_EMAILS_ENV) {
    return new Set();
  }

  return new Set(
    ALLOWED_EMAILS_ENV.split(",")
      .map((email) => email.trim().toLowerCase())
      .filter((email) => email.length > 0),
  );
}

const allowedEmails = getAllowedEmails();

export function isEmailAllowed(email: string | undefined | null): boolean {
  if (!email) {
    return false;
  }

  if (allowedEmails.size === 0) {
    return false;
  }

  return allowedEmails.has(email.toLowerCase());
}
