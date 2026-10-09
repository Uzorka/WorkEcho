import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { DEPARTMENTS, INDUSTRIES, ilikePattern } from "@/lib/companies";
import { NIGERIAN_STATES } from "@/lib/nigeria";
import { EMPTY_REVIEW, validateReviewStep, type ReviewValues } from "@/lib/review-steps";
import { companyRequestSchema, reviewSchema } from "@/lib/review-schema";

const migration = readFileSync(path.resolve(__dirname, "../../supabase/migrations/20261010120000_companies_reviews.sql"), "utf8");

const valid: ReviewValues = {
  ...EMPTY_REVIEW,
  employment_status: "former",
  employment_type: "nysc",
  rating_overall: "4",
  rating_pay: "3",
  rating_work_life: "4",
  rating_management: "2",
  rating_culture: "5",
  rating_growth: "3",
  salary_on_time: "yes",
  headline: "Good place to start",
  pros: "Supportive colleagues and lots to learn.",
  cons: "Allowance is small and comes late sometimes.",
};

describe("lists match the database", () => {
  it("industries, states and departments in TS match the migration", () => {
    for (const i of INDUSTRIES) expect(migration).toContain(`'${i}'`);
    for (const s of NIGERIAN_STATES) expect(migration).toContain(`'${s}'`);
    for (const d of Object.keys(DEPARTMENTS)) expect(migration).toContain(`'${d}'`);
  });
});

describe("reviewSchema", () => {
  it("accepts a valid review and turns blanks into nulls", () => {
    const r = reviewSchema.parse(valid);
    expect(r.rating_overall).toBe(4);
    expect(r.department).toBeNull();
    expect(r.overtime_paid).toBeNull();
    expect(r.probation_months).toBeNull();
    expect(r.advice_to_management).toBeNull();
  });

  it("rejects bad ratings, short text and unknown values", () => {
    expect(reviewSchema.safeParse({ ...valid, rating_pay: "6" }).success).toBe(false);
    expect(reviewSchema.safeParse({ ...valid, rating_pay: "" }).success).toBe(false);
    expect(reviewSchema.safeParse({ ...valid, pros: "too short" }).success).toBe(false);
    expect(reviewSchema.safeParse({ ...valid, employment_type: "volunteer" }).success).toBe(false);
    expect(reviewSchema.safeParse({ ...valid, probation_months: "13" }).success).toBe(false);
    expect(reviewSchema.safeParse({ ...valid, salary_on_time: "maybe" }).success).toBe(false);
  });

  it("ignores fields users must not set", () => {
    const r = reviewSchema.parse({ ...valid, author_id: "x", status: "published", publish_at: "2020-01-01" });
    expect(r).not.toHaveProperty("author_id");
    expect(r).not.toHaveProperty("status");
    expect(r).not.toHaveProperty("publish_at");
  });
});

describe("validateReviewStep", () => {
  it("checks each step's required fields", () => {
    expect(Object.keys(validateReviewStep(1, EMPTY_REVIEW))).toEqual(["employment_status", "employment_type"]);
    expect(Object.keys(validateReviewStep(2, EMPTY_REVIEW))).toHaveLength(6);
    expect(validateReviewStep(3, EMPTY_REVIEW)).toEqual({});
    expect(Object.keys(validateReviewStep(4, EMPTY_REVIEW))).toEqual(["headline", "pros", "cons"]);
    for (const s of [1, 2, 3, 4]) expect(validateReviewStep(s, valid)).toEqual({});
  });
});

describe("companyRequestSchema", () => {
  it("adds https:// to bare websites and allows a blank state", () => {
    const r = companyRequestSchema.parse({ name: " Acme ", industry: "Fintech", state: "", website: "acme.ng" });
    expect(r).toEqual({ name: "Acme", industry: "Fintech", state: null, website: "https://acme.ng" });
  });
  it("rejects unknown industries", () => {
    expect(companyRequestSchema.safeParse({ name: "Acme", industry: "Space", state: "", website: "" }).success).toBe(false);
  });
});

describe("ilikePattern", () => {
  it("escapes wildcards in search terms", () => {
    expect(ilikePattern("50%_off\\")).toBe("%50\\%\\_off\\\\%");
  });
});
