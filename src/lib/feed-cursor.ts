// Feed cursors. Server code only (uses Node's Buffer); kept free of
// "server-only" so unit tests can import it.
import type { FeedSort, PublicPost } from "./posts";

export type FeedCursor = { c: string; i: string; l?: number };

/** Opaque "Load more" cursor: the sort key of the last post shown. */
export function encodeCursor(post: Pick<PublicPost, "created_at" | "id" | "rank_score">, sort: FeedSort): string {
  // For "top", `l` is the post's rank_score (likes + verified boost).
  const cur: FeedCursor = { c: post.created_at, i: post.id, ...(sort === "top" ? { l: post.rank_score } : {}) };
  return Buffer.from(JSON.stringify(cur)).toString("base64url");
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function decodeCursor(raw: unknown, sort: FeedSort): FeedCursor | null {
  if (typeof raw !== "string" || raw.length > 300) return null;
  try {
    const v = JSON.parse(Buffer.from(raw, "base64url").toString("utf8")) as FeedCursor;
    if (typeof v.c !== "string" || Number.isNaN(Date.parse(v.c)) || typeof v.i !== "string" || !UUID.test(v.i)) return null;
    if (sort === "top" && (typeof v.l !== "number" || !Number.isInteger(v.l) || v.l < 0)) return null;
    return v;
  } catch {
    return null;
  }
}

