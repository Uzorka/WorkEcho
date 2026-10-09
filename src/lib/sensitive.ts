// Spots details that can identify someone: emails, Nigerian phone numbers,
// staff-ID-like codes and long digit strings (account numbers, BVN, NIN...).
// Emails and phone numbers are BLOCKED (here and by a CHECK constraint in the
// database); the others only trigger a warning. Not perfect, and we say so.

export type SensitiveKind = "email" | "phone" | "staff_id" | "long_number";
export type SensitiveMatch = { kind: SensitiveKind; text: string; start: number; end: number };

export const SENSITIVE_LABELS: Record<SensitiveKind, string> = {
  email: "Email address",
  phone: "Phone number",
  staff_id: "Looks like a staff ID",
  long_number: "Long number (account number, BVN or ID?)",
};

export const BLOCKED_KINDS: SensitiveKind[] = ["email", "phone"];

const PATTERNS: { kind: SensitiveKind; re: RegExp }[] = [
  { kind: "email", re: /[^\s@]+@[^\s@]+\.[a-z]{2,}/gi },
  // +234 or 0, then 10 digits; spaces, dots and dashes between digits allowed.
  // Mirrors public.has_contact_details() in the database.
  { kind: "phone", re: /(?:\+?234|(?<!\d[\s.-]*)0)(?:[\s.-]*\d){10}(?![\s.-]*\d)/g },
  { kind: "staff_id", re: /\b(?:staff|employee|emp|personnel|payroll)\s*(?:id|no\.?|number|#)?\s*[:#-]?\s*[A-Z]*\d[A-Z0-9/-]{2,}/gi },
  { kind: "staff_id", re: /\b[A-Z]{2,5}[-/]\d{3,}(?:[-/]\d+)*\b/g },
  // 7+ digits in a row, but not money (₦ / N / commas) or part of a decimal.
  { kind: "long_number", re: /(?<![₦\d,.]|\bN)\d{7,}(?![\d,]|\.\d)/g },
];

export function detectSensitive(text: string): SensitiveMatch[] {
  if (!text) return [];
  const found: SensitiveMatch[] = [];
  for (const { kind, re } of PATTERNS) {
    for (const m of text.matchAll(re)) {
      const start = m.index ?? 0;
      found.push({ kind, text: m[0].trim(), start, end: start + m[0].length });
    }
  }
  // Earlier patterns win where matches overlap (a phone number is also a long number).
  const kept: SensitiveMatch[] = [];
  for (const f of found) if (!kept.some((k) => f.start < k.end && k.start < f.end)) kept.push(f);
  return kept.sort((a, b) => a.start - b.start);
}

/** Emails and phone numbers: not allowed anywhere users write. */
export function hasBlockedContactDetails(text: string | null | undefined): boolean {
  return Boolean(text) && detectSensitive(text!).some((m) => BLOCKED_KINDS.includes(m.kind));
}

export const CONTACT_DETAILS_MESSAGE = "Please remove phone numbers and email addresses. They can identify you or others.";
