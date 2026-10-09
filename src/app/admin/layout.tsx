import type { Metadata } from "next";
import Link from "next/link";
import type { ReactNode } from "react";
import { requireAdmin } from "@/lib/admin";

export const metadata: Metadata = { title: { default: "Admin", template: "%s — Admin — WorkEcho" }, robots: { index: false } };

const LINKS = [
  { href: "/admin", label: "Overview" },
  { href: "/admin/reports", label: "Reports" },
  { href: "/admin/requests", label: "Company requests" },
  { href: "/admin/companies", label: "Companies" },
  { href: "/admin/users", label: "Users" },
  { href: "/admin/log", label: "Action log" },
];

export default async function AdminLayout({ children }: { children: ReactNode }) {
  await requireAdmin();
  return (
    <section className="flex flex-col gap-5">
      <nav aria-label="Admin" className="-mx-4 flex gap-2 overflow-x-auto px-4 pb-1 md:mx-0 md:flex-wrap md:px-0">
        {LINKS.map((l) => (
          <Link key={l.href} href={l.href} className="inline-flex min-h-11 shrink-0 items-center rounded-full border border-border px-4 text-sm font-medium hover:bg-primary-soft">
            {l.label}
          </Link>
        ))}
      </nav>
      {children}
    </section>
  );
}
