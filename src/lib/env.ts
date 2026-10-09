import { formatEnvError, publicEnvSchema, type PublicEnv } from "./env.schema";

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
    NEXT_PUBLIC_SUPABASE_ANON_KEY: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    NEXT_PUBLIC_SITE_URL: process.env.NEXT_PUBLIC_SITE_URL || undefined,
  });
  if (!parsed.success) throw new Error(formatEnvError(parsed.error));
  cached = parsed.data;
  return cached;
}
