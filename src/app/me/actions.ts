"use server";

import { redirect } from "next/navigation";
import type { FormState } from "@/components/forms";
import { requireUser } from "@/lib/auth";
import { changePasswordSchema, deleteAccountSchema, fieldErrors } from "@/lib/auth-schemas";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

export async function changePassword(_prev: FormState, formData: FormData): Promise<FormState> {
  const user = await requireUser("/me");
  const parsed = changePasswordSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { errors: fieldErrors(parsed.error) };

  const supabase = await createClient();
  // Confirm the current password before changing it.
  const check = await supabase.auth.signInWithPassword({ email: user.email ?? "", password: parsed.data.current });
  if (check.error) {
    if (check.error.status === 429) return { message: "Too many attempts. Please wait a few minutes and try again." };
    return { errors: { current: "That isn't your current password." } };
  }

  const { error } = await supabase.auth.updateUser({ password: parsed.data.password });
  if (error) {
    if (error.code === "same_password") return { errors: { password: "Choose a password different from your current one." } };
    if (error.code === "weak_password") return { errors: { password: "Choose a stronger password." } };
    return { message: "We couldn't change your password. Please try again." };
  }
  return { success: "Your password has been changed." };
}

export async function deleteAccount(_prev: FormState, formData: FormData): Promise<FormState> {
  const user = await requireUser("/me");
  const parsed = deleteAccountSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { errors: fieldErrors(parsed.error) };

  // Deleting the auth user cascades to the profile row. Content tables (later
  // slices) reference profiles with ON DELETE SET NULL, so content stays and
  // shows as "Deleted user".
  const { error } = await createAdminClient().auth.admin.deleteUser(user.id);
  if (error) return { message: "We couldn't delete your account. Please try again." };

  // The user no longer exists; just clear the session cookies.
  const supabase = await createClient();
  await supabase.auth.signOut({ scope: "local" });
  redirect("/login?notice=account-deleted");
}
