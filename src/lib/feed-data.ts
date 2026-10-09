import "server-only";
import { createClient } from "@/lib/supabase/server";
import { decodeCursor, encodeCursor } from "./feed-cursor";
import { FEED_PAGE_SIZE, type FeedSort, type PostCategory, type PublicPost, type PublicReply } from "./posts";

// Feed reads. Everything goes through public_posts / public_replies /
// feed_posts(), which never return author ids.

export type FeedQuery = { sort: FeedSort; category?: PostCategory | null; companyId?: string | null; cursor?: string | null };

export async function getFeed({ sort, category, companyId, cursor }: FeedQuery) {
  const after = cursor ? decodeCursor(cursor, sort) : null;
  if (cursor && !after) return { posts: [] as PublicPost[], nextCursor: null };
  const supabase = await createClient();
  // Ask for one extra row to know whether there's another page.
  const { data, error } = await supabase.rpc("feed_posts", {
    p_sort: sort,
    p_category: category ?? null,
    p_company_id: companyId ?? null,
    p_after_created: after?.c ?? null,
    p_after_id: after?.i ?? null,
    p_after_likes: after?.l ?? null,
    p_limit: FEED_PAGE_SIZE + 1,
  });
  if (error) throw new Error("Could not load posts");
  const rows = (data ?? []) as PublicPost[];
  const posts = rows.slice(0, FEED_PAGE_SIZE);
  const nextCursor = rows.length > FEED_PAGE_SIZE ? encodeCursor(posts[posts.length - 1], sort) : null;
  return { posts, nextCursor };
}

export async function getPost(id: string) {
  const supabase = await createClient();
  const { data } = await supabase.from("public_posts").select("*").eq("id", id).maybeSingle();
  return data as PublicPost | null;
}

export async function getReplies(postId: string) {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("public_replies")
    .select("*")
    .eq("post_id", postId)
    .order("created_at")
    .order("id")
    .limit(200);
  if (error) throw new Error("Could not load replies");
  return (data ?? []) as PublicReply[];
}

export type Notification = { id: string; type: string; post_id: string | null; message: string | null; is_read: boolean; created_at: string };

export async function getUnreadCount() {
  const supabase = await createClient();
  const { count } = await supabase.from("notifications").select("id", { count: "exact", head: true }).eq("is_read", false);
  return count ?? 0;
}

export async function getNotifications() {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("notifications")
    .select("id, type, post_id, message, is_read, created_at")
    .order("created_at", { ascending: false })
    .limit(50);
  if (error) throw new Error("Could not load notifications");
  const notifications = (data ?? []) as Notification[];
  // Excerpts of the posts they're about (still visible ones only).
  const ids = [...new Set(notifications.map((n) => n.post_id).filter((id): id is string => Boolean(id)))];
  const { data: posts } = ids.length
    ? await supabase.from("public_posts").select("id, body").in("id", ids)
    : { data: [] as { id: string; body: string }[] };
  const excerpts = new Map((posts ?? []).map((p) => [p.id as string, p.body as string]));
  return notifications.map((n) => ({ ...n, excerpt: n.post_id ? (excerpts.get(n.post_id) ?? null) : null }));
}
