"use client";

import { useState, useTransition } from "react";
import { loadMorePosts } from "@/app/posts/actions";
import { secondaryButtonClass } from "@/components/styles";
import type { FeedQuery } from "@/lib/feed-data";
import type { PublicPost } from "@/lib/posts";
import { PostCard } from "./PostCard";

// Server renders the first page; "Load more" fetches the next one by cursor.
export function FeedList({
  initialPosts,
  initialCursor,
  query,
  signedIn,
  empty,
}: {
  initialPosts: PublicPost[];
  initialCursor: string | null;
  query: Omit<FeedQuery, "cursor">;
  signedIn: boolean;
  empty: React.ReactNode;
}) {
  const [posts, setPosts] = useState(initialPosts);
  const [cursor, setCursor] = useState(initialCursor);
  const [error, setError] = useState(false);
  const [pending, startTransition] = useTransition();

  function loadMore() {
    setError(false);
    startTransition(async () => {
      try {
        const page = await loadMorePosts({ ...query, cursor });
        setPosts((prev) => {
          // Like counts can change between pages ("Top"), so never show a post twice.
          const seen = new Set(prev.map((p) => p.id));
          return [...prev, ...page.posts.filter((p) => !seen.has(p.id))];
        });
        setCursor(page.nextCursor);
      } catch {
        setError(true);
      }
    });
  }

  if (posts.length === 0) return <>{empty}</>;

  return (
    <div className="flex flex-col gap-3">
      <ul className="flex flex-col gap-3">
        {posts.map((p) => (
          <li key={p.id}>
            <PostCard post={p} signedIn={signedIn} />
          </li>
        ))}
      </ul>
      {error && (
        <p role="alert" className="text-sm text-danger">
          Couldn&apos;t load more posts. Please try again.
        </p>
      )}
      {cursor ? (
        <button type="button" onClick={loadMore} disabled={pending} className={`${secondaryButtonClass} self-center`}>
          {pending ? "Loading…" : "Load more"}
        </button>
      ) : (
        <p className="py-2 text-center text-sm text-muted">You&apos;re all caught up.</p>
      )}
    </div>
  );
}
