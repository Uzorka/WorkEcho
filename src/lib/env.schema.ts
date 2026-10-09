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
  // Optional until a slice actually needs admin-level database access.
  SUPABASE_SERVICE_ROLE_KEY: z.string().min(20).optional(),
});

export type PublicEnv = z.infer<typeof publicEnvSchema>;
export type ServerEnv = z.infer<typeof serverEnvSchema>;

export function formatEnvError(error: z.ZodError): string {
  const lines = error.issues.map((i) => `  - ${i.path.join(".")}: ${i.message}`);
  return `Invalid environment variables:\n${lines.join("\n")}\nCopy .env.example to .env.local and fill it in.`;
}
