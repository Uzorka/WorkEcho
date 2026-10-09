import { execFileSync } from "node:child_process";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { adminClient, anonClient, createContributor, createTestCompany, deleteTestUser, reviewInput, type TestUser } from "./helpers";

// Slice 6: verified checkmark. Rule 10: earned ONLY by passing verification.

const PERMISSION_DENIED = "42501";
const DB_URL = process.env.SUPABASE_DB_URL ?? "postgresql://postgres:postgres@127.0.0.1:54322/postgres";
const sql = (q: string) => execFileSync("psql", [DB_URL, "-tAc", q], { encoding: "utf8" }).trim();

const service = adminClient();
const users: TestUser[] = [];
const companies: string[] = [];
const DOMAIN = "verifytest.example";

async function contributor() {
  const u = await createContributor(service);
  users.push(u);
  return u;
}

async function company(domains: string[] = [DOMAIN]) {
  const co = await createTestCompany(service);
  companies.push(co.id);
  await service.from("companies").update({ email_domains: domains }).eq("id", co.id);
  return co;
}

/** What the server does after checking the email: create a code (service role only). */
const challenge = (u: TestUser, companyId: string, code = "123456", domain = DOMAIN) =>
  service.rpc("create_verification_challenge", { p_user_id: u.id, p_company_id: companyId, p_email_domain: domain, p_code: code });
const confirm = (u: TestUser, code: string) => u.client.rpc("confirm_company_verification", { p_code: code });

async function verify(u: TestUser, companyId: string) {
  expect((await challenge(u, companyId)).data).toBe("sent");
  expect((await confirm(u, "123456")).data.status).toBe("verified");
}

async function profileIsVerified(u: TestUser) {
  const { data: p } = await service.from("profiles").select("pseudonym").eq("id", u.id).single();
  const { data } = await anonClient().from("public_profiles").select("*").eq("pseudonym", p!.pseudonym).single();
  return data!;
}

afterAll(async () => {
  await service.from("posts").delete().in("author_id", users.map((u) => u.id));
  await service.from("companies").delete().in("id", companies);
  await Promise.all(users.map((u) => deleteTestUser(service, u)));
});

describe("no way to get a checkmark without passing verification", () => {
  let a: TestUser, mod: TestUser;
  let co: { id: string };

  beforeAll(async () => {
    [a, mod] = [await contributor(), await contributor()];
    await service.from("profiles").update({ is_admin: true }).eq("id", mod.id);
    co = await company();
  });

  it("users (and admins) can't write the verifications table", async () => {
    for (const u of [a, mod]) {
      const ins = await u.client.from("verifications").insert({ user_id: u.id, company_id: co.id, expires_at: "2099-01-01" });
      expect(ins.error?.code).toBe(PERMISSION_DENIED);
    }
    expect((await anonClient().from("verifications").select("id")).error?.code).toBe(PERMISSION_DENIED);
  });

  it("users (and admins) can't create codes for themselves; only the server can", async () => {
    for (const u of [a, mod]) {
      const { error } = await u.client.rpc("create_verification_challenge", { p_user_id: u.id, p_company_id: co.id, p_email_domain: DOMAIN, p_code: "111111" });
      expect(error).not.toBeNull();
    }
    expect((await anonClient().rpc("confirm_company_verification", { p_code: "123456" })).error).not.toBeNull();
  });

  it("confirming with no code requested does nothing", async () => {
    expect((await confirm(a, "123456")).data.status).toBe("expired");
    expect((await a.client.from("verifications").select("id")).data).toEqual([]);
  });

  it("only confirm_company_verification() can create or re-activate a verification; there is no admin grant", () => {
    const writers = sql(
      `select string_agg(proname, ',' order by proname) from pg_proc where pronamespace = 'public'::regnamespace
         and (prosrc ilike '%insert into public.verifications%' or prosrc ~* '(set|,)\\s*status\\s*=\\s*''active''')`,
    );
    expect(writers).toBe("confirm_company_verification");
    const adminFns = sql(`select string_agg(proname, ',' order by proname) from pg_proc where pronamespace = 'public'::regnamespace and proname ilike '%verif%' and proname like 'admin_%'`);
    expect(adminFns).toBe("admin_revoke_verification,admin_verifications");
  });

  it("is_verified can't be set on content by users", async () => {
    const { error } = await a.client.from("reviews").insert({ ...reviewInput(co.id), is_verified: true });
    expect(error?.code).toBe(PERMISSION_DENIED);
  });
});

describe("the code", () => {
  it("rejects free and non-matching domains", async () => {
    const u = await contributor();
    const co = await company();
    expect((await challenge(u, co.id, "123456", "gmail.com")).data).toBe("free_domain");
    expect((await challenge(u, co.id, "123456", "other-company.example")).data).toBe("wrong_domain");
    expect((await challenge(u, co.id, "123456", `notverifytest.example`)).data).toBe("wrong_domain");
    expect((await challenge(u, co.id, "123456", `hr.${DOMAIN}`)).data).toBe("sent");
  });

  it("is stored only as a hash, with expiry and attempts; no email column anywhere", async () => {
    const u = await contributor();
    const co = await company();
    await challenge(u, co.id, "654321");
    const cols = sql(`select string_agg(column_name, ',' order by column_name) from information_schema.columns where table_schema='public' and table_name='verification_challenges'`);
    expect(cols).toBe("attempts,code_hash,company_id,created_at,expires_at,id,used_at,user_id");
    const hash = sql(`select code_hash from public.verification_challenges where user_id = '${u.id}'`);
    expect(hash).not.toContain("654321");
    expect(hash).toMatch(/^\$2[aby]\$/); // bcrypt
    const emailCols = sql(`select string_agg(table_name || '.' || column_name, ',') from information_schema.columns where table_schema='public' and column_name ilike '%email%'`);
    expect(emailCols).toBe("companies.email_domains");
  });

  it("expires after 15 minutes", async () => {
    const u = await contributor();
    const co = await company();
    await challenge(u, co.id);
    const minutes = Number(sql(`select round(extract(epoch from expires_at - created_at) / 60) from public.verification_challenges where user_id = '${u.id}'`));
    expect(minutes).toBe(15);
    sql(`update public.verification_challenges set expires_at = now() - interval '1 second' where user_id = '${u.id}'`);
    expect((await confirm(u, "123456")).data.status).toBe("expired");
    expect((await u.client.from("verifications").select("id")).data).toEqual([]);
  });

  it("allows at most 5 tries, then even the right code fails", async () => {
    const u = await contributor();
    const co = await company();
    await challenge(u, co.id);
    for (let left = 4; left >= 1; left--) expect((await confirm(u, "000000")).data).toEqual({ status: "wrong_code", attempts_left: left });
    expect((await confirm(u, "000000")).data.status).toBe("too_many_attempts");
    expect((await confirm(u, "123456")).data.status).toBe("too_many_attempts");
    expect((await u.client.from("verifications").select("id")).data).toEqual([]);
  });

  it("3 attempts (codes) per account per day", async () => {
    const u = await contributor();
    const co = await company();
    for (let i = 0; i < 3; i++) expect((await challenge(u, co.id)).data).toBe("sent");
    expect((await challenge(u, co.id)).data).toBe("too_many");
  });

  it("only the newest code works", async () => {
    const u = await contributor();
    const co = await company();
    await challenge(u, co.id, "111111");
    await challenge(u, co.id, "222222");
    expect((await confirm(u, "111111")).data.status).toBe("wrong_code");
    expect((await confirm(u, "222222")).data.status).toBe("verified");
  });
});

describe("the checkmark", () => {
  it("shows on the profile, posts and replies, never which company", async () => {
    const u = await contributor();
    const co = await company();
    expect(await profileIsVerified(u)).toMatchObject({ is_verified: false });
    await verify(u, co.id);
    const profile = await profileIsVerified(u);
    expect(profile.is_verified).toBe(true);
    expect(Object.keys(profile).sort()).toEqual(["is_verified", "pseudonym"]);

    const { data: post } = await u.client.from("posts").insert({ category: "general", body: "Verified post" }).select("id").single();
    const { data: row } = await anonClient().from("public_posts").select("*").eq("id", post!.id).single();
    expect(row!.author_is_verified).toBe(true);
    expect(JSON.stringify(row)).not.toContain(co.id);
    // Users see their own row (for /me), but never the user_id column.
    const { data: own } = await u.client.from("verifications").select("company_id, status");
    expect(own).toEqual([{ company_id: co.id, status: "active" }]);
    expect((await u.client.from("verifications").select("user_id")).error?.code).toBe(PERMISSION_DENIED);
    // 12 months
    const months = Number(sql(`select round(extract(epoch from expires_at - verified_at) / 86400 / 30.4) from public.verifications where user_id = '${u.id}'`));
    expect(months).toBe(12);
  });

  it("expired verifications remove the checkmark", async () => {
    const u = await contributor();
    const co = await company();
    await verify(u, co.id);
    sql(`update public.verifications set expires_at = now() - interval '1 second' where user_id = '${u.id}'`);
    expect((await profileIsVerified(u)).is_verified).toBe(false);
    // Renewing works again once expired.
    expect((await challenge(u, co.id)).data).toBe("sent");
    expect((await confirm(u, "123456")).data.status).toBe("verified");
    expect((await profileIsVerified(u)).is_verified).toBe(true);
  });

  it("renewal opens only in the last 30 days", async () => {
    const u = await contributor();
    const co = await company();
    await verify(u, co.id);
    expect((await challenge(u, co.id)).data).toBe("already_verified");
    sql(`update public.verifications set expires_at = now() + interval '20 days' where user_id = '${u.id}'`);
    expect((await challenge(u, co.id)).data).toBe("sent");
  });

  it("admins can revoke (logged); revoked users can't re-verify; non-admins can't revoke", async () => {
    const u = await contributor();
    const mod = await contributor();
    await service.from("profiles").update({ is_admin: true }).eq("id", mod.id);
    const co = await company();
    await verify(u, co.id);
    const { data: rev } = await u.client.from("reviews").insert(reviewInput(co.id)).select("id").single();
    expect(sql(`select is_verified from public.reviews where id = '${rev!.id}'`)).toBe("t");
    const id = sql(`select id from public.verifications where user_id = '${u.id}'`);

    expect((await u.client.rpc("admin_revoke_verification", { p_id: id })).error?.code).toBe(PERMISSION_DENIED);
    expect((await mod.client.rpc("admin_revoke_verification", { p_id: id, p_note: "Shared code" })).error).toBeNull();
    expect((await profileIsVerified(u)).is_verified).toBe(false);
    expect(sql(`select is_verified from public.reviews where id = '${rev!.id}'`)).toBe("f");
    expect(sql(`select action || '|' || note from public.admin_actions where target_id = '${id}'`)).toBe("verification_revoke|Shared code");
    expect((await challenge(u, co.id)).data).toBe("revoked");
  });

  it("banning a user revokes their checkmarks automatically", async () => {
    const u = await contributor();
    const mod = await contributor();
    await service.from("profiles").update({ is_admin: true }).eq("id", mod.id);
    const co = await company();
    await verify(u, co.id);
    await mod.client.rpc("admin_set_user", { p_user_id: u.id, p_action: "ban" });
    expect(sql(`select status from public.verifications where user_id = '${u.id}'`)).toBe("revoked");
    expect((await profileIsVerified(u)).is_verified).toBe(false);
  });
});

describe("verified content counts more", () => {
  let a: TestUser, b: TestUser, c: TestUser;
  let co: { id: string };
  const stats = async () => (await anonClient().from("company_stats").select("*").eq("company_id", co.id).single()).data!;
  const publish = (table: string) => sql(`update public.${table} set publish_at = now() - interval '1 hour' where company_id = '${co.id}'`);

  beforeAll(async () => {
    [a, b, c] = [await contributor(), await contributor(), await contributor()];
    co = await company();
  });

  it("a review written BEFORE verifying becomes verified", async () => {
    await a.client.from("reviews").insert(reviewInput(co.id, { rating_overall: 5, salary_on_time: "yes" }));
    expect(sql(`select is_verified from public.reviews where author_id = '${a.id}'`)).toBe("f");
    await verify(a, co.id);
    expect(sql(`select is_verified from public.reviews where author_id = '${a.id}'`)).toBe("t");
  });

  it("thresholds use the plain count: 2 reviews still show no rating", async () => {
    await b.client.from("reviews").insert(reviewInput(co.id, { rating_overall: 2, salary_on_time: "no" }));
    publish("reviews");
    expect(await stats()).toMatchObject({ review_count: 2, verified_review_count: 1, avg_overall: null, salary_on_time_yes_pct: null });
  });

  it("weighted averages and percentages: verified counts twice", async () => {
    await c.client.from("reviews").insert(reviewInput(co.id, { rating_overall: 2, salary_on_time: "no" }));
    publish("reviews");
    const s = await stats();
    // (5*2 + 2 + 2) / (2 + 1 + 1) = 3.5   (unweighted would be 3.0)
    expect(Number(s.avg_overall)).toBe(3.5);
    // yes-weight 2 / total weight 4 = 50%  (unweighted would be 33%)
    expect(s.salary_on_time_yes_pct).toBe(50);
    expect(s.review_count).toBe(3);
    expect(s.verified_review_count).toBe(1);
  });

  it("verified reviews come first, and can be filtered", async () => {
    const lowest = await anonClient().rpc("company_reviews", { p_company_id: co.id, p_sort: "lowest" });
    expect(lowest.data!.map((r: { rating_overall: number; is_verified: boolean }) => [r.rating_overall, r.is_verified])).toEqual([
      [5, true],
      [2, false],
      [2, false],
    ]);
    const only = await anonClient().rpc("company_reviews", { p_company_id: co.id, p_verified_only: true });
    expect(only.data).toHaveLength(1);
    for (const r of lowest.data!) expect(r).not.toHaveProperty("author_id");
  });

  it("salary ranges show how many reports are verified", async () => {
    for (const [u, pay] of [[a, 300000], [b, 320000], [c, 350000]] as const)
      await u.client.from("salary_reports").insert({ company_id: co.id, role_group: "tech_it", level: "mid", employment_type: "full_time", monthly_gross_naira: pay, has_bonus: false });
    publish("salary_reports");
    const { data } = await anonClient().from("company_salary_stats").select("report_count, verified_count").eq("company_id", co.id).single();
    expect(data).toEqual({ report_count: 3, verified_count: 1 });
  });

  it("interview reports: verified first", async () => {
    for (const u of [b, a])
      await u.client.from("interview_reports").insert({ company_id: co.id, role_group: "tech_it", outcome: "offer", difficulty: 3, questions_asked: "Tell us about yourself.", experience: "positive" });
    publish("interview_reports");
    const { data } = await anonClient().rpc("company_interviews", { p_company_id: co.id });
    expect(data!.map((r: { is_verified: boolean }) => r.is_verified)).toEqual([true, false]);
  });

  it("'Top this week': verified authors get a +1 boost (rank_score)", async () => {
    const tag = await company();
    const { data: p1 } = await b.client.from("posts").insert({ category: "general", body: "Unverified author", company_id: tag.id }).select("id").single();
    const { data: p2 } = await a.client.from("posts").insert({ category: "general", body: "Verified author", company_id: tag.id }).select("id").single();
    sql(`update public.posts set created_at = now() - interval '1 hour' where id = '${p2!.id}'`); // older, so it only wins on score
    const { data } = await anonClient().rpc("feed_posts", { p_sort: "top", p_company_id: tag.id });
    expect(data!.map((r: { id: string; rank_score: number }) => [r.id, r.rank_score])).toEqual([
      [p2!.id, 1],
      [p1!.id, 0],
    ]);
  });

  it("verified users get double posting limits (10 posts an hour)", async () => {
    const v = await contributor();
    const co2 = await company();
    await verify(v, co2.id);
    for (let i = 0; i < 10; i++) expect((await v.client.from("posts").insert({ category: "general", body: `v${i}` })).error).toBeNull();
    const extra = await v.client.from("posts").insert({ category: "general", body: "v11" });
    expect(extra.error?.code).toBe("P0429");
    expect(extra.error?.message).toMatch(/up to 10 posts an hour/);
  });
});
