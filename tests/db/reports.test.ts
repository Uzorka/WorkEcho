import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { ensureProfile } from "@/lib/profile-service";
import { adminClient, anonClient, createContributor, createTestCompany, createTestUser, deleteTestUser, type TestUser } from "./helpers";

// Salary and interview reports: thresholds, rounding, privacy and permissions.

const PERMISSION_DENIED = "42501";
const UNIQUE_VIOLATION = "23505";
const CHECK_VIOLATION = "23514";
const admin = adminClient();
const users: TestUser[] = [];
const companies: string[] = [];

function salary(companyId: string, overrides: Record<string, unknown> = {}) {
  return {
    company_id: companyId,
    role_group: "tech_it",
    level: "mid",
    employment_type: "full_time",
    monthly_gross_naira: 200000,
    has_bonus: false,
    other_benefits: ["hmo"],
    ...overrides,
  };
}

function interview(companyId: string, overrides: Record<string, unknown> = {}) {
  return {
    company_id: companyId,
    role_group: "sales_marketing",
    outcome: "offer",
    difficulty: 3,
    process_weeks: 4,
    stages: ["phone_call", "panel"],
    questions_asked: "Tell us about a target you beat.",
    experience: "positive",
    ...overrides,
  };
}

async function contributors(n: number) {
  const list = await Promise.all(Array.from({ length: n }, () => createContributor(admin)));
  users.push(...list);
  return list;
}

async function company() {
  const c = await createTestCompany(admin);
  companies.push(c.id);
  return c;
}

/** Inserts as the user, then (as admin) makes it visible now. */
async function publishedSalary(u: TestUser, companyId: string, overrides: Record<string, unknown> = {}) {
  const { data, error } = await u.client.from("salary_reports").insert(salary(companyId, overrides)).select("id").single();
  if (error) throw error;
  await admin.from("salary_reports").update({ publish_at: new Date(Date.now() - 3600_000).toISOString() }).eq("id", data.id);
  return data.id as string;
}

async function publishedInterview(u: TestUser, companyId: string, overrides: Record<string, unknown> = {}) {
  const { data, error } = await u.client.from("interview_reports").insert(interview(companyId, overrides)).select("id").single();
  if (error) throw error;
  await admin.from("interview_reports").update({ publish_at: new Date(Date.now() - 3600_000).toISOString() }).eq("id", data.id);
  return data.id as string;
}

async function salaryStats(companyId: string) {
  const { data, error } = await anonClient().from("company_salary_stats").select("*").eq("company_id", companyId);
  if (error) throw error;
  return data;
}

afterAll(async () => {
  await admin.from("companies").delete().in("id", companies);
  await Promise.all(users.map((u) => deleteTestUser(admin, u)));
});

describe("salary thresholds and rounding", () => {
  let a: TestUser, b: TestUser, c: TestUser, d: TestUser;
  let co: { id: string };

  beforeAll(async () => {
    [a, b, c, d] = await contributors(4);
    co = await company();
  });

  it("a role + level with 2 reports is hidden", async () => {
    await publishedSalary(a, co.id, { monthly_gross_naira: 101_000 });
    await publishedSalary(b, co.id, { monthly_gross_naira: 154_999 });
    expect(await salaryStats(co.id)).toEqual([]);
  });

  it("with 3 reports it shows median and range, rounded to the nearest ₦10,000", async () => {
    await publishedSalary(c, co.id, { monthly_gross_naira: 265_000 });
    const rows = await salaryStats(co.id);
    expect(rows).toEqual([
      {
        company_id: co.id,
        role_group: "tech_it",
        level: "mid",
        report_count: 3,
        median_naira: 150_000, // 154,999
        lowest_naira: 100_000, // 101,000
        highest_naira: 270_000, // 265,000 (halves round up)
        verified_count: 0,
      },
    ]);
  });

  it("median of an even count is the midpoint, then rounded", async () => {
    await publishedSalary(d, co.id, { monthly_gross_naira: 100_000 });
    // 100,000 / 101,000 / 154,999 / 265,000 -> median 127,999.5 -> 130,000
    expect((await salaryStats(co.id))[0].median_naira).toBe(130_000);
  });

  it("groups are separate: another level with 1 report stays hidden", async () => {
    const [e] = await contributors(1);
    await publishedSalary(e, co.id, { level: "senior", monthly_gross_naira: 900_000 });
    const rows = await salaryStats(co.id);
    expect(rows.map((r) => r.level)).toEqual(["mid"]);
  });

  it("reports not yet published, or hidden by moderators, don't count", async () => {
    const co2 = await company();
    const [p, q, r] = await contributors(3);
    await publishedSalary(p, co2.id);
    await publishedSalary(q, co2.id);
    // r's report keeps its 12–72h delay.
    const { error } = await r.client.from("salary_reports").insert(salary(co2.id));
    expect(error).toBeNull();
    expect(await salaryStats(co2.id)).toEqual([]);
    const { data: row } = await admin.from("salary_reports").select("id, publish_at, created_at").eq("author_id", r.id).single();
    const delay = (Date.parse(row!.publish_at) - Date.parse(row!.created_at)) / 3600_000;
    expect(delay).toBeGreaterThanOrEqual(12);
    expect(delay).toBeLessThanOrEqual(72);
    await admin.from("salary_reports").update({ publish_at: new Date(Date.now() - 1000).toISOString() }).eq("id", row!.id);
    expect(await salaryStats(co2.id)).toHaveLength(1);
    await admin.from("salary_reports").update({ status: "hidden" }).eq("id", row!.id);
    expect(await salaryStats(co2.id)).toEqual([]);
  });
});

describe("salary privacy and permissions", () => {
  let a: TestUser, b: TestUser, adminUser: TestUser;
  let co: { id: string };
  let reportA: string;

  beforeAll(async () => {
    [a, b, adminUser] = await contributors(3);
    await admin.from("profiles").update({ is_admin: true }).eq("id", adminUser.id);
    co = await company();
    reportA = await publishedSalary(a, co.id, { monthly_gross_naira: 333_333 });
  });

  it("nobody can read individual salaries or author ids from the browser", async () => {
    expect((await anonClient().from("salary_reports").select("id")).error?.code).toBe(PERMISSION_DENIED);
    for (const u of [b, adminUser]) {
      const { data } = await u.client.from("salary_reports").select("id, monthly_gross_naira").eq("id", reportA);
      expect(data).toEqual([]);
    }
    expect((await a.client.from("salary_reports").select("author_id")).error?.code).toBe(PERMISSION_DENIED);
    expect((await a.client.from("salary_reports").select("publish_at")).error?.code).toBe(PERMISSION_DENIED);
    // The author can see their own amount (to edit it).
    expect((await a.client.from("salary_reports").select("monthly_gross_naira").eq("id", reportA)).data).toEqual([{ monthly_gross_naira: 333_333 }]);
  });

  it("the public salary view has no author id, no dates and no individual amounts", async () => {
    const { data } = await anonClient().from("company_salary_stats").select("*").limit(5);
    for (const row of data ?? [])
      expect(Object.keys(row).sort()).toEqual(
        ["company_id", "highest_naira", "level", "lowest_naira", "median_naira", "report_count", "role_group", "verified_count"].sort(),
      );
    expect((await anonClient().from("company_salary_stats").select("author_id")).error).not.toBeNull();
    expect((await anonClient().from("company_salary_stats").select("monthly_gross_naira")).error).not.toBeNull();
  });

  it("rejects invalid amounts and unknown benefits", async () => {
    const [x] = await contributors(1);
    for (const amount of [29_999, 50_000_001, 0, -1]) {
      const { error } = await x.client.from("salary_reports").insert(salary(co.id, { monthly_gross_naira: amount }));
      expect(error?.code).toBe(CHECK_VIOLATION);
    }
    expect((await x.client.from("salary_reports").insert(salary(co.id, { other_benefits: ["car"] }))).error?.code).toBe(CHECK_VIOLATION);
    expect((await a.client.from("salary_reports").update({ monthly_gross_naira: 10 }).eq("id", reportA)).error?.code).toBe(CHECK_VIOLATION);
  });

  it("one salary report per user per company", async () => {
    expect((await a.client.from("salary_reports").insert(salary(co.id))).error?.code).toBe(UNIQUE_VIOLATION);
  });

  it("users can't set author_id, status or publish_at", async () => {
    const [x] = await contributors(1);
    for (const extra of [{ author_id: b.id }, { status: "hidden" }, { publish_at: new Date(0).toISOString() }])
      expect((await x.client.from("salary_reports").insert(salary(co.id, extra))).error?.code).toBe(PERMISSION_DENIED);
    expect((await a.client.from("salary_reports").update({ status: "published" }).eq("id", reportA)).error?.code).toBe(PERMISSION_DENIED);
  });

  it("user B can't edit or delete user A's report; A can", async () => {
    expect((await b.client.from("salary_reports").update({ monthly_gross_naira: 999_000 }).eq("id", reportA).select("id")).data ?? []).toEqual([]);
    expect((await b.client.from("salary_reports").delete().eq("id", reportA).select("id")).data ?? []).toEqual([]);
    expect((await adminUser.client.from("salary_reports").delete().eq("id", reportA).select("id")).data ?? []).toEqual([]);
    const { data } = await admin.from("salary_reports").select("monthly_gross_naira").eq("id", reportA).single();
    expect(data!.monthly_gross_naira).toBe(333_333);
    expect((await a.client.from("salary_reports").update({ monthly_gross_naira: 340_000 }).eq("id", reportA).select("id")).data).toEqual([{ id: reportA }]);
    expect((await a.client.from("salary_reports").delete().eq("id", reportA).select("id")).data).toEqual([{ id: reportA }]);
  });

  it("anonymous visitors can't submit", async () => {
    expect((await anonClient().from("salary_reports").insert(salary(co.id))).error?.code).toBe(PERMISSION_DENIED);
  });
});

describe("interview reports", () => {
  let a: TestUser, b: TestUser, c: TestUser;
  let co: { id: string };
  let reportA: string;

  beforeAll(async () => {
    [a, b, c] = await contributors(3);
    co = await company();
  });

  it("job seekers can submit; people who haven't finished onboarding can't", async () => {
    await admin.from("profiles").update({ user_type: "job_seeker" }).eq("id", a.id);
    reportA = await publishedInterview(a, co.id, { outcome: "offer", difficulty: 2, process_weeks: 2 });
    const fresh = await createTestUser(admin);
    users.push(fresh);
    await ensureProfile(admin, fresh.id);
    expect((await fresh.client.from("interview_reports").insert(interview(co.id))).error?.code).toBe(PERMISSION_DENIED);
  });

  it("summary is hidden below 3 reports, then shows % offer, % ghosted, averages", async () => {
    await publishedInterview(b, co.id, { outcome: "ghosted", difficulty: 4, process_weeks: null });
    let { data } = await anonClient().from("company_interview_stats").select("*").eq("company_id", co.id).single();
    expect(data).toMatchObject({ report_count: 2, offer_pct: null, ghosted_pct: null, avg_difficulty: null });

    await publishedInterview(c, co.id, { outcome: "ghosted", difficulty: 3, process_weeks: 6 });
    ({ data } = await anonClient().from("company_interview_stats").select("*").eq("company_id", co.id).single());
    expect(data).toMatchObject({ report_count: 3, offer_pct: 33, ghosted_pct: 67 });
    expect(Number(data!.avg_difficulty)).toBe(3);
    // Only 2 people gave weeks: not enough for an average.
    expect(data!.avg_weeks).toBeNull();
  });

  it("public interview reports have no author id and quarter-only dates", async () => {
    for (const client of [anonClient(), b.client]) {
      const { data, error } = await client.from("public_interview_reports").select("*").eq("company_id", co.id);
      expect(error).toBeNull();
      expect(data).toHaveLength(3);
      for (const row of data!) {
        expect(row).not.toHaveProperty("author_id");
        expect(row).not.toHaveProperty("publish_at");
        expect(row).not.toHaveProperty("created_at");
        expect(row.published_quarter).toMatch(/^Q[1-4] \d{4}$/);
        for (const u of [a, b, c]) expect(JSON.stringify(row)).not.toContain(u.id);
      }
    }
    const rpc = await anonClient().rpc("company_interviews", { p_company_id: co.id });
    expect(rpc.data).toHaveLength(3);
    for (const row of rpc.data!) expect(row).not.toHaveProperty("author_id");
    expect((await anonClient().from("interview_reports").select("id")).error?.code).toBe(PERMISSION_DENIED);
    expect((await a.client.from("interview_reports").select("author_id")).error?.code).toBe(PERMISSION_DENIED);
  });

  it("unpublished interview reports are hidden", async () => {
    const [x] = await contributors(1);
    const { data } = await x.client.from("interview_reports").insert(interview(co.id, { questions_asked: "Unpublished question text" })).select("id").single();
    const { data: visible } = await anonClient().from("public_interview_reports").select("id").eq("id", data!.id);
    expect(visible).toEqual([]);
  });

  it("one interview report per user per company; B can't edit A's", async () => {
    expect((await a.client.from("interview_reports").insert(interview(co.id))).error?.code).toBe(UNIQUE_VIOLATION);
    expect((await b.client.from("interview_reports").update({ difficulty: 5 }).eq("id", reportA).select("id")).data ?? []).toEqual([]);
    const { data } = await admin.from("interview_reports").select("difficulty").eq("id", reportA).single();
    expect(data!.difficulty).toBe(2);
  });

  it("rejects unknown stages and out-of-range values", async () => {
    const [x] = await contributors(1);
    for (const bad of [{ stages: ["coffee"] }, { difficulty: 6 }, { process_weeks: 53 }, { questions_asked: "short" }])
      expect((await x.client.from("interview_reports").insert(interview(co.id, bad))).error?.code).toBe(CHECK_VIOLATION);
  });
});
