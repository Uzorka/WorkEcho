import { describe, expect, it } from "vitest";
import { routeDecision } from "@/lib/routes";

const out = { signedIn: false, onboarded: false };
const half = { signedIn: true, onboarded: false };
const done = { signedIn: true, onboarded: true };

describe("routeDecision", () => {
  it("lets logged-out visitors browse public pages", () => {
    for (const p of ["/", "/companies", "/login", "/signup", "/privacy", "/create"])
      expect(routeDecision({ pathname: p, ...out })).toBeNull();
  });

  it("sends logged-out visitors to log in for account pages, keeping where they were going", () => {
    expect(routeDecision({ pathname: "/me", ...out })).toBe("/login?next=%2Fme");
    expect(routeDecision({ pathname: "/onboarding", search: "?step=2", ...out })).toBe(
      "/login?next=%2Fonboarding%3Fstep%3D2",
    );
    expect(routeDecision({ pathname: "/reset-password", ...out })).toBe("/forgot-password");
  });

  it("sends signed-in users who haven't finished onboarding there", () => {
    for (const p of ["/", "/me", "/companies", "/login"]) expect(routeDecision({ pathname: p, ...half })).toBe("/onboarding");
    for (const p of ["/onboarding", "/auth/confirm", "/terms", "/privacy", "/guidelines", "/reset-password"])
      expect(routeDecision({ pathname: p, ...half })).toBeNull();
  });

  it("keeps onboarded users out of login, signup and onboarding", () => {
    for (const p of ["/login", "/signup", "/forgot-password", "/onboarding"]) expect(routeDecision({ pathname: p, ...done })).toBe("/me");
    for (const p of ["/", "/me", "/reset-password", "/companies"]) expect(routeDecision({ pathname: p, ...done })).toBeNull();
  });

  it("requires login to write a review, but not to read a company", () => {
    expect(routeDecision({ pathname: "/companies/demo-co/review", ...out })).toBe("/login?next=%2Fcompanies%2Fdemo-co%2Freview");
    expect(routeDecision({ pathname: "/companies/demo-co", ...out })).toBeNull();
    expect(routeDecision({ pathname: "/companies", search: "?q=review", ...out })).toBeNull();
    expect(routeDecision({ pathname: "/companies/demo-co/review", ...done })).toBeNull();
  });

  it("doesn't treat look-alike paths as protected", () => {
    expect(routeDecision({ pathname: "/meetups", ...out })).toBeNull();
  });
});
