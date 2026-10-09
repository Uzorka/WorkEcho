"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireUser } from "@/lib/auth";
import { fieldErrors } from "@/lib/auth-schemas";
import { companyRequestSchema, reviewSchema } from "@/lib/review-schema";
import { createClient } from "@/lib/supabase/server";

export type ReviewFormState = { errors?: Record<string, string>; message?: string };

async function activeCompanyId(slug: string) {
  const supabase = await createClient();
  const { data } = await supabase.from("companies").select("id").eq("slug", slug).maybeSingle();
  return data?.id as string | undefined;
}

export async function submitReview(slug: string, _prev: ReviewFormState, formData: FormData): Promise<ReviewFormState> {
  await requireUser(`/companies/${slug}/review`);
  const parsed = reviewSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { errors: fieldErrors(parsed.error) };

  const companyId = await activeCompanyId(slug);
  if (!companyId) return { message: "We couldn't find that company." };

  const supabase = await createClient();
  // RLS limits this to the caller's own review.
  const { data: existing } = await supabase.from("reviews").select("id").eq("company_id", companyId).maybeSingle();

  const { error } = existing
    ? await supabase.from("reviews").update(parsed.data).eq("id", existing.id)
    : await supabase.from("reviews").insert({ ...parsed.data, company_id: companyId });

  if (error) {
    if (error.code === "23505") return { message: "You've already reviewed this company. Refresh the page to edit your review." };
    if (error.code === "42501") return { message: "You can't post a review right now." };
    return { message: "We couldn't save your review. Please try again." };
  }
  revalidatePath(`/companies/${slug}`);
  revalidatePath("/companies");
  redirect(`/companies/${slug}?notice=${existing ? "review-updated" : "review-submitted"}`);
}

export async function deleteReview(slug: string, _prev: ReviewFormState, formData: FormData): Promise<ReviewFormState> {
  await requireUser(`/companies/${slug}/review`);
  if (formData.get("confirm") !== "on") return { errors: { confirm: "Tick the box to confirm." } };
  const companyId = await activeCompanyId(slug);
  if (!companyId) return { message: "We couldn't find that company." };

  const supabase = await createClient();
  const { data, error } = await supabase.from("reviews").delete().eq("company_id", companyId).select("id");
  if (error || !data?.length) return { message: "We couldn't delete your review. Please try again." };
  revalidatePath(`/companies/${slug}`);
  revalidatePath("/companies");
  redirect(`/companies/${slug}?notice=review-deleted`);
}

export async function toggleHelpful(slug: string, reviewId: string) {
  await requireUser(`/companies/${slug}`);
  const supabase = await createClient();
  const { data: mine } = await supabase.from("review_helpful").select("review_id").eq("review_id", reviewId).maybeSingle();
  if (mine) await supabase.from("review_helpful").delete().eq("review_id", reviewId);
  // Duplicate (23505) or not-votable (RLS) inserts are simply ignored.
  else await supabase.from("review_helpful").insert({ review_id: reviewId });
  revalidatePath(`/companies/${slug}`);
}

export type RequestFormState = {
  errors?: Record<string, string>;
  message?: string;
  success?: string;
  matches?: { name: string; slug: string }[];
};

export async function requestCompany(_prev: RequestFormState, formData: FormData): Promise<RequestFormState> {
  await requireUser("/companies");
  const parsed = companyRequestSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { errors: fieldErrors(parsed.error) };

  const supabase = await createClient();
  const { data, error } = await supabase.rpc("request_company", {
    p_name: parsed.data.name,
    p_industry: parsed.data.industry,
    p_state: parsed.data.state,
    p_website: parsed.data.website,
  });
  if (error) return { message: "We couldn't send your request. Please try again." };

  const result = data as { status: string; matches?: { name: string; slug: string }[] };
  switch (result.status) {
    case "created":
      return { success: "Thanks! We'll check the details and add the company, usually within a few days." };
    case "duplicate":
      return { message: "We already have a company with a very similar name. Is it one of these?", matches: result.matches };
    case "already_requested":
      return { success: "Someone has already asked for this company. It's in our queue to review." };
    case "too_many":
      return { message: "You have 5 requests waiting. Please wait until we've reviewed them." };
    default:
      return { message: "Please check the details and try again." };
  }
}
