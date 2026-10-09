import { z } from "zod";
import { MIN_PASSWORD_LENGTH, USER_TYPES } from "./account-constants";
import { NIGERIAN_STATES } from "./nigeria";

export { MIN_PASSWORD_LENGTH, USER_TYPES, USER_TYPE_LABELS, type UserType } from "./account-constants";

// Validation for every account form. Messages are shown to users as-is.

const email = z.string().trim().toLowerCase().pipe(z.email({ message: "Enter a valid email address." }));
const newPassword = z
  .string()
  .min(MIN_PASSWORD_LENGTH, { message: `Use at least ${MIN_PASSWORD_LENGTH} characters.` })
  .max(72, { message: "Use 72 characters or fewer." });

export const signupSchema = z.object({
  email,
  password: newPassword,
  agree: z.literal("on", { message: "Please agree to the Terms and Privacy Policy." }),
});

export const loginSchema = z.object({
  email,
  password: z.string().min(1, { message: "Enter your password." }),
});

export const forgotPasswordSchema = z.object({ email });

export const resetPasswordSchema = z
  .object({ password: newPassword, confirm: z.string() })
  .refine((v) => v.password === v.confirm, { message: "The passwords don't match.", path: ["confirm"] });

export const changePasswordSchema = z
  .object({ current: z.string().min(1, { message: "Enter your current password." }), password: newPassword, confirm: z.string() })
  .refine((v) => v.password === v.confirm, { message: "The passwords don't match.", path: ["confirm"] });

export const aboutYouSchema = z.object({
  user_type: z.enum(USER_TYPES, { message: "Choose the option that fits you best." }),
  state: z
    .union([z.literal(""), z.enum(NIGERIAN_STATES)], { message: "Choose a state from the list." })
    .transform((s) => (s === "" ? null : s)),
});

export const deleteAccountSchema = z.object({
  confirm: z.literal("DELETE", { message: 'Type DELETE in capital letters to confirm.' }),
});

/** First error message per field, for showing next to inputs. */
export function fieldErrors(error: z.ZodError): Record<string, string> {
  const out: Record<string, string> = {};
  for (const issue of error.issues) {
    const key = String(issue.path[0] ?? "form");
    out[key] ??= issue.message;
  }
  return out;
}

/**
 * Only allow redirects to paths on this site ("/me", "/onboarding?step=2").
 * Rejects absolute URLs, protocol-relative "//evil.com" and backslash tricks.
 */
export function safeNextPath(next: unknown, fallback = "/"): string {
  if (typeof next !== "string" || !next.startsWith("/")) return fallback;
  if (next.startsWith("//") || next.startsWith("/\\") || next.includes("\\")) return fallback;
  if (/[\u0000-\u001f]/.test(next)) return fallback;
  return next;
}
