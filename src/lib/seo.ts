// What search engines may crawl. Pure, so it's unit-tested.

/** Private or form pages: nothing useful to index, and some are per-person. */
export const NO_CRAWL_PATHS = [
  "/admin",
  "/me",
  "/alerts",
  "/onboarding",
  "/create",
  "/auth",
  "/login",
  "/signup",
  "/forgot-password",
  "/reset-password",
  "/check-email",
  "/api",
  "/companies/*/review",
  "/companies/*/salary",
  "/companies/*/interview",
];

/** Only the production site is indexed; preview deployments are hidden. */
export function allowIndexing(vercelEnv: string | undefined): boolean {
  return vercelEnv === undefined || vercelEnv === "production";
}
