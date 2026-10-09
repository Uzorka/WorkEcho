"use server";

import { redirect } from "next/navigation";
import type { FormState } from "@/components/forms";
import { getOrCreateMyProfile, requireUser } from "@/lib/auth";
import { aboutYouSchema, fieldErrors } from "@/lib/auth-schemas";
import { regeneratePseudonym } from "@/lib/profile-service";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

export async function saveAboutYou(_prev: FormState, formData: FormData): Promise<FormState> {
  const user = await requireUser("/onboarding");
  const parsed = aboutYouSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { errors: fieldErrors(parsed.error) };

  await getOrCreateMyProfile(user.id);
  // Written as the user, so RLS + column grants apply.
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("profiles")
    .update({ user_type: parsed.data.user_type, state: parsed.data.state })
    .eq("id", user.id)
    .select("user_type");
  if (error || !data?.length) return { message: "We couldn't save that. Please try again." };
  redirect("/onboarding?step=3");
}

export async function regenerate() {
  const user = await requireUser("/onboarding");
  const result = await regeneratePseudonym(createAdminClient(), user.id);
  if (!result.ok && result.reason === "onboarded") redirect("/me");
  redirect(result.ok ? "/onboarding?step=3" : "/onboarding?step=3&notice=limit");
}

export async function finish() {
  await requireUser("/onboarding");
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("complete_onboarding");
  if (error) redirect("/onboarding?step=3&notice=error");
  // false = no user type yet (or already finished, which the middleware handles).
  redirect(data ? "/me?notice=welcome" : "/onboarding?step=2");
}
