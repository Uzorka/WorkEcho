"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { POST_CATEGORIES, POST_PREVIEW_CHARS, type PublicPost } from "@/lib/posts";
import { Avatar } from "./Avatar";
import { LikeButton } from "./LikeButton";
import { ReportButton } from "@/components/ReportButton";
import { VerifiedBadge } from "@/components/VerifiedBadge";
import { OwnPostActions, ShareButton } from "./PostActions";
import { TimeAgo } from "./TimeAgo";

export function PostCard({
  post,
  signedIn,
  full = false,
  onDeleted,
}: {
  post: PublicPost;
  signedIn: boolean;
  /** On the post's own page: whole body, no link to itself. */
  full?: boolean;
  onDeleted?: () => void;
}) {
  const long = !full && post.body.length > POST_PREVIEW_CHARS;
  const [expanded, setExpanded] = useState(false);
  const [deleted, setDeleted] = useState(false);
  const router = useRouter();
  if (deleted) return null;

  const body = long && !expanded ? `${post.body.slice(0, POST_PREVIEW_CHARS).trimEnd()}…` : post.body;
  const href = `/posts/${post.id}`;

  return (
    <article className="flex flex-col gap-3 rounded-2xl border border-border bg-card p-4" aria-labelledby={`post-${post.id}-author`}>
      <header className="flex items-start gap-3">
        <Avatar pseudonym={post.author_pseudonym} />
        <div className="flex min-w-0 flex-col">
          <span id={`post-${post.id}-author`} className="font-semibold break-all">
            {post.author_pseudonym}
            {post.author_is_verified && (
              <span className="ml-1">
                <VerifiedBadge />
              </span>
            )}
            {post.is_mine && <span className="ml-1 text-xs font-normal text-muted">(you)</span>}
          </span>
          <span className="flex flex-wrap items-center gap-x-1.5 text-sm text-muted">
            <TimeAgo iso={post.created_at} />
            {post.edited_at && <span>· edited</span>}
            <span>· {POST_CATEGORIES[post.category]}</span>
          </span>
        </div>
      </header>

      {post.company_slug && post.company_name && (
        <Link href={`/companies/${post.company_slug}`} prefetch={false} className="self-start rounded-full bg-primary-soft px-3 py-1.5 text-xs font-medium text-primary">
          {post.company_name}
        </Link>
      )}

      <p className="whitespace-pre-line break-words">
        {full ? (
          body
        ) : (
          <Link href={href} prefetch={false} className="hover:underline">
            {body}
          </Link>
        )}
      </p>
      {long && (
        <button type="button" onClick={() => setExpanded((e) => !e)} aria-expanded={expanded} className="-mt-2 self-start py-2 text-sm font-medium text-primary underline">
          {expanded ? "Show less" : "Show more"}
        </button>
      )}

      <footer className="-mx-2 -mb-2 flex flex-wrap items-center border-t border-border pt-1">
        <LikeButton postId={post.id} liked={post.liked_by_me} count={post.like_count} signedIn={signedIn} />
        <Link href={full ? "#replies" : href} prefetch={false} className="inline-flex min-h-11 items-center gap-1.5 rounded-xl px-2 text-sm font-medium text-muted hover:bg-primary-soft hover:text-text">
          {post.reply_count} {post.reply_count === 1 ? "reply" : "replies"}
        </Link>
        <ShareButton postId={post.id} />
        {post.is_mine ? (
          <OwnPostActions
            postId={post.id}
            onDeleted={() => {
              setDeleted(true);
              onDeleted?.();
              // On the post's own page there's nothing left to show.
              if (full) router.push("/");
            }}
          />
        ) : (
          <ReportButton type="post" id={post.id} signedIn={signedIn} loginNext={href} />
        )}
      </footer>
    </article>
  );
}
