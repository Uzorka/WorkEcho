"use client";

import Link from "next/link";
import { useState, useTransition } from "react";
import { deletePost } from "@/app/posts/actions";

const btn = "inline-flex min-h-11 items-center gap-1.5 rounded-xl px-2 text-sm font-medium text-muted hover:bg-primary-soft hover:text-text";

export function ShareButton({ postId }: { postId: string }) {
  const [copied, setCopied] = useState<"copied" | "failed" | null>(null);
  async function share() {
    const url = `${window.location.origin}/posts/${postId}`;
    try {
      await navigator.clipboard.writeText(url);
      setCopied("copied");
    } catch {
      setCopied("failed");
    }
    setTimeout(() => setCopied(null), 2500);
  }
  return (
    <button type="button" onClick={share} className={btn}>
      {copied === "copied" ? "Link copied" : copied === "failed" ? "Couldn't copy" : "Share"}
      <span className="sr-only" role="status">
        {copied === "copied" ? "Link copied" : ""}
      </span>
    </button>
  );
}

// Reporting is built in Slice 5. Until then this is clearly marked as unavailable.
export function ReportButton() {
  return (
    <button type="button" disabled className={`${btn} cursor-not-allowed opacity-60`} title="Reporting is coming soon">
      Report <span className="text-xs">(soon)</span>
    </button>
  );
}

export function OwnPostActions({ postId, onDeleted }: { postId: string; onDeleted: () => void }) {
  const [confirming, setConfirming] = useState(false);
  const [error, setError] = useState(false);
  const [pending, startTransition] = useTransition();

  return (
    <span className="inline-flex flex-wrap items-center">
      <Link href={`/posts/${postId}?edit=1`} className={btn}>
        Edit
      </Link>
      {confirming ? (
        <>
          <button
            type="button"
            disabled={pending}
            className={`${btn} text-danger`}
            onClick={() =>
              startTransition(async () => {
                const res = await deletePost(postId).catch(() => ({ ok: false }));
                if (res.ok) onDeleted();
                else setError(true);
              })
            }
          >
            {pending ? "Deleting…" : "Yes, delete"}
          </button>
          <button type="button" className={btn} onClick={() => setConfirming(false)}>
            Cancel
          </button>
        </>
      ) : (
        <button type="button" className={btn} onClick={() => setConfirming(true)}>
          Delete
        </button>
      )}
      {error && (
        <span role="alert" className="text-xs text-danger">
          Couldn&apos;t delete. Try again.
        </span>
      )}
    </span>
  );
}
