/**
 * Masks the local part of an email so screenshots, support sessions, and
 * shoulder-surfers don't reveal the full address. Keeps the first character
 * and the full domain; replaces the remaining local-part chars with `*`.
 */
export function maskEmail(email: string): string {
  const at = email.indexOf("@");
  if (at <= 0) return email;
  const local = email.slice(0, at);
  const domain = email.slice(at);
  return local[0] + "*".repeat(local.length - 1) + domain;
}
