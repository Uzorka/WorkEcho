"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { NAV_ITEMS, isActive } from "./nav-items";
import { ThemeToggle } from "./ThemeToggle";

export function Sidebar() {
  const pathname = usePathname();
  return (
    <aside className="sticky top-0 hidden h-dvh w-60 shrink-0 flex-col border-r border-border bg-card px-3 py-5 md:flex">
      <Link href="/" className="mb-6 flex min-h-11 items-center px-3 text-xl font-bold text-primary">
        WorkEcho
      </Link>
      <nav aria-label="Main" className="flex flex-col gap-1">
        {NAV_ITEMS.map((item) => {
          const active = isActive(pathname, item.href);
          return (
            <Link
              key={item.href}
              href={item.href}
              aria-current={active ? "page" : undefined}
              className={`flex min-h-11 items-center gap-3 rounded-xl px-3 font-medium transition-colors ${
                item.primary
                  ? "mt-2 mb-2 bg-primary text-on-primary hover:bg-primary-hover"
                  : active
                    ? "bg-primary-soft text-primary"
                    : "text-muted hover:bg-primary-soft hover:text-text"
              }`}
            >
              {item.icon}
              {item.label}
            </Link>
          );
        })}
      </nav>
      <div className="mt-auto flex flex-col gap-1 text-sm">
        <ThemeToggle className="justify-start" />
        <div className="flex flex-wrap gap-x-3 px-3 pt-2 text-muted">
          <Link href="/guidelines" className="py-2 hover:text-text">Guidelines</Link>
          <Link href="/privacy" className="py-2 hover:text-text">Privacy</Link>
          <Link href="/terms" className="py-2 hover:text-text">Terms</Link>
        </div>
      </div>
    </aside>
  );
}

export function BottomNav() {
  const pathname = usePathname();
  return (
    <nav
      aria-label="Main"
      className="fixed inset-x-0 bottom-0 z-20 border-t border-border bg-card pb-[env(safe-area-inset-bottom)] md:hidden"
    >
      <ul className="mx-auto flex max-w-lg items-stretch justify-around">
        {NAV_ITEMS.map((item) => {
          const active = isActive(pathname, item.href);
          return (
            <li key={item.href} className="flex-1">
              <Link
                href={item.href}
                aria-current={active ? "page" : undefined}
                className={`flex min-h-14 flex-col items-center justify-center gap-0.5 text-xs font-medium ${
                  active ? "text-primary" : "text-muted"
                }`}
              >
                {item.primary ? (
                  <span className="flex h-9 w-9 items-center justify-center rounded-full bg-primary text-on-primary">
                    {item.icon}
                  </span>
                ) : (
                  item.icon
                )}
                <span>{item.label}</span>
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}

export function MobileHeader() {
  return (
    <header className="sticky top-0 z-10 flex h-14 items-center justify-between border-b border-border bg-card/95 px-4 backdrop-blur md:hidden">
      <Link href="/" className="flex min-h-11 items-center text-lg font-bold text-primary">
        WorkEcho
      </Link>
      <ThemeToggle />
    </header>
  );
}
