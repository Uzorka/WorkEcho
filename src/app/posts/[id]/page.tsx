import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { PostCard } from "@/components/feed/PostCard";
import { PostComposer } from "@/components/feed/PostComposer";
import { getUser } from "@/lib/auth";
import { getPost, getReplies } from "@/lib/feed-data";
import { uuidSchema } from "@/lib/post-schema";
import { updatePost } from "../actions";
import { LoginToReply, ReplyForm, ReplyList } from "./Replies";

type Props = { params: Promise<{ id: string }>; searchParams: Promise<{ edit?: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { id } = await params;
  const post = uuidSchema.safeParse(id).success ? await getPost(id) : null;
  return { title: post ? `${post.body.slice(0, 50)}${post.body.length > 50 ? "…" : ""}` : "Post not found" };
}

export default async function PostPage({ params, searchParams }: Props) {
  const { id } = await params;
  const { edit } = await searchParams;
  if (!uuidSchema.safeParse(id).success) notFound();
  const [post, user] = await Promise.all([getPost(id), getUser()]);
  if (!post) notFound();
  const replies = await getReplies(id);
  const editing = edit === "1" && post.is_mine;

  return (
    <section className="flex flex-col gap-5">
      <Link href={editing ? `/posts/${id}` : "/"} className="-my-2 self-start py-2 text-sm font-medium text-primary underline">
        ← {editing ? "Cancel editing" : "Back to the feed"}
      </Link>
      {editing ? (
        <>
          <h1 className="text-2xl font-bold tracking-tight">Edit your post</h1>
          <PostComposer
            editing
            action={updatePost.bind(null, id)}
            initial={{
              category: post.category,
              body: post.body,
              company: post.company_id && post.company_name ? { id: post.company_id, name: post.company_name, slug: post.company_slug ?? "" } : null,
            }}
          />
        </>
      ) : (
        <>
          <h1 className="sr-only">Post by {post.author_pseudonym}</h1>
          <PostCard post={post} signedIn={Boolean(user)} full />
          <section id="replies" aria-labelledby="replies-heading" className="flex flex-col gap-3 rounded-2xl border border-border bg-card p-4">
            <h2 id="replies-heading" className="text-lg font-semibold">
              Replies ({replies.length})
            </h2>
            <ReplyList replies={replies} signedIn={Boolean(user)} />
            {user ? <ReplyForm postId={id} /> : <LoginToReply postId={id} />}
          </section>
        </>
      )}
    </section>
  );
}
