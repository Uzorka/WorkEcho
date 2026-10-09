import type { Metadata } from "next";
import { getCompany } from "@/lib/company-data";

type Props = { params: Promise<{ slug: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const company = await getCompany((await params).slug);
  return { title: company ? `${company.name} discussions` : "Company not found" };
}

// Honest placeholder: the social feed arrives in Slice 4.
export default function CompanyDiscussionsPage() {
  return (
    <div className="rounded-2xl border border-border bg-card p-5">
      <h2 className="font-semibold">Discussions aren&apos;t ready yet</h2>
      <p className="mt-1 text-sm text-muted">
        Soon you&apos;ll be able to ask questions and talk about this company under your pseudonym. It&apos;s being built in
        Slice 4.
      </p>
    </div>
  );
}
