import { describe, expect, it } from "vitest";
import { isAuthorizedCron } from "@/lib/cron";
import { serverEnvSchema } from "@/lib/env.schema";
import { NO_CRAWL_PATHS, allowIndexing } from "@/lib/seo";

const SECRET = "a-long-random-cron-secret";

describe("cron authorisation", () => {
  it("accepts the exact Bearer secret", () => {
    expect(isAuthorizedCron(`Bearer ${SECRET}`, SECRET)).toBe(true);
  });

  it("rejects a missing, wrong or differently-shaped header", () => {
    expect(isAuthorizedCron(null, SECRET)).toBe(false);
    expect(isAuthorizedCron("", SECRET)).toBe(false);
    expect(isAuthorizedCron(SECRET, SECRET)).toBe(false);
    expect(isAuthorizedCron(`Bearer ${SECRET}x`, SECRET)).toBe(false);
    expect(isAuthorizedCron(`bearer ${SECRET}`, SECRET)).toBe(false);
  });

  it("rejects everyone when no secret is configured", () => {
    expect(isAuthorizedCron("Bearer ", undefined)).toBe(false);
    expect(isAuthorizedCron("Bearer undefined", undefined)).toBe(false);
    expect(isAuthorizedCron("Bearer ", "")).toBe(false);
  });

  it("CRON_SECRET is optional but must be long when set", () => {
    const base = { SUPABASE_SERVICE_ROLE_KEY: "x".repeat(30) };
    expect(serverEnvSchema.safeParse(base).success).toBe(true);
    expect(serverEnvSchema.safeParse({ ...base, CRON_SECRET: "short" }).success).toBe(false);
    expect(serverEnvSchema.safeParse({ ...base, CRON_SECRET: SECRET }).success).toBe(true);
  });
});

describe("search engines", () => {
  it("index production and local builds only, never previews", () => {
    expect(allowIndexing("production")).toBe(true);
    expect(allowIndexing(undefined)).toBe(true);
    expect(allowIndexing("preview")).toBe(false);
    expect(allowIndexing("development")).toBe(false);
  });

  it("keep private and form pages out of search", () => {
    for (const path of ["/admin", "/me", "/alerts", "/onboarding", "/create", "/api", "/companies/*/review"]) {
      expect(NO_CRAWL_PATHS).toContain(path);
    }
    for (const path of ["/", "/companies", "/posts", "/privacy"]) {
      expect(NO_CRAWL_PATHS).not.toContain(path);
    }
  });
});
