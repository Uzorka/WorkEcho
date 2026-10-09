import { z } from "zod";

// Variables that are safe to ship to the browser (NEXT_PUBLIC_*).
export const publicEnvSchema = z.object({
  NEXT_PUBLIC_SUPABASE_URL: z.url({ message: "NEXT_PUBLIC_SUPABASE_URL must be a valid URL" }),
  NEXT_PUBLIC_SUPABASE_ANON_KEY: z
    .string()
    .min(20, { message: "NEXT_PUBLIC_SUPABASE_ANON_KEY looks missing or too short" }),
  NEXT_PUBLIC_SITE_URL: z.url().default("http://localhost:3000"),
});

// Server-only variables. Never import these into client code.
export const serverEnvSchema = z.object({
  // Needed for pseudonym assignment and account deletion (server code only).
  SUPABASE_SERVICE_ROLE_KEY: z
    .string({ message: "SUPABASE_SERVICE_ROLE_KEY is required" })
    .min(20, { message: "SUPABASE_SERVICE_ROLE_KEY looks missing or too short" }),
});

export type PublicEnv = z.infer<typeof publicEnvSchema>;
export type ServerEnv = z.infer<typeof serverEnvSchema>;

export function formatEnvError(error: z.ZodError): string {
  const lines = error.issues.map((i) => `  - ${i.path.join(".")}: ${i.message}`);
  return `Invalid environment variables:\n${lines.join("\n")}\nCopy .env.example to .env.local and fill it in.`;
}

/**
 * On Vercel, if NEXT_PUBLIC_SITE_URL isn't set, use the deployment's own URL
 * (the production domain in production, the branch URL on previews), so auth
 * emails never link to localhost. Server-side only: these aren't NEXT_PUBLIC_.
 */
export function vercelSiteUrl(env: {
  VERCEL_ENV?: string;
  VERCEL_PROJECT_PRODUCTION_URL?: string;
  VERCEL_BRANCH_URL?: string;
  VERCEL_URL?: string;
}): string | undefined {
  const host =
    env.VERCEL_ENV === "production" ? env.VERCEL_PROJECT_PRODUCTION_URL || env.VERCEL_URL : env.VERCEL_BRANCH_URL || env.VERCEL_URL;
  return host ? `https://${host}` : undefined;
}
