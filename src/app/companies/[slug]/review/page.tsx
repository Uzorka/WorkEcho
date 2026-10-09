import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { DeleteOwnForm } from "@/components/DeleteOwnForm";
import { requireUser } from "@/lib/auth";
import { getCompany, getMyReview } from "@/lib/company-data";
import { EMPTY_REVIEW, type ReviewValues } from "@/lib/review-steps";
import { deleteReview, submitReview } from "../../actions";
import { ReviewForm } from "./ReviewForm";

type Props = { params: Promise<{ slug: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const company = await getCompany((await params).slug);
  return { title: company ? `Review ${company.name}` : "Company not found" };
}

export default async function WriteReviewPage({ params }: Props) {
  const { slug } = await params;
  await requireUser(`/companies/${slug}/review`);
  const company = await getCompany(slug);
  if (!company) notFound();
  const mine = await getMyReview(company.id);

  if (mine?.status === "removed")
    return (
      <section className="flex flex-col gap-4">
        <h1 className="text-2xl font-bold tracking-tight">Your review was removed</h1>
        <p className="text-muted">Our moderators removed your review of {company.name} for breaking the community guidelines, so it can&apos;t be edited.</p>
        <Link href="/guidelines" className="font-medium text-primary underline">
          Read the guidelines
        </Link>
      </section>
    );

  const initial: ReviewValues = mine
    ? (Object.fromEntries(
        Object.keys(EMPTY_REVIEW).map((k) => [k, mine[k as keyof typeof mine] == null ? "" : String(mine[k as keyof typeof mine])]),
      ) as ReviewValues)
    : EMPTY_REVIEW;

  return (
    <section className="mx-auto flex w-full max-w-xl flex-col gap-6">
      <Link href={`/companies/${slug}/reviews`} className="-my-2 self-start py-2 text-sm font-medium text-primary underline">
        ← Back to {company.name}
      </Link>
      <ReviewForm slug={slug} companyName={company.name} initial={initial} editing={Boolean(mine)} action={submitReview.bind(null, slug)} />
      {mine && (
        <div className="flex flex-col gap-3 rounded-2xl border border-danger/40 bg-card p-5">
          <h2 className="text-lg font-semibold">Delete your review</h2>
          <DeleteOwnForm action={deleteReview.bind(null, slug)} />
        </div>
      )}
    </section>
  );
}
