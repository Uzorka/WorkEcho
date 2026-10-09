"use server";

import { redirect } from "next/navigation";
import type { FormState } from "@/components/forms";
import {
  fieldErrors,
  forgotPasswordSchema,
  loginSchema,
  resetPasswordSchema,
  safeNextPath,
  signupSchema,
} from "@/lib/auth-schemas";
import { publicEnv } from "@/lib/env";
import { createClient } from "@/lib/supabase/server";

// Auth errors are mapped to friendly messages; raw errors are never shown.
const RATE_LIMITED = "Too many attempts. Please wait a few minutes and try again.";
const GENERIC = "Something went wrong. Please try again.";

export async function signUp(_prev: FormState, formData: FormData): Promise<FormState> {
  const raw = Object.fromEntries(formData);
  const parsed = signupSchema.safeParse(raw);
  const values = { email: String(raw.email ?? "") };
  if (!parsed.success) return { errors: fieldErrors(parsed.error), values };

  const supabase = await createClient();
  const { error } = await supabase.auth.signUp({
    email: parsed.data.email,
    password: parsed.data.password,
    options: { emailRedirectTo: `${publicEnv().NEXT_PUBLIC_SITE_URL}/auth/confirm?next=/onboarding` },
  });
  if (error) {
    if (error.code === "weak_password") return { errors: { password: "Choose a stronger password." }, values };
    if (error.status === 429) return { message: RATE_LIMITED, values };
    // Don't reveal whether the email already has an account.
    if (error.code !== "user_already_exists" && error.code !== "email_exists") return { message: GENERIC, values };
  }
  redirect("/check-email");
}

export async function logIn(_prev: FormState, formData: FormData): Promise<FormState> {
  const raw = Object.fromEntries(formData);
  const parsed = loginSchema.safeParse(raw);
  const values = { email: String(raw.email ?? "") };
  if (!parsed.success) return { errors: fieldErrors(parsed.error), values };

  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithPassword(parsed.data);
  if (error) {
    if (error.code === "email_not_confirmed")
      return { message: "Please confirm your email first. Check your inbox for the link we sent.", values };
    if (error.status === 429) return { message: RATE_LIMITED, values };
    if (error.code === "invalid_credentials") return { message: "That email and password don't match.", values };
    return { message: GENERIC, values };
  }
  // The middleware sends people who haven't finished onboarding there.
  redirect(safeNextPath(raw.next, "/"));
}

export async function requestPasswordReset(_prev: FormState, formData: FormData): Promise<FormState> {
  const raw = Object.fromEntries(formData);
  const parsed = forgotPasswordSchema.safeParse(raw);
  const values = { email: String(raw.email ?? "") };
  if (!parsed.success) return { errors: fieldErrors(parsed.error), values };

  const supabase = await createClient();
  const { error } = await supabase.auth.resetPasswordForEmail(parsed.data.email, {
    redirectTo: `${publicEnv().NEXT_PUBLIC_SITE_URL}/auth/confirm?next=/reset-password`,
  });
  if (error?.status === 429) return { message: RATE_LIMITED, values };
  // Same answer whether or not the account exists.
  return { success: "If an account uses that email, we've sent a link to reset your password. Check your inbox." };
}

export async function resetPassword(_prev: FormState, formData: FormData): Promise<FormState> {
  const parsed = resetPasswordSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { errors: fieldErrors(parsed.error) };

  const supabase = await createClient();
  const { error } = await supabase.auth.updateUser({ password: parsed.data.password });
  if (error) {
    if (error.code === "same_password") return { errors: { password: "Choose a password you haven't used here before." } };
    if (error.code === "weak_password") return { errors: { password: "Choose a stronger password." } };
    return { message: "We couldn't change your password. The link may have expired — please ask for a new one." };
  }
  redirect("/me?notice=password-updated");
}

export async function signOut() {
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect("/login?notice=signed-out");
}
