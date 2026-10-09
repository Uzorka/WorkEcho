import { randomInt } from "node:crypto";

// Work-email verification helpers (pure; unit-tested). The email itself is
// never stored or logged: it's only used to check the domain and send a code.

// Must match public.is_free_email_domain() in the database.
export const FREE_EMAIL_DOMAINS = new Set([
  "gmail.com", "googlemail.com", "yahoo.com", "yahoo.co.uk", "ymail.com", "rocketmail.com",
  "outlook.com", "hotmail.com", "hotmail.co.uk", "live.com", "msn.com", "icloud.com", "me.com",
  "mac.com", "aol.com", "protonmail.com", "proton.me", "mail.com", "gmx.com", "gmx.net",
  "yandex.com", "zoho.com", "zohomail.com", "tutanota.com", "fastmail.com", "hey.com", "qq.com",
  "163.com", "inbox.com",
]);

export const DOMAIN_PATTERN = /^[a-z0-9]([a-z0-9-]*[a-z0-9])?(\.[a-z0-9]([a-z0-9-]*[a-z0-9])?)+$/;
export const VERIFICATION_VALID_MONTHS = 12;
export const RENEWAL_WINDOW_DAYS = 30;
export const CODE_TTL_MINUTES = 15;
export const MAX_CODE_ATTEMPTS = 5;
export const MAX_SENDS_PER_DAY = 3;

export function emailDomain(email: string): string {
  return email.trim().toLowerCase().split("@").pop() ?? "";
}

export function isFreeEmailDomain(domain: string): boolean {
  return FREE_EMAIL_DOMAINS.has(domain.toLowerCase());
}

/** The company's domain itself, or a subdomain of it (mail.chfheron.com matches chfheron.com). */
export function domainMatches(domain: string, companyDomains: string[]): boolean {
  const d = domain.toLowerCase();
  return companyDomains.some((c) => d === c || d.endsWith(`.${c}`));
}

/** "adaeze@chfheron.com" -> "a•••@chfheron.com" (shown back to the user only). */
export function maskEmail(email: string): string {
  const [local, domain] = email.trim().split("@");
  return `${(local ?? "").slice(0, 1)}•••@${domain ?? ""}`;
}

/** A uniformly random 6-digit code, from a cryptographic source. */
export function generateCode(): string {
  return String(randomInt(0, 1_000_000)).padStart(6, "0");
}

/** Admin input like "chfheron.com, @chf.ng" -> ["chfheron.com", "chf.ng"], or an error message. */
export function parseEmailDomains(input: string): { domains: string[] } | { error: string } {
  const domains = [...new Set(input.split(/[\s,;]+/).map((d) => d.trim().toLowerCase().replace(/^@/, "")).filter(Boolean))];
  if (domains.length > 10) return { error: "Add at most 10 email domains." };
  for (const d of domains) {
    if (!DOMAIN_PATTERN.test(d)) return { error: `"${d}" doesn't look like an email domain (e.g. chfheron.com).` };
    if (isFreeEmailDomain(d)) return { error: `"${d}" is a free email provider, not a company domain.` };
  }
  return { domains };
}

/** Effective state of a verification row (the stored status may lag behind expiry). */
export function verificationState(v: { status: string; expires_at: string }, now = Date.now()) {
  if (v.status === "revoked") return "revoked" as const;
  if (Date.parse(v.expires_at) <= now) return "expired" as const;
  if (Date.parse(v.expires_at) - now <= RENEWAL_WINDOW_DAYS * 86_400_000) return "expiring" as const;
  return "active" as const;
}
