import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { DeleteOwnForm } from "@/components/DeleteOwnForm";
import { requireUser } from "@/lib/auth";
import { getCompany, getMyInterview } from "@/lib/company-data";
import { deleteInterview, submitInterview } from "../../actions";
import { InterviewForm, type InterviewValues } from "./InterviewForm";

type Props = { params: Promise<{ slug: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const company = await getCompany((await params).slug);
  return { title: company ? `Share an interview: ${company.name}` : "Company not found" };
}

export default async function InterviewPage({ params }: Props) {
  const { slug } = await params;
  await requireUser(`/companies/${slug}/interview`);
  const company = await getCompany(slug);
  if (!company) notFound();
  const mine = await getMyInterview(company.id);

  if (mine?.status === "removed")
    return (
      <section className="flex flex-col gap-4">
        <h1 className="text-2xl font-bold tracking-tight">Your interview report was removed</h1>
        <p className="text-muted">Our moderators removed it, so it can&apos;t be edited.</p>
      </section>
    );

  const initial: InterviewValues = mine
    ? {
        role_group: mine.role_group,
        outcome: mine.outcome,
        difficulty: String(mine.difficulty),
        process_weeks: mine.process_weeks == null ? "" : String(mine.process_weeks),
        stages: mine.stages,
        questions_asked: mine.questions_asked,
        tips: mine.tips ?? "",
        experience: mine.experience,
      }
    : {};

  return (
    <section className="mx-auto flex w-full max-w-xl flex-col gap-5">
      <Link href={`/companies/${slug}/interviews`} className="-my-2 self-start py-2 text-sm font-medium text-primary underline">
        ← Back to {company.name}
      </Link>
      <div className="flex flex-col gap-1">
        <h1 className="text-2xl font-bold tracking-tight break-words">
          {mine ? "Edit your interview at" : "Share your interview at"} {company.name}
        </h1>
        <p className="text-muted">Anyone who interviewed can share, including job seekers.</p>
      </div>
      <InterviewForm initial={initial} editing={Boolean(mine)} action={submitInterview.bind(null, slug)} />
      {mine && (
        <div className="flex flex-col gap-3 rounded-2xl border border-danger/40 bg-card p-5">
          <h2 className="text-lg font-semibold">Delete your interview report</h2>
          <DeleteOwnForm what="interview report" action={deleteInterview.bind(null, slug)} />
        </div>
      )}
    </section>
  );
}
