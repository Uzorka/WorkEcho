import type { Metadata } from "next";
import Link from "next/link";
import { createPost } from "@/app/posts/actions";
import { BannedNotice } from "@/components/BannedNotice";
import { PostComposer } from "@/components/feed/PostComposer";
import { buttonClass, inputClass } from "@/components/styles";
import { getMyProfile, getUser, requireUser } from "@/lib/auth";
import { getCompany, listCompanies } from "@/lib/company-data";
import { POST_CATEGORIES } from "@/lib/posts";

export const metadata: Metadata = { title: "Create" };

const TYPES = {
  post: { title: "Write a post", body: "Ask a question or start a discussion. Shown with your pseudonym.", path: "" },
  review: { title: "Review a company", body: "Rate a place you work or worked, and share pros and cons.", path: "review" },
  salary: { title: "Add a salary", body: "Your monthly pay, shown only as part of a range.", path: "salary" },
  interview: { title: "Share an interview", body: "What they asked and how it went. Job seekers welcome.", path: "interview" },
} as const;
type ShareType = keyof typeof TYPES;

export default async function CreatePage({
  searchParams,
}: {
  searchParams: Promise<{ type?: string; q?: string; company?: string; category?: string }>;
}) {
  const sp = await searchParams;
  const type = (Object.keys(TYPES) as ShareType[]).find((t) => t === sp.type);
  const q = (sp.q ?? "").trim().slice(0, 100);

  const banned = (await getUser()) ? Boolean((await getMyProfile())?.is_banned) : false;
  if (banned)
    return (
      <section className="flex flex-col gap-5">
        <h1 className="text-2xl font-bold tracking-tight md:text-3xl">Create</h1>
        <BannedNotice />
      </section>
    );

  if (!type) {
    const user = await getUser();
    return (
      <section className="flex flex-col gap-5">
        <div className="flex flex-col gap-2">
          <h1 className="text-2xl font-bold tracking-tight md:text-3xl">Create</h1>
          <p className="text-muted">What would you like to share? We protect your identity, but what you write can still reveal you.</p>
        </div>
        {!user && (
          <p className="rounded-xl border border-primary/30 bg-primary-soft p-3 text-sm">
            You&apos;ll need to{" "}
            <Link href="/login?next=%2Fcreate" className="font-medium text-primary underline">
              log in
            </Link>{" "}
            or{" "}
            <Link href="/signup" className="font-medium text-primary underline">
              create an account
            </Link>{" "}
            to post.
          </p>
        )}
        <ul className="flex flex-col gap-3">
          {(Object.keys(TYPES) as ShareType[]).map((t) => (
            <li key={t}>
              <Link href={`/create?type=${t}`} className="flex flex-col gap-1 rounded-2xl border border-border bg-card p-4 hover:border-primary">
                <span className="text-lg font-semibold">{TYPES[t].title}</span>
                <span className="text-sm text-muted">{TYPES[t].body}</span>
              </Link>
            </li>
          ))}
        </ul>
      </section>
    );
  }

  if (type === "post") {
    await requireUser("/create?type=post");
    const company = sp.company ? await getCompany(sp.company) : null;
    const category = sp.category && sp.category in POST_CATEGORIES ? sp.category : undefined;
    return (
      <section className="mx-auto flex w-full max-w-xl flex-col gap-5">
        <Link href="/create" className="-my-2 self-start py-2 text-sm font-medium text-primary underline">
          ← Back
        </Link>
        <h1 className="text-2xl font-bold tracking-tight md:text-3xl">Write a post</h1>
        <PostComposer action={createPost} initial={{ category, company: company ? { id: company.id, name: company.name, slug: company.slug } : null }} />
      </section>
    );
  }

  const { companies } = q ? await listCompanies({ q, sort: "reviews", page: 1 }) : { companies: [] };

  return (
    <section className="flex flex-col gap-5">
      <Link href="/create" className="-my-2 self-start py-2 text-sm font-medium text-primary underline">
        ← Back
      </Link>
      <div className="flex flex-col gap-2">
        <h1 className="text-2xl font-bold tracking-tight md:text-3xl">{TYPES[type].title}</h1>
        <p className="text-muted">First, find the company.</p>
      </div>
      <form method="get" role="search" className="flex flex-col gap-3 rounded-2xl border border-border bg-card p-4">
        <input type="hidden" name="type" value={type} />
        <label htmlFor="create-q" className="font-medium">
          Company name
        </label>
        <input id="create-q" name="q" type="search" defaultValue={q} placeholder="e.g. Harbour Bank" className={inputClass} />
        <button type="submit" className={`${buttonClass} self-start`}>
          Find company
        </button>
      </form>

      {q &&
        (companies.length > 0 ? (
          <ul className="flex flex-col gap-2" aria-label="Matching companies">
            {companies.map((c) => (
              <li key={c.company_id}>
                <Link
                  href={`/companies/${c.slug}/${TYPES[type as Exclude<ShareType, "post">].path}`}
                  prefetch={false}
                  className="flex min-h-11 flex-col rounded-2xl border border-border bg-card p-4 hover:border-primary"
                >
                  <span className="font-semibold">{c.name}</span>
                  <span className="text-sm text-muted">{[c.industry, c.state].filter(Boolean).join(" · ")}</span>
                </Link>
              </li>
            ))}
          </ul>
        ) : (
          <div className="rounded-2xl border border-border bg-card p-5">
            <p className="font-medium">No company matches &ldquo;{q}&rdquo;.</p>
            <Link href={`/companies?q=${encodeURIComponent(q)}`} className="mt-2 inline-block py-2 text-sm font-medium text-primary underline">
              Ask us to add it
            </Link>
          </div>
        ))}
    </section>
  );
}
