"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireUser } from "@/lib/auth";
import { uuidSchema } from "@/lib/post-schema";
import { createClient } from "@/lib/supabase/server";

export async function markAllRead() {
  await requireUser("/alerts");
  const supabase = await createClient();
  // RLS: only the caller's own notifications.
  await supabase.from("notifications").update({ is_read: true }).eq("is_read", false);
  revalidatePath("/", "layout");
}

/** Mark one notification read, then go to its post (if it has one). */
export async function openNotification(id: string, postId: string | null) {
  await requireUser("/alerts");
  if (!uuidSchema.safeParse(id).success) redirect("/alerts");
  const supabase = await createClient();
  await supabase.from("notifications").update({ is_read: true }).eq("id", id);
  revalidatePath("/", "layout");
  redirect(postId && uuidSchema.safeParse(postId).success ? `/posts/${postId}` : "/alerts");
}
