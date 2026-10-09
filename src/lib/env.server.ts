import "server-only";
import { formatEnvError, serverEnvSchema, type ServerEnv } from "./env.schema";

let cached: ServerEnv | undefined;

export function serverEnv(): ServerEnv {
  if (cached) return cached;
  const parsed = serverEnvSchema.safeParse({
    // Newer Supabase projects call it the "secret" key.
    SUPABASE_SERVICE_ROLE_KEY: process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SECRET_KEY || undefined,
    RESEND_API_KEY: process.env.RESEND_API_KEY || undefined,
    EMAIL_FROM_ADDRESS: process.env.EMAIL_FROM_ADDRESS || undefined,
    MAILPIT_URL: process.env.MAILPIT_URL || undefined,
  });
  if (!parsed.success) throw new Error(formatEnvError(parsed.error));
  cached = parsed.data;
  return cached;
}
