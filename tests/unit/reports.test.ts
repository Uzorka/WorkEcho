import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { BENEFITS, INTERVIEW_STAGES, formatNaira, parseNaira, roundToNearest10k } from "@/lib/companies";
import { formDataToObject, interviewSchema, salarySchema } from "@/lib/report-schema";

const migration = readFileSync(path.resolve(__dirname, "../../supabase/migrations/20261011120000_salary_interview_reports.sql"), "utf8");

const salary = {
  role_group: "tech_it",
  level: "mid",
  employment_type: "full_time",
  state: "",
  monthly_gross_naira: "250,000",
  has_bonus: "no",
  other_benefits: ["hmo", "transport"],
};

describe("Naira helpers", () => {
  it("parses what people type", () => {
    expect(parseNaira("250,000")).toBe(250000);
    expect(parseNaira("₦ 1,200,000")).toBe(1200000);
    expect(parseNaira("450000.00")).toBe(450000);
    expect(parseNaira("NGN 80000")).toBe(80000);
    for (const bad of ["", "abc", "12.5", "-5000", "250k", null, undefined]) expect(parseNaira(bad)).toBeNull();
  });

  it("formats with ₦ and commas", () => {
    expect(formatNaira(520000)).toBe("₦520,000");
    expect(formatNaira(12_500_000)).toBe("₦12,500,000");
  });

  it("rounds to the nearest ₦10,000 like the database (halves go up)", () => {
    expect(roundToNearest10k(154_999)).toBe(150_000);
    expect(roundToNearest10k(155_000)).toBe(160_000);
    expect(roundToNearest10k(127_500)).toBe(130_000);
    expect(roundToNearest10k(30_000)).toBe(30_000);
  });
});

describe("salarySchema", () => {
  it("accepts a valid report", () => {
    expect(salarySchema.parse(salary)).toEqual({
      role_group: "tech_it",
      level: "mid",
      employment_type: "full_time",
      state: null,
      monthly_gross_naira: 250000,
      has_bonus: false,
      other_benefits: ["hmo", "transport"],
    });
  });

  it("rejects amounts below ₦30,000 or above ₦50,000,000 with a friendly message", () => {
    const low = salarySchema.safeParse({ ...salary, monthly_gross_naira: "29,999" });
    expect(low.success).toBe(false);
    expect(low.error!.issues[0].message).toMatch(/too low for monthly pay/);
    const high = salarySchema.safeParse({ ...salary, monthly_gross_naira: "50,000,001" });
    expect(high.success).toBe(false);
    expect(high.error!.issues[0].message).toMatch(/too high.*monthly \(not yearly\)/);
    expect(salarySchema.safeParse({ ...salary, monthly_gross_naira: "30,000" }).success).toBe(true);
    expect(salarySchema.safeParse({ ...salary, monthly_gross_naira: "50,000,000" }).success).toBe(true);
  });

  it("rejects non-numbers and missing amounts", () => {
    for (const bad of ["", "two hundred", "250k"]) expect(salarySchema.safeParse({ ...salary, monthly_gross_naira: bad }).success).toBe(false);
  });

  it("treats 'None' as an empty list, and won't mix it with benefits", () => {
    expect(salarySchema.parse({ ...salary, other_benefits: ["none"] }).other_benefits).toEqual([]);
    expect(salarySchema.parse({ ...salary, other_benefits: [] }).other_benefits).toEqual([]);
    expect(salarySchema.safeParse({ ...salary, other_benefits: ["none", "hmo"] }).success).toBe(false);
    expect(salarySchema.safeParse({ ...salary, other_benefits: ["car"] }).success).toBe(false);
  });
});

describe("interviewSchema", () => {
  const interview = {
    role_group: "sales_marketing",
    outcome: "ghosted",
    difficulty: "3",
    process_weeks: "",
    stages: ["phone_call", "panel"],
    questions_asked: "Tell us about yourself.",
    tips: "  ",
    experience: "negative",
  };
  it("accepts a valid report and turns blanks into nulls", () => {
    const r = interviewSchema.parse(interview);
    expect(r.difficulty).toBe(3);
    expect(r.process_weeks).toBeNull();
    expect(r.tips).toBeNull();
  });
  it("rejects bad values", () => {
    expect(interviewSchema.safeParse({ ...interview, difficulty: "6" }).success).toBe(false);
    expect(interviewSchema.safeParse({ ...interview, process_weeks: "53" }).success).toBe(false);
    expect(interviewSchema.safeParse({ ...interview, stages: ["coffee chat"] }).success).toBe(false);
    expect(interviewSchema.safeParse({ ...interview, questions_asked: "short" }).success).toBe(false);
    expect(interviewSchema.safeParse({ ...interview, outcome: "hired" }).success).toBe(false);
  });
});

describe("formDataToObject", () => {
  it("keeps checkbox fields as arrays, even when none are ticked", () => {
    const fd = new FormData();
    fd.append("level", "mid");
    fd.append("other_benefits", "hmo");
    fd.append("other_benefits", "housing");
    expect(formDataToObject(fd, ["other_benefits", "stages"])).toEqual({ level: "mid", other_benefits: ["hmo", "housing"], stages: [] });
  });
});

describe("lists match the database", () => {
  it("benefits and stages in TS match the migration", () => {
    for (const k of Object.keys(BENEFITS)) expect(migration).toContain(`'${k}'`);
    for (const k of Object.keys(INTERVIEW_STAGES)) expect(migration).toContain(`'${k}'`);
    expect(migration).toContain("between 30000 and 50000000");
  });
});
