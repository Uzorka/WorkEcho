import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import {
  FREE_EMAIL_DOMAINS,
  domainMatches,
  emailDomain,
  generateCode,
  isFreeEmailDomain,
  maskEmail,
  parseEmailDomains,
  verificationState,
} from "@/lib/verification";

const migration = readFileSync(path.resolve(__dirname, "../../supabase/migrations/20261014120000_verification.sql"), "utf8");

describe("email domain checks", () => {
  it("extracts the domain", () => {
    expect(emailDomain("  Ada.Obi@CHFHeron.com ")).toBe("chfheron.com");
  });
  it("rejects free email providers", () => {
    for (const d of ["gmail.com", "yahoo.com", "outlook.com", "hotmail.com", "icloud.com", "GMAIL.COM"]) expect(isFreeEmailDomain(d)).toBe(true);
    expect(isFreeEmailDomain("chfheron.com")).toBe(false);
  });
  it("free-domain list matches the database", () => {
    for (const d of FREE_EMAIL_DOMAINS) expect(migration).toContain(`'${d}'`);
  });
  it("matches the company's domains and their subdomains only", () => {
    expect(domainMatches("chfheron.com", ["chfheron.com"])).toBe(true);
    expect(domainMatches("lagos.chfheron.com", ["chfheron.com"])).toBe(true);
    expect(domainMatches("notchfheron.com", ["chfheron.com"])).toBe(false);
    expect(domainMatches("chfheron.com.evil.ng", ["chfheron.com"])).toBe(false);
    expect(domainMatches("chf.ng", ["chfheron.com", "chf.ng"])).toBe(true);
  });
});

describe("parseEmailDomains (admin input)", () => {
  it("normalises and de-duplicates", () => {
    expect(parseEmailDomains(" CHFHeron.com, @chf.ng chfheron.com ")).toEqual({ domains: ["chfheron.com", "chf.ng"] });
    expect(parseEmailDomains("")).toEqual({ domains: [] });
  });
  it("rejects bad and free domains", () => {
    expect(parseEmailDomains("not a domain")).toHaveProperty("error");
    expect(parseEmailDomains("gmail.com")).toHaveProperty("error");
  });
});

describe("codes and masking", () => {
  it("makes 6-digit codes", () => {
    for (let i = 0; i < 500; i++) expect(generateCode()).toMatch(/^\d{6}$/);
  });
  it("masks the email shown back to the user", () => {
    expect(maskEmail("adaeze@chfheron.com")).toBe("a•••@chfheron.com");
  });
});

describe("verificationState", () => {
  const now = Date.parse("2026-10-09T12:00:00Z");
  const days = (n: number) => new Date(now + n * 86_400_000).toISOString();
  it("active, expiring (last 30 days), expired, revoked", () => {
    expect(verificationState({ status: "active", expires_at: days(200) }, now)).toBe("active");
    expect(verificationState({ status: "active", expires_at: days(20) }, now)).toBe("expiring");
    expect(verificationState({ status: "active", expires_at: days(-1) }, now)).toBe("expired");
    expect(verificationState({ status: "revoked", expires_at: days(200) }, now)).toBe("revoked");
  });
});
