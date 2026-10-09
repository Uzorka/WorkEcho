import Link from "next/link";
import type { ReactNode } from "react";
import { getUser } from "@/lib/auth";
import { getFeed } from "@/lib/feed-data";
import { FEED_SORTS, POST_CATEGORIES, type FeedSort, type PostCategory } from "@/lib/posts";
import { FeedList } from "./FeedList";

/** Reads ?sort= and ?category= safely. */
export function parseFeedParams(sp: { sort?: string; category?: string }) {
  const sort: FeedSort = sp.sort === "top" ? "top" : "latest";
  const category = sp.category && sp.category in POST_CATEGORIES ? (sp.category as PostCategory) : null;
  return { sort, category };
}

// Tabs (Latest | Top this week), category chips and the post list.
export async function FeedSection({
  basePath,
  sort,
  category,
  companyId = null,
  empty,
}: {
  basePath: string;
  sort: FeedSort;
  category: PostCategory | null;
  companyId?: string | null;
  empty: ReactNode;
}) {
  const [{ posts, nextCursor }, user] = await Promise.all([getFeed({ sort, category, companyId }), getUser()]);

  const href = (s: FeedSort, c: PostCategory | null) => {
    const q = new URLSearchParams();
    if (s !== "latest") q.set("sort", s);
    if (c) q.set("category", c);
    return q.size ? `${basePath}?${q}` : basePath;
  };
  const chip = "inline-flex min-h-11 shrink-0 items-center rounded-full border px-4 text-sm font-medium";

  return (
    <div className="flex flex-col gap-4">
      <nav aria-label="Sort posts" className="flex gap-1 border-b border-border">
        {(Object.keys(FEED_SORTS) as FeedSort[]).map((s) => (
          <Link
            key={s}
            href={href(s, category)}
            aria-current={sort === s ? "page" : undefined}
            className={`-mb-px flex min-h-11 items-center border-b-2 px-3 text-sm font-medium ${
              sort === s ? "border-primary text-primary" : "border-transparent text-muted hover:text-text"
            }`}
          >
            {FEED_SORTS[s]}
          </Link>
        ))}
      </nav>
      <nav aria-label="Filter by category" className="-mx-4 flex gap-2 overflow-x-auto px-4 pb-1 md:mx-0 md:flex-wrap md:px-0">
        <Link href={href(sort, null)} aria-current={!category ? "page" : undefined} className={`${chip} ${!category ? "border-primary bg-primary-soft text-primary" : "border-border hover:bg-primary-soft"}`}>
          All
        </Link>
        {(Object.keys(POST_CATEGORIES) as PostCategory[]).map((c) => (
          <Link
            key={c}
            href={href(sort, c)}
            aria-current={category === c ? "page" : undefined}
            className={`${chip} ${category === c ? "border-primary bg-primary-soft text-primary" : "border-border hover:bg-primary-soft"}`}
          >
            {POST_CATEGORIES[c]}
          </Link>
        ))}
      </nav>
      {/* key: start a fresh list when the tab or filter changes. */}
      <FeedList
        key={`${sort}-${category}-${companyId}`}
        initialPosts={posts}
        initialCursor={nextCursor}
        query={{ sort, category, companyId }}
        signedIn={Boolean(user)}
        empty={empty}
      />
    </div>
  );
}
