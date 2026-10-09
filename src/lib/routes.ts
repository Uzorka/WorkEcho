// Which pages need an account, and where people get sent. Pure, so it's unit-tested.

/** Pages that need a signed-in user. Everything else is public to browse. */
const SIGNED_IN_ONLY = ["/onboarding", "/me", "/reset-password", "/alerts"];

/** Pages that make no sense once signed in. */
const SIGNED_OUT_ONLY = ["/login", "/signup", "/forgot-password", "/check-email"];

/** Pages a signed-in user may still visit before finishing onboarding. */
const ALLOWED_BEFORE_ONBOARDING = ["/onboarding", "/auth", "/reset-password", "/terms", "/privacy", "/guidelines"];

/** Write pages under public sections, e.g. /companies/some-co/review, /salary, /interview. */
const SIGNED_IN_ONLY_PATTERNS = [/^\/companies\/[^/]+\/(review|salary|interview)\/?$/];

function matches(pathname: string, prefixes: string[]) {
  return prefixes.some((p) => pathname === p || pathname.startsWith(`${p}/`));
}

/** Returns the path to redirect to, or null to let the request through. */
export function routeDecision({
  pathname,
  search = "",
  signedIn,
  onboarded,
}: {
  pathname: string;
  search?: string;
  signedIn: boolean;
  onboarded: boolean;
}): string | null {
  if (!signedIn) {
    if (pathname === "/reset-password") return "/forgot-password";
    if (matches(pathname, SIGNED_IN_ONLY) || SIGNED_IN_ONLY_PATTERNS.some((re) => re.test(pathname)))
      return `/login?next=${encodeURIComponent(pathname + search)}`;
    return null;
  }

  if (!onboarded) {
    return matches(pathname, ALLOWED_BEFORE_ONBOARDING) ? null : "/onboarding";
  }

  if (matches(pathname, SIGNED_OUT_ONLY) || matches(pathname, ["/onboarding"])) return "/me";
  return null;
}
