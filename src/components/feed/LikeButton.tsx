"use client";

import Link from "next/link";
import { useState, useTransition } from "react";
import { setLike } from "@/app/posts/actions";

// Updates instantly; rolls back (with a message) if the server says no.
export function LikeButton({ postId, liked: initialLiked, count: initialCount, signedIn }: { postId: string; liked: boolean; count: number; signedIn: boolean }) {
  const [liked, setLiked] = useState(initialLiked);
  const [count, setCount] = useState(initialCount);
  const [failed, setFailed] = useState(false);
  const [, startTransition] = useTransition();

  if (!signedIn)
    return (
      <Link href={`/login?next=${encodeURIComponent(`/posts/${postId}`)}`} className={btn} aria-label={`Log in to like. ${count} likes`}>
        <Heart filled={false} /> {count}
      </Link>
    );

  function toggle() {
    const prev = { liked, count };
    const next = !liked;
    setLiked(next);
    setCount((c) => c + (next ? 1 : -1));
    setFailed(false);
    startTransition(async () => {
      try {
        const res = await setLike(postId, next);
        if (!res.ok) throw new Error();
        setLiked(res.liked ?? next);
        setCount(res.likeCount ?? prev.count + (next ? 1 : -1));
      } catch {
        setLiked(prev.liked);
        setCount(prev.count);
        setFailed(true);
      }
    });
  }

  return (
    <span className="inline-flex items-center">
      <button type="button" onClick={toggle} aria-pressed={liked} aria-label={`Like. ${count} ${count === 1 ? "like" : "likes"}`} className={`${btn} ${liked ? "text-primary" : ""}`}>
        <Heart filled={liked} /> {count}
      </button>
      {failed && (
        <span role="alert" className="text-xs text-danger">
          Couldn&apos;t save. Try again.
        </span>
      )}
    </span>
  );
}

const btn = "inline-flex min-h-11 min-w-11 items-center gap-1.5 rounded-xl px-2 text-sm font-medium text-muted hover:bg-primary-soft hover:text-text";

function Heart({ filled }: { filled: boolean }) {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" aria-hidden fill={filled ? "currentColor" : "none"} stroke="currentColor" strokeWidth="2" strokeLinejoin="round">
      <path d="M12 20s-7-4.4-9.3-8.6C1.2 8.5 2.7 5 6.2 5c2 0 3.2 1.1 3.8 2.2.6-1.1 1.8-2.2 3.8-2.2h.4c3.5 0 5 3.5 3.5 6.4C19 15.6 12 20 12 20z" />
    </svg>
  );
}
