import { timingSafeEqual } from "node:crypto";

/**
 * True when the request carries "Authorization: Bearer <secret>".
 * No secret configured = nobody is allowed. Constant-time comparison.
 */
export function isAuthorizedCron(authorization: string | null, secret: string | undefined): boolean {
  if (!secret || !authorization) return false;
  const expected = Buffer.from(`Bearer ${secret}`);
  const given = Buffer.from(authorization);
  return given.length === expected.length && timingSafeEqual(given, expected);
}
