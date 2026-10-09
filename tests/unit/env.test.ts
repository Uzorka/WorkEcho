import { describe, expect, it } from "vitest";
import { formatEnvError, publicEnvSchema, serverEnvSchema, vercelSiteUrl } from "@/lib/env.schema";

const validKey = "x".repeat(40);

describe("publicEnvSchema", () => {
  it("accepts a valid config and defaults the site URL", () => {
    const r = publicEnvSchema.parse({
      NEXT_PUBLIC_SUPABASE_URL: "http://127.0.0.1:54321",
      NEXT_PUBLIC_SUPABASE_ANON_KEY: validKey,
    });
    expect(r.NEXT_PUBLIC_SITE_URL).toBe("http://localhost:3000");
  });

  it("rejects a missing anon key and a bad URL", () => {
    const r = publicEnvSchema.safeParse({ NEXT_PUBLIC_SUPABASE_URL: "not a url" });
    expect(r.success).toBe(false);
    if (!r.success) {
      const msg = formatEnvError(r.error);
      expect(msg).toContain("NEXT_PUBLIC_SUPABASE_URL");
      expect(msg).toContain("NEXT_PUBLIC_SUPABASE_ANON_KEY");
    }
  });
});

describe("serverEnvSchema", () => {
  it("requires the service-role key", () => {
    expect(serverEnvSchema.safeParse({}).success).toBe(false);
    expect(serverEnvSchema.safeParse({ SUPABASE_SERVICE_ROLE_KEY: validKey }).success).toBe(true);
  });
});

describe("vercelSiteUrl", () => {
  it("uses the production domain in production and the branch URL on previews", () => {
    expect(vercelSiteUrl({ VERCEL_ENV: "production", VERCEL_PROJECT_PRODUCTION_URL: "workecho.ng", VERCEL_URL: "x.vercel.app" })).toBe("https://workecho.ng");
    expect(vercelSiteUrl({ VERCEL_ENV: "preview", VERCEL_BRANCH_URL: "app-git-branch.vercel.app", VERCEL_URL: "x.vercel.app" })).toBe("https://app-git-branch.vercel.app");
    expect(vercelSiteUrl({})).toBeUndefined();
  });
});
