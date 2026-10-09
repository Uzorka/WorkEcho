import Link from "next/link";
import { FeedSection, parseFeedParams } from "@/components/feed/FeedSection";
import { buttonClass } from "@/components/styles";
import { getUser } from "@/lib/auth";
import { POST_CATEGORIES } from "@/lib/posts";

// Home feed. Also the landing page for logged-out visitors.
export default async function HomePage({ searchParams }: { searchParams: Promise<{ sort?: string; category?: string }> }) {
  const { sort, category } = parseFeedParams(await searchParams);
  const user = await getUser();

  return (
    <section className="flex flex-col gap-5">
      {user ? (
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h1 className="text-2xl font-bold tracking-tight md:text-3xl">Home</h1>
          <Link href="/create?type=post" className={buttonClass}>
            New post
          </Link>
        </div>
      ) : (
        <div className="flex flex-col gap-3">
          <h1 className="text-2xl font-bold tracking-tight md:text-3xl">Know the company before you accept the offer</h1>
          <p className="text-muted">
            Nigerian workers share what companies are really like — pay, interviews, and whether salary comes on time. Read
            everything without an account.
          </p>
          <div className="flex flex-wrap gap-3">
            <Link href="/companies" className={buttonClass}>
              Browse companies
            </Link>
            <Link href="/signup" className="inline-flex min-h-11 items-center rounded-xl border border-border px-4 font-medium hover:bg-primary-soft">
              Join the conversation
            </Link>
          </div>
          <p className="text-sm text-muted">We protect your identity, but what you write can still reveal you.</p>
        </div>
      )}

      <FeedSection
        basePath="/"
        sort={sort}
        category={category}
        empty={
          <div className="rounded-2xl border border-border bg-card p-5">
            <p className="font-medium">
              {category ? `No posts in ${POST_CATEGORIES[category]} yet.` : sort === "top" ? "No posts this week yet." : "No posts yet."}
            </p>
            <p className="mt-1 text-sm text-muted">Start the conversation — ask a question or share what you&apos;ve learnt.</p>
          </div>
        }
      />
    </section>
  );
}
