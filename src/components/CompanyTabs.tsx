"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

export type CompanyTab = { href: string; label: string; count?: number };

// Tab bar for a company. Real links (works without JS); scrolls sideways on small screens.
export function CompanyTabs({ tabs }: { tabs: CompanyTab[] }) {
  const pathname = usePathname();
  return (
    <nav aria-label="Company sections" className="-mx-4 overflow-x-auto border-b border-border px-4 md:mx-0 md:px-0">
      <ul className="flex min-w-max gap-1">
        {tabs.map((t, i) => {
          const active = i === 0 ? pathname === t.href : pathname === t.href || pathname.startsWith(`${t.href}/`);
          return (
            <li key={t.href}>
              <Link
                href={t.href}
                aria-current={active ? "page" : undefined}
                className={`-mb-px flex min-h-11 items-center gap-1.5 border-b-2 px-3 text-sm font-medium ${
                  active ? "border-primary text-primary" : "border-transparent text-muted hover:text-text"
                }`}
              >
                {t.label}
                {t.count !== undefined && (
                  <span className="rounded-full bg-primary-soft px-2 text-xs">
                    {t.count}
                  </span>
                )}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
