import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { FeedSection, parseFeedParams } from "@/components/feed/FeedSection";
import { buttonClass } from "@/components/styles";
import { getCompany } from "@/lib/company-data";

type Props = { params: Promise<{ slug: string }>; searchParams: Promise<{ sort?: string; category?: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const company = await getCompany((await params).slug);
  return { title: company ? `${company.name} discussions` : "Company not found" };
}

// Posts tagged to this company.
export default async function CompanyDiscussionsPage({ params, searchParams }: Props) {
  const { slug } = await params;
  const { sort, category } = parseFeedParams(await searchParams);
  const company = await getCompany(slug);
  if (!company) notFound();

  return (
    <div className="flex flex-col gap-4">
      <Link href={`/create?type=post&company=${encodeURIComponent(slug)}`} className={`${buttonClass} self-start`}>
        Start a discussion
      </Link>
      <FeedSection
        basePath={`/companies/${slug}/discussions`}
        sort={sort}
        category={category}
        companyId={company.id}
        empty={
          <div className="rounded-2xl border border-border bg-card p-5">
            <p className="font-medium">No discussions about {company.name} yet.</p>
            <p className="mt-1 text-sm text-muted">Ask a question or share an experience. It&apos;s shown with your pseudonym.</p>
          </div>
        }
      />
    </div>
  );
}
