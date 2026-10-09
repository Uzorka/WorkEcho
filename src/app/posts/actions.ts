"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { getUser, requireUser } from "@/lib/auth";
import { fieldErrors } from "@/lib/auth-schemas";
import { getFeed, type FeedQuery } from "@/lib/feed-data";
import { postEditSchema, postSchema, replySchema, uuidSchema } from "@/lib/post-schema";
import { FEED_SORTS, POST_CATEGORIES, type PostCategory } from "@/lib/posts";
import { ilikePattern } from "@/lib/companies";
import { createClient } from "@/lib/supabase/server";

export type PostFormState = { errors?: Record<string, string>; message?: string; success?: string; values?: Record<string, string> };

const isUuid = (v: unknown): v is string => uuidSchema.safeParse(v).success;

/** Database errors -> friendly text. Rate-limit messages (P0429) are written by us in SQL. */
function writeError(code: string | undefined, message?: string) {
  if (code === "P0429" && message) return message;
  if (code === "42501") return "You can't post right now.";
  if (code === "23514") return "Please check what you wrote and try again.";
  return "Something went wrong. Please try again.";
}

/** "Load more" in any feed. Public: logged-out visitors can read too. */
export async function loadMorePosts(query: FeedQuery) {
  const sort = query.sort in FEED_SORTS ? query.sort : "latest";
  const category = query.category && query.category in POST_CATEGORIES ? (query.category as PostCategory) : null;
  const companyId = isUuid(query.companyId) ? query.companyId : null;
  return getFeed({ sort, category, companyId, cursor: typeof query.cursor === "string" ? query.cursor : null });
}

/** Like or unlike. Returns the fresh count so the UI can settle on the truth. */
export async function setLike(postId: string, liked: boolean): Promise<{ ok: boolean; likeCount?: number; liked?: boolean }> {
  if (!isUuid(postId)) return { ok: false };
  const user = await getUser();
  if (!user) return { ok: false };
  const supabase = await createClient();
  const { error } = liked
    ? await supabase.from("post_likes").insert({ post_id: postId })
    : await supabase.from("post_likes").delete().eq("post_id", postId);
  // A duplicate like (23505) just means it's already liked.
  if (error && error.code !== "23505") return { ok: false };
  const { data } = await supabase.from("public_posts").select("like_count, liked_by_me").eq("id", postId).maybeSingle();
  if (!data) return { ok: false };
  return { ok: true, likeCount: data.like_count as number, liked: data.liked_by_me as boolean };
}

export async function createPost(_prev: PostFormState, formData: FormData): Promise<PostFormState> {
  await requireUser("/create?type=post");
  const values = Object.fromEntries(formData) as Record<string, string>;
  const parsed = postSchema.safeParse(values);
  if (!parsed.success) return { errors: fieldErrors(parsed.error), values };

  const supabase = await createClient();
  const { data, error } = await supabase.from("posts").insert(parsed.data).select("id").single();
  if (error || !data) return { message: writeError(error?.code, error?.message), values };
  revalidatePath("/");
  redirect(`/posts/${data.id}`);
}

export async function updatePost(postId: string, _prev: PostFormState, formData: FormData): Promise<PostFormState> {
  await requireUser(`/posts/${postId}`);
  const values = Object.fromEntries(formData) as Record<string, string>;
  const parsed = postEditSchema.safeParse(values);
  if (!parsed.success) return { errors: fieldErrors(parsed.error), values };
  const supabase = await createClient();
  // RLS: only the author's own post can match.
  const { data, error } = await supabase.from("posts").update(parsed.data).eq("id", postId).select("id");
  if (error || !data?.length) return { message: writeError(error?.code), values };
  revalidatePath("/", "layout");
  redirect(`/posts/${postId}`);
}

export async function deletePost(postId: string): Promise<{ ok: boolean }> {
  if (!isUuid(postId)) return { ok: false };
  await requireUser(`/posts/${postId}`);
  const supabase = await createClient();
  const { data, error } = await supabase.from("posts").delete().eq("id", postId).select("id");
  if (error || !data?.length) return { ok: false };
  revalidatePath("/", "layout");
  return { ok: true };
}

export async function createReply(postId: string, _prev: PostFormState, formData: FormData): Promise<PostFormState> {
  await requireUser(`/posts/${postId}`);
  const values = Object.fromEntries(formData) as Record<string, string>;
  const parsed = replySchema.safeParse(values);
  if (!parsed.success) return { errors: fieldErrors(parsed.error), values };
  const supabase = await createClient();
  const { error } = await supabase.from("replies").insert({ post_id: postId, body: parsed.data.body });
  if (error) return { message: error.code === "42501" ? "You can't reply to this post." : writeError(error.code, error.message), values };
  revalidatePath(`/posts/${postId}`);
  return { success: "Reply posted." };
}

export async function updateReply(replyId: string, postId: string, _prev: PostFormState, formData: FormData): Promise<PostFormState> {
  await requireUser(`/posts/${postId}`);
  const values = Object.fromEntries(formData) as Record<string, string>;
  const parsed = replySchema.safeParse(values);
  if (!parsed.success) return { errors: fieldErrors(parsed.error), values };
  const supabase = await createClient();
  const { data, error } = await supabase.from("replies").update({ body: parsed.data.body }).eq("id", replyId).select("id");
  if (error || !data?.length) return { message: writeError(error?.code), values };
  revalidatePath(`/posts/${postId}`);
  return { success: "Saved." };
}

export async function deleteReply(replyId: string, postId: string): Promise<{ ok: boolean }> {
  if (!isUuid(replyId)) return { ok: false };
  await requireUser(`/posts/${postId}`);
  const supabase = await createClient();
  const { data, error } = await supabase.from("replies").delete().eq("id", replyId).select("id");
  if (error || !data?.length) return { ok: false };
  revalidatePath(`/posts/${postId}`);
  return { ok: true };
}

/** Company picker in the composer. Active companies only, names and slugs only. */
export async function searchCompanies(q: string) {
  const term = typeof q === "string" ? q.trim().slice(0, 60) : "";
  if (term.length < 2) return [];
  const supabase = await createClient();
  const { data } = await supabase.from("companies").select("id, name, slug").ilike("name", ilikePattern(term)).order("name").limit(8);
  return (data ?? []) as { id: string; name: string; slug: string }[];
}
