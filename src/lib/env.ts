import { formatEnvError, publicEnvSchema, vercelSiteUrl, type PublicEnv } from "./env.schema";

let cached: PublicEnv | undefined;

/**
 * Public env, safe in both server and browser code.
 * Each NEXT_PUBLIC_* variable must be referenced literally so Next.js can
 * inline it into the browser bundle.
 */
export function publicEnv(): PublicEnv {
  if (cached) return cached;
  const parsed = publicEnvSchema.safeParse({
    NEXT_PUBLIC_SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL,
    // Supabase's newer dashboards call the anon key the "publishable" key.
    NEXT_PUBLIC_SUPABASE_ANON_KEY: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY,
    NEXT_PUBLIC_SITE_URL:
      process.env.NEXT_PUBLIC_SITE_URL ||
      vercelSiteUrl({
        VERCEL_ENV: process.env.VERCEL_ENV,
        VERCEL_PROJECT_PRODUCTION_URL: process.env.VERCEL_PROJECT_PRODUCTION_URL,
        VERCEL_BRANCH_URL: process.env.VERCEL_BRANCH_URL,
        VERCEL_URL: process.env.VERCEL_URL,
      }),
  });
  if (!parsed.success) throw new Error(formatEnvError(parsed.error));
  cached = parsed.data;
  return cached;
}
