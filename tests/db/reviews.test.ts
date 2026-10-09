import { afterAll, beforeAll, describe, expect, it } from "vitest";
import {
  adminClient,
  anonClient,
  createContributor,
  createTestCompany,
  createTestUser,
  deleteTestUser,
  reviewInput,
  type TestUser,
} from "./helpers";

// Permission and visibility rules for companies, reviews, votes and requests.
// Actors: anonymous visitor, users A/B/C/D, an admin, and a not-onboarded user.

const PERMISSION_DENIED = "42501";
const UNIQUE_VIOLATION = "23505";
const admin = adminClient();
const users: TestUser[] = [];
let a: TestUser, b: TestUser, c: TestUser, d: TestUser, adminUser: TestUser;
let company: { id: string; slug: string; name: string };
let pending: { id: string; slug: string; name: string };
const extraCompanies: string[] = [];

async function publishNow(reviewId: string) {
  const { error } = await admin.from("reviews").update({ publish_at: new Date(Date.now() - 3600_000).toISOString() }).eq("id", reviewId);
  if (error) throw error;
}

async function write(user: TestUser, companyId: string, overrides: Record<string, unknown> = {}) {
  const { data, error } = await user.client.from("reviews").insert(reviewInput(companyId, overrides)).select("id").single();
  if (error) throw error;
  return data.id as string;
}

async function stats(companyId: string) {
  const { data } = await anonClient().from("company_stats").select("*").eq("company_id", companyId).single();
  return data!;
}

beforeAll(async () => {
  [a, b, c, d, adminUser] = await Promise.all([1, 2, 3, 4, 5].map(() => createContributor(admin)));
  users.push(a, b, c, d, adminUser);
  await admin.from("profiles").update({ is_admin: true }).eq("id", adminUser.id);
  company = await createTestCompany(admin);
  pending = await createTestCompany(admin, "pending");
});

afterAll(async () => {
  await admin.from("companies").delete().in("id", [company.id, pending.id, ...extraCompanies]);
  await admin.from("company_requests").delete().like("name", "Zz Test%");
  await Promise.all(users.map((u) => deleteTestUser(admin, u)));
});

describe("companies", () => {
  it("anyone can read active companies but not pending ones", async () => {
    const anon = anonClient();
    expect((await anon.from("companies").select("id").eq("id", company.id)).data).toHaveLength(1);
    expect((await anon.from("companies").select("id").eq("id", pending.id)).data).toEqual([]);
    expect((await a.client.from("companies").select("id").eq("id", pending.id)).data).toEqual([]);
  });

  it("users can't create or edit companies", async () => {
    expect((await a.client.from("companies").insert({ name: "Mine", slug: "mine", industry: "Other" })).error?.code).toBe(PERMISSION_DENIED);
    expect((await a.client.from("companies").update({ name: "Renamed" }).eq("id", company.id)).error?.code).toBe(PERMISSION_DENIED);
    expect((await anonClient().from("companies").delete().eq("id", company.id)).error?.code).toBe(PERMISSION_DENIED);
  });
});

describe("writing reviews", () => {
  let reviewA: string;

  it("new reviews are hidden until publish_at (12–72h later)", async () => {
    reviewA = await write(a, company.id);
    const { data: row } = await admin.from("reviews").select("publish_at, created_at, status").eq("id", reviewA).single();
    const delayHours = (Date.parse(row!.publish_at) - Date.parse(row!.created_at)) / 3600_000;
    expect(delayHours).toBeGreaterThanOrEqual(12);
    expect(delayHours).toBeLessThanOrEqual(72);
    expect(row!.status).toBe("published");

    expect((await anonClient().from("public_reviews").select("id").eq("id", reviewA)).data).toEqual([]);
    expect((await anonClient().rpc("company_reviews", { p_company_id: company.id })).data).toEqual([]);
    expect((await stats(company.id)).review_count).toBe(0);
  });

  it("blocks a second review of the same company by the same user", async () => {
    const { error } = await a.client.from("reviews").insert(reviewInput(company.id));
    expect(error?.code).toBe(UNIQUE_VIOLATION);
  });

  it("users can't set author_id, status or publish_at", async () => {
    for (const extra of [{ author_id: b.id }, { status: "hidden" }, { publish_at: new Date(0).toISOString() }]) {
      const { error } = await c.client.from("reviews").insert(reviewInput(company.id, extra));
      expect(error?.code).toBe(PERMISSION_DENIED);
    }
    for (const change of [{ status: "published" }, { publish_at: new Date(0).toISOString() }, { company_id: pending.id }]) {
      const { error } = await a.client.from("reviews").update(change).eq("id", reviewA);
      expect(error?.code).toBe(PERMISSION_DENIED);
    }
  });

  it("can't review a pending company, and anonymous visitors can't review at all", async () => {
    expect((await b.client.from("reviews").insert(reviewInput(pending.id))).error?.code).toBe(PERMISSION_DENIED);
    expect((await anonClient().from("reviews").insert(reviewInput(company.id))).error?.code).toBe(PERMISSION_DENIED);
  });

  it("users who haven't finished onboarding, or are banned, can't review", async () => {
    const fresh = await createTestUser(admin);
    users.push(fresh);
    const { ensureProfile } = await import("@/lib/profile-service");
    await ensureProfile(admin, fresh.id);
    expect((await fresh.client.from("reviews").insert(reviewInput(company.id))).error?.code).toBe(PERMISSION_DENIED);

    await admin.from("profiles").update({ is_banned: true }).eq("id", d.id);
    expect((await d.client.from("reviews").insert(reviewInput(company.id))).error?.code).toBe(PERMISSION_DENIED);
    await admin.from("profiles").update({ is_banned: false }).eq("id", d.id);
  });

  it("A can edit and read their own review, without seeing author_id", async () => {
    const { data, error } = await a.client.from("reviews").update({ headline: "Edited headline" }).eq("id", reviewA).select("headline");
    expect(error).toBeNull();
    expect(data).toEqual([{ headline: "Edited headline" }]);
    expect((await a.client.from("reviews").select("author_id").eq("id", reviewA)).error?.code).toBe(PERMISSION_DENIED);
    expect((await a.client.from("reviews").select("publish_at").eq("id", reviewA)).error?.code).toBe(PERMISSION_DENIED);
  });

  it("user B can't read, edit or delete user A's review", async () => {
    expect((await b.client.from("reviews").select("id").eq("id", reviewA)).data).toEqual([]);
    const upd = await b.client.from("reviews").update({ headline: "Hijacked!" }).eq("id", reviewA).select("id");
    expect(upd.data ?? []).toEqual([]);
    const del = await b.client.from("reviews").delete().eq("id", reviewA).select("id");
    expect(del.data ?? []).toEqual([]);
    const { data } = await admin.from("reviews").select("headline").eq("id", reviewA).single();
    expect(data!.headline).toBe("Edited headline");
  });

  it("an admin can't read or edit other people's reviews from the browser either", async () => {
    expect((await adminUser.client.from("reviews").select("id").eq("id", reviewA)).data).toEqual([]);
    expect((await adminUser.client.from("reviews").update({ headline: "Admin edit" }).eq("id", reviewA).select("id")).data ?? []).toEqual([]);
  });

  it("a removed review can't be edited by its author", async () => {
    const co = await createTestCompany(admin);
    extraCompanies.push(co.id);
    const id = await write(b, co.id);
    await admin.from("reviews").update({ status: "removed" }).eq("id", id);
    expect((await b.client.from("reviews").update({ headline: "Sneaky edit" }).eq("id", id).select("id")).data ?? []).toEqual([]);
  });

  it("A can delete their own review", async () => {
    const co = await createTestCompany(admin);
    extraCompanies.push(co.id);
    const id = await write(a, co.id);
    expect((await a.client.from("reviews").delete().eq("id", id).select("id")).data).toEqual([{ id }]);
  });
});

describe("public view and thresholds", () => {
  let co: { id: string };
  const ids: string[] = [];

  beforeAll(async () => {
    co = await createTestCompany(admin);
    extraCompanies.push(co.id);
  });

  it("2 visible reviews: count shown, no rating or percentages", async () => {
    for (const [u, rating] of [[a, 5], [b, 3]] as const) {
      const id = await write(u, co.id, { rating_overall: rating, salary_on_time: "yes" });
      await publishNow(id);
      ids.push(id);
    }
    const s = await stats(co.id);
    expect(s.review_count).toBe(2);
    expect(s.avg_overall).toBeNull();
    expect(s.avg_pay).toBeNull();
    expect(s.salary_on_time_yes_pct).toBeNull();
    expect(s.salary_on_time_answers).toBe(2);
  });

  it("3 visible reviews: rating and percentages shown", async () => {
    const id = await write(c, co.id, { rating_overall: 1, salary_on_time: "no" });
    await publishNow(id);
    ids.push(id);
    const s = await stats(co.id);
    expect(s.review_count).toBe(3);
    expect(Number(s.avg_overall)).toBe(3);
    expect(s.salary_on_time_yes_pct).toBe(67);
  });

  it("hidden and removed reviews don't count", async () => {
    await admin.from("reviews").update({ status: "hidden" }).eq("id", ids[2]);
    expect((await stats(co.id)).avg_overall).toBeNull();
    await admin.from("reviews").update({ status: "published" }).eq("id", ids[2]);
  });

  it("public_reviews never returns author_id or exact dates", async () => {
    for (const client of [anonClient(), a.client, adminUser.client]) {
      const { data, error } = await client.from("public_reviews").select("*").eq("company_id", co.id);
      expect(error).toBeNull();
      expect(data).toHaveLength(3);
      for (const row of data!) {
        expect(row).not.toHaveProperty("author_id");
        expect(row).not.toHaveProperty("publish_at");
        expect(row).not.toHaveProperty("created_at");
        expect(row).not.toHaveProperty("updated_at");
        expect(row.published_quarter).toMatch(/^Q[1-4] \d{4}$/);
        expect(JSON.stringify(row)).not.toMatch(/\d{4}-\d{2}-\d{2}/);
        for (const u of [a, b, c]) expect(JSON.stringify(row)).not.toContain(u.id);
      }
      expect((await client.from("public_reviews").select("author_id")).error).not.toBeNull();
    }
    const rpc = await anonClient().rpc("company_reviews", { p_company_id: co.id });
    for (const row of rpc.data!) expect(row).not.toHaveProperty("author_id");
  });

  it("anonymous visitors can't read the reviews base table", async () => {
    expect((await anonClient().from("reviews").select("id")).error?.code).toBe(PERMISSION_DENIED);
  });

  it("sorts reviews by rating", async () => {
    const low = await anonClient().rpc("company_reviews", { p_company_id: co.id, p_sort: "lowest" });
    expect(low.data!.map((r: { rating_overall: number }) => r.rating_overall)).toEqual([1, 3, 5]);
    const high = await anonClient().rpc("company_reviews", { p_company_id: co.id, p_sort: "highest" });
    expect(high.data!.map((r: { rating_overall: number }) => r.rating_overall)).toEqual([5, 3, 1]);
  });

  describe("helpful votes", () => {
    it("a vote only counts once", async () => {
      const target = ids[0]; // A's review
      expect((await b.client.from("review_helpful").insert({ review_id: target })).error).toBeNull();
      expect((await b.client.from("review_helpful").insert({ review_id: target })).error?.code).toBe(UNIQUE_VIOLATION);
      expect((await c.client.from("review_helpful").insert({ review_id: target })).error).toBeNull();
      const { data } = await anonClient().from("public_reviews").select("helpful_count").eq("id", target).single();
      expect(data!.helpful_count).toBe(2);
      const top = await anonClient().rpc("company_reviews", { p_company_id: co.id, p_sort: "helpful" });
      expect(top.data![0].id).toBe(target);
    });

    it("can't vote for your own review, a hidden review, or as someone else", async () => {
      expect((await a.client.from("review_helpful").insert({ review_id: ids[0] })).error?.code).toBe(PERMISSION_DENIED);
      await admin.from("reviews").update({ status: "hidden" }).eq("id", ids[1]);
      expect((await c.client.from("review_helpful").insert({ review_id: ids[1] })).error?.code).toBe(PERMISSION_DENIED);
      await admin.from("reviews").update({ status: "published" }).eq("id", ids[1]);
      expect((await d.client.from("review_helpful").insert({ review_id: ids[1], user_id: a.id })).error?.code).toBe(PERMISSION_DENIED);
      expect((await anonClient().from("review_helpful").insert({ review_id: ids[1] })).error?.code).toBe(PERMISSION_DENIED);
    });

    it("users see only their own votes, without user ids, and can remove them", async () => {
      expect((await b.client.from("review_helpful").select("review_id")).data).toEqual([{ review_id: ids[0] }]);
      expect((await b.client.from("review_helpful").select("user_id")).error?.code).toBe(PERMISSION_DENIED);
      expect((await anonClient().from("review_helpful").select("review_id")).error?.code).toBe(PERMISSION_DENIED);
      // C can't remove B's vote.
      await c.client.from("review_helpful").delete().eq("review_id", ids[0]);
      await b.client.from("review_helpful").delete().eq("review_id", ids[0]);
      const { data } = await anonClient().from("public_reviews").select("helpful_count").eq("id", ids[0]).single();
      expect(data!.helpful_count).toBe(0);
    });
  });

  it("when the author deletes their account, the review stays (author_id becomes null)", async () => {
    const e = await createContributor(admin);
    const id = await write(e, co.id);
    await admin.auth.admin.deleteUser(e.id);
    const { data } = await admin.from("reviews").select("author_id").eq("id", id).single();
    expect(data!.author_id).toBeNull();
  });
});

describe("company requests", () => {
  it("rejects near-duplicates of existing companies", async () => {
    const { data } = await a.client.rpc("request_company", { p_name: `${company.name.toUpperCase()} Ltd.`, p_industry: "Other" });
    expect(data.status).toBe("duplicate");
    expect(data.matches[0].slug).toBe(company.slug);
  });

  it("accepts a new company, then treats a similar request as already queued", async () => {
    const first = await a.client.rpc("request_company", { p_name: "Zz Test Brandnew Widgets", p_industry: "Other", p_state: "Kano" });
    expect(first.data.status).toBe("created");
    const again = await b.client.rpc("request_company", { p_name: "ZZ Test Brand-new Widgets Nigeria Limited", p_industry: "Other" });
    expect(again.data.status).toBe("already_requested");
  });

  it("users see only their own requests, never the requester id", async () => {
    expect((await a.client.from("company_requests").select("name")).data).toEqual([{ name: "Zz Test Brandnew Widgets" }]);
    expect((await b.client.from("company_requests").select("name")).data).toEqual([]);
    expect((await a.client.from("company_requests").select("requester_id")).error?.code).toBe(PERMISSION_DENIED);
    expect((await a.client.from("company_requests").insert({ name: "Direct", industry: "Other" })).error?.code).toBe(PERMISSION_DENIED);
  });

  it("validates input and blocks anonymous visitors", async () => {
    expect((await a.client.rpc("request_company", { p_name: "Zz Test Ok", p_industry: "Space" })).data.status).toBe("invalid");
    expect((await anonClient().rpc("request_company", { p_name: "Zz Test Anon", p_industry: "Other" })).error).not.toBeNull();
  });
});
