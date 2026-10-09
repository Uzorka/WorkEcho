import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { buttonClass, inputClass } from "@/components/styles";
import { requireAdmin } from "@/lib/admin";
import { uuidSchema } from "@/lib/post-schema";
import { AdminForm } from "../../AdminForm";
import { updateCompany } from "../../actions";
import { CompanyFields } from "../../CompanyFields";

export const metadata: Metadata = { title: "Edit company" };

export default async function AdminEditCompanyPage({ params }: { params: Promise<{ id: string }> }) {
  const { supabase } = await requireAdmin();
  const { id } = await params;
  if (!uuidSchema.safeParse(id).success) notFound();
  const { data } = await supabase.rpc("admin_companies", { p_id: id });
  const company = ((data ?? []) as Record<string, string | null>[])[0];
  if (!company) notFound();

  return (
    <div className="flex flex-col gap-4">
      <Link href="/admin/companies" className="-my-2 self-start py-2 text-sm font-medium text-primary underline">
        ← All companies
      </Link>
      <h1 className="text-2xl font-bold tracking-tight break-words md:text-3xl">Edit {company.name}</h1>
      <p className="text-sm text-muted">
        Public page:{" "}
        <Link href={`/companies/${company.slug}`} className="text-primary underline">
          /companies/{company.slug}
        </Link>{" "}
        (the slug doesn&apos;t change, so links keep working). Ratings and reviews can&apos;t be edited here, and employers can never pay to change them.
      </p>
      <AdminForm action={updateCompany.bind(null, id)} noteLabel="Note for the log">
        <div className="flex w-full flex-col gap-3">
          <CompanyFields idPrefix="edit" values={company} />
          <label className="flex flex-col gap-1 text-sm font-medium" htmlFor="edit-status">
            Status
            <select id="edit-status" name="status" defaultValue={company.status ?? "active"} className={`${inputClass} max-w-xs`}>
              <option value="active">Active (public)</option>
              <option value="pending">Pending (hidden)</option>
            </select>
          </label>
          <button type="submit" className={`${buttonClass} self-start`}>
            Save changes
          </button>
        </div>
      </AdminForm>
    </div>
  );
}
