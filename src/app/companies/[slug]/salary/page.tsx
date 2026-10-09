import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { DeleteOwnForm } from "@/components/DeleteOwnForm";
import { requireUser } from "@/lib/auth";
import { getCompany, getMySalary } from "@/lib/company-data";
import { deleteSalary, submitSalary } from "../../actions";
import { SalaryForm, type SalaryValues } from "./SalaryForm";

type Props = { params: Promise<{ slug: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const company = await getCompany((await params).slug);
  return { title: company ? `Add a salary: ${company.name}` : "Company not found" };
}

export default async function SalaryPage({ params }: Props) {
  const { slug } = await params;
  await requireUser(`/companies/${slug}/salary`);
  const company = await getCompany(slug);
  if (!company) notFound();
  const mine = await getMySalary(company.id);

  if (mine?.status === "removed")
    return (
      <section className="flex flex-col gap-4">
        <h1 className="text-2xl font-bold tracking-tight">Your salary report was removed</h1>
        <p className="text-muted">Our moderators removed it, so it can&apos;t be edited.</p>
      </section>
    );

  const initial: SalaryValues = mine
    ? {
        role_group: mine.role_group,
        level: mine.level,
        employment_type: mine.employment_type,
        state: mine.state ?? "",
        monthly_gross_naira: String(mine.monthly_gross_naira),
        has_bonus: mine.has_bonus ? "yes" : "no",
        other_benefits: mine.other_benefits.length ? mine.other_benefits : ["none"],
      }
    : {};

  return (
    <section className="mx-auto flex w-full max-w-xl flex-col gap-5">
      <Link href={`/companies/${slug}/salaries`} className="-my-2 self-start py-2 text-sm font-medium text-primary underline">
        ← Back to {company.name}
      </Link>
      <div className="flex flex-col gap-1">
        <h1 className="text-2xl font-bold tracking-tight break-words">
          {mine ? "Edit your salary at" : "Add your salary at"} {company.name}
        </h1>
        <p className="text-muted">Takes about a minute. It helps others know what to ask for.</p>
      </div>
      <SalaryForm initial={initial} editing={Boolean(mine)} action={submitSalary.bind(null, slug)} />
      {mine && (
        <div className="flex flex-col gap-3 rounded-2xl border border-danger/40 bg-card p-5">
          <h2 className="text-lg font-semibold">Delete your salary report</h2>
          <DeleteOwnForm what="salary report" action={deleteSalary.bind(null, slug)} />
        </div>
      )}
    </section>
  );
}
