import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { adminClient, anonClient, createContributor, createTestCompany, deleteTestUser, reviewInput, type TestUser } from "./helpers";

// Slice 5: admin-only functions, bans, rate limits, reports + auto-hide, contact-detail blocking.

const PERMISSION_DENIED = "42501";
const RATE_LIMITED = "P0429";
const CHECK_VIOLATION = "23514";
const service = adminClient();
const users: TestUser[] = [];
const companies: string[] = [];
let a: TestUser, b: TestUser, c: TestUser, d: TestUser, mod: TestUser;

async function contributors(n: number) {
  const list = await Promise.all(Array.from({ length: n }, () => createContributor(service)));
  users.push(...list);
  return list;
}

async function company() {
  const co = await createTestCompany(service);
  companies.push(co.id);
  return co;
}

/** A post written by `author` through the service role (no rate limit), for tests that need many. */
async function seedPost(author: TestUser, body = "Moderation test post") {
  const { data, error } = await service.from("posts").insert({ author_id: author.id, category: "general", body }).select("id").single();
  if (error) throw error;
  return data.id as string;
}

const status = async (table: string, id: string) => (await service.from(table).select("status").eq("id", id).single()).data!.status;
const report = (u: TestUser, type: string, id: string, reason = "spam", extra: Record<string, unknown> = {}) =>
  u.client.rpc("report_content", { p_type: type, p_id: id, p_reason: reason, ...extra });

beforeAll(async () => {
  [a, b, c, d, mod] = await contributors(5);
  await service.from("profiles").update({ is_admin: true }).eq("id", mod.id);
});

afterAll(async () => {
  const ids = users.map((u) => u.id);
  await service.from("posts").delete().in("author_id", ids);
  await service.from("company_requests").delete().like("name", "Zz Mod Test%");
  await service.from("companies").delete().in("id", companies);
  await Promise.all(users.map((u) => deleteTestUser(service, u)));
});

// ---------------------------------------------------------------- admin access

const ANY_UUID = "00000000-0000-4000-8000-0000000000ff";
const ADMIN_CALLS: [string, Record<string, unknown>][] = [
  ["admin_reports_queue", { p_status: "open" }],
  ["admin_salary_group", { p_company_id: ANY_UUID, p_role_group: "tech_it", p_level: "mid" }],
  ["admin_moderate", { p_type: "post", p_key: ANY_UUID, p_action: "remove" }],
  ["admin_moderate_salary", { p_salary_id: ANY_UUID, p_action: "remove" }],
  ["admin_company_requests", { p_status: "pending" }],
  ["admin_approve_request", { p_request_id: ANY_UUID, p_name: "X", p_industry: "Other" }],
  ["admin_resolve_request", { p_request_id: ANY_UUID, p_action: "reject" }],
  ["admin_companies", { p_query: "" }],
  ["admin_update_company", { p_id: ANY_UUID, p_name: "X", p_industry: "Other", p_state: "", p_city: "", p_website: "", p_size_range: "", p_description: "", p_status: "active" }],
  ["admin_users", { p_query: "" }],
  ["admin_set_user", { p_user_id: ANY_UUID, p_action: "ban" }],
  ["admin_banned_user_email", { p_user_id: ANY_UUID }],
  ["admin_action_log", {}],
  ["admin_counts", {}],
];

describe("admin functions are admin-only (direct calls too)", () => {
  for (const [fn, args] of ADMIN_CALLS) {
    it(`${fn}: anonymous and normal users are refused`, async () => {
      for (const client of [anonClient(), a.client]) {
        const { data, error } = await client.rpc(fn, args);
        expect(error?.code).toBe(PERMISSION_DENIED);
        expect(data).toBeNull();
      }
    });
  }

  it("a normal user can't make themselves admin or unban themselves", async () => {
    expect((await a.client.from("profiles").update({ is_admin: true }).eq("id", a.id)).error?.code).toBe(PERMISSION_DENIED);
    expect((await a.client.from("profiles").update({ is_banned: false }).eq("id", a.id)).error?.code).toBe(PERMISSION_DENIED);
  });

  it("reports, the admin log and rate-limit data are not readable from the browser", async () => {
    for (const client of [anonClient(), a.client, mod.client])
      for (const table of ["reports", "admin_actions", "rate_limit_events"])
        expect((await client.from(table).select("*").limit(1)).error?.code).toBe(PERMISSION_DENIED);
  });

  it("an admin can use them", async () => {
    expect((await mod.client.rpc("admin_counts")).error).toBeNull();
    expect((await mod.client.rpc("admin_reports_queue", { p_status: "open" })).error).toBeNull();
    expect((await mod.client.rpc("admin_action_log")).error).toBeNull();
    const { data } = await mod.client.rpc("admin_users", { p_id: a.id });
    expect(data).toHaveLength(1);
    // Pseudonym and account age, never email.
    expect(Object.keys(data[0])).not.toContain("email");
    expect(JSON.stringify(data[0])).not.toContain(a.email);
  });
});

// ---------------------------------------------------------------- reports and auto-hide

describe("reports and auto-hide", () => {
  let postId: string;

  beforeAll(async () => {
    postId = await seedPost(a, "Reported post");
  });

  it("anonymous visitors can't report; you can't report your own content", async () => {
    expect((await anonClient().rpc("report_content", { p_type: "post", p_id: postId, p_reason: "spam" })).error).not.toBeNull();
    expect((await report(a, "post", postId)).data.status).toBe("own");
  });

  it("2 reports: still visible; the same person reporting twice doesn't count", async () => {
    expect((await report(b, "post", postId, "names_individual", { p_details: "Names my old manager" })).data.status).toBe("reported");
    expect((await report(b, "post", postId)).data.status).toBe("already_reported");
    expect((await report(c, "post", postId, "harassment_threat")).data.status).toBe("reported");
    expect(await status("posts", postId)).toBe("published");
    expect((await anonClient().from("public_posts").select("id").eq("id", postId)).data).toHaveLength(1);
  });

  it("3rd report from a different user hides it pending review (logged)", async () => {
    expect((await report(d, "post", postId, "personal_info")).data.status).toBe("reported");
    expect(await status("posts", postId)).toBe("hidden");
    expect((await anonClient().from("public_posts").select("id").eq("id", postId)).data).toEqual([]);
    const { data: log } = await service.from("admin_actions").select("action, admin_id").eq("target_id", postId);
    expect(log).toContainEqual({ action: "auto_hide", admin_id: null });
  });

  it("admins see the item with reasons and reporters; nobody else can", async () => {
    const { data } = await mod.client.rpc("admin_reports_queue", { p_status: "open" });
    const item = data.find((i: { content_key: string }) => i.content_key === postId);
    expect(item).toMatchObject({ content_type: "post", content_status: "hidden", open_count: 3, preview: "Reported post" });
    expect(item.reasons.sort()).toEqual(["harassment_threat", "names_individual", "personal_info"]);
    expect(item.details).toEqual(["Names my old manager"]);
    expect(item.reporters).toHaveLength(3);
  });

  it("dismissing restores the item, closes the reports and resets the count", async () => {
    expect((await mod.client.rpc("admin_moderate", { p_type: "post", p_key: postId, p_action: "dismiss", p_note: "Not a real problem" })).error).toBeNull();
    expect(await status("posts", postId)).toBe("published");
    const { data: open } = await mod.client.rpc("admin_reports_queue", { p_status: "open" });
    expect(open.find((i: { content_key: string }) => i.content_key === postId)).toBeUndefined();
    const [e] = await contributors(1);
    expect((await report(e, "post", postId)).data.status).toBe("reported");
    expect(await status("posts", postId)).toBe("published");
  });

  it("hide / remove / restore, each logged with the admin and note", async () => {
    for (const [action, expected] of [["hide", "hidden"], ["remove", "removed"], ["restore", "published"]] as const) {
      expect((await mod.client.rpc("admin_moderate", { p_type: "post", p_key: postId, p_action: action, p_note: `test ${action}` })).error).toBeNull();
      expect(await status("posts", postId)).toBe(expected);
    }
    const { data: log } = await service.from("admin_actions").select("action, admin_id, note").eq("target_id", postId).eq("admin_id", mod.id);
    expect(log!.map((l) => l.action).sort()).toEqual(["moderate_dismiss", "moderate_hide", "moderate_remove", "moderate_restore"].sort());
  });

  it("works for replies, reviews, interview reports and salary groups too", async () => {
    const co = await company();
    // Reply
    const { data: rep } = await b.client.from("replies").insert({ post_id: postId, body: "A reply to report" }).select("id").single();
    expect((await report(c, "reply", rep!.id)).data.status).toBe("reported");
    // Review (must be published to be reportable)
    const { data: rev } = await c.client.from("reviews").insert(reviewInput(co.id)).select("id").single();
    expect((await report(d, "review", rev!.id)).data.status).toBe("not_found");
    await service.from("reviews").update({ publish_at: new Date(Date.now() - 1000).toISOString() }).eq("id", rev!.id);
    expect((await report(d, "review", rev!.id, "fake_misleading")).data.status).toBe("reported");
    // Salary group: needs 3 visible reports in the group.
    for (const [u, pay] of [[a, 100000], [b, 120000], [c, 900000]] as const) {
      const { data: s } = await u.client
        .from("salary_reports")
        .insert({ company_id: co.id, role_group: "tech_it", level: "mid", employment_type: "full_time", monthly_gross_naira: pay, has_bonus: false })
        .select("id")
        .single();
      await service.from("salary_reports").update({ publish_at: new Date(Date.now() - 1000).toISOString() }).eq("id", s!.id);
    }
    expect((await report(d, "salary_group", co.id, "fake_misleading", { p_role_group: "tech_it", p_level: "mid" })).data.status).toBe("reported");
    expect((await report(d, "salary_group", co.id, "spam", { p_role_group: "sales_marketing", p_level: "mid" })).data.status).toBe("not_found");
    const group = await mod.client.rpc("admin_salary_group", { p_company_id: co.id, p_role_group: "tech_it", p_level: "mid" });
    expect(group.data.map((r: { monthly_gross_naira: number }) => r.monthly_gross_naira)).toEqual([100000, 120000, 900000]);
    // Admin hides the outlier; the group drops below 3 and disappears from public stats.
    const outlier = group.data[2].id;
    expect((await mod.client.rpc("admin_moderate_salary", { p_salary_id: outlier, p_action: "hide" })).error).toBeNull();
    expect((await anonClient().from("company_salary_stats").select("*").eq("company_id", co.id)).data).toEqual([]);
  });
});

// ---------------------------------------------------------------- bans

describe("banned users can read but not write", () => {
  let banned: TestUser;
  let ownPost: string;

  beforeAll(async () => {
    [banned] = await contributors(1);
    ownPost = await seedPost(banned, "Written before the ban");
    expect((await mod.client.rpc("admin_set_user", { p_user_id: banned.id, p_action: "ban", p_note: "Repeated doxxing" })).error).toBeNull();
  });

  it("can't post, reply, like, review, report or edit", async () => {
    const co = await company();
    const target = await seedPost(a, "Something to reply to");
    expect((await banned.client.from("posts").insert({ category: "general", body: "x" })).error?.code).toBe(PERMISSION_DENIED);
    expect((await banned.client.from("replies").insert({ post_id: target, body: "x" })).error?.code).toBe(PERMISSION_DENIED);
    expect((await banned.client.from("post_likes").insert({ post_id: target })).error?.code).toBe(PERMISSION_DENIED);
    expect((await banned.client.from("reviews").insert(reviewInput(co.id))).error?.code).toBe(PERMISSION_DENIED);
    expect((await report(banned, "post", target)).error?.code).toBe(PERMISSION_DENIED);
    expect((await banned.client.from("posts").update({ body: "Edited while banned" }).eq("id", ownPost).select("id")).data ?? []).toEqual([]);
  });

  it("can still read", async () => {
    expect((await banned.client.from("public_posts").select("id").limit(1)).error).toBeNull();
    expect((await banned.client.from("profiles").select("is_banned").single()).data!.is_banned).toBe(true);
  });

  it("email is shown to admins only for banned accounts, and the look is logged", async () => {
    expect((await mod.client.rpc("admin_banned_user_email", { p_user_id: a.id })).error?.code).toBe(PERMISSION_DENIED);
    const { data } = await mod.client.rpc("admin_banned_user_email", { p_user_id: banned.id });
    expect(data).toBe(banned.email);
    const { data: log } = await service.from("admin_actions").select("action").eq("target_id", banned.id);
    expect(log!.map((l) => l.action)).toEqual(expect.arrayContaining(["user_ban", "user_email_viewed"]));
  });

  it("unban restores writing; admins can't be banned", async () => {
    await mod.client.rpc("admin_set_user", { p_user_id: banned.id, p_action: "unban" });
    expect((await banned.client.from("posts").insert({ category: "general", body: "Back again" })).error).toBeNull();
    expect((await mod.client.rpc("admin_set_user", { p_user_id: mod.id, p_action: "ban" })).error?.code).toBe(PERMISSION_DENIED);
  });

  it("warn sends the user a notification with the message", async () => {
    await mod.client.rpc("admin_set_user", { p_user_id: c.id, p_action: "warn", p_note: "Please don't name colleagues." });
    const { data } = await c.client.from("notifications").select("type, message, post_id").eq("type", "moderation_warning");
    expect(data).toContainEqual({ type: "moderation_warning", message: "Please don't name colleagues.", post_id: null });
  });
});

// ---------------------------------------------------------------- rate limits

describe("rate limits (per account, server-side)", () => {
  it("posts: 5 an hour; deleting doesn't reset it", async () => {
    const [u] = await contributors(1);
    const ids: string[] = [];
    for (let i = 0; i < 5; i++) {
      const { data, error } = await u.client.from("posts").insert({ category: "general", body: `Rate ${i}` }).select("id").single();
      expect(error).toBeNull();
      ids.push(data!.id);
    }
    const sixth = await u.client.from("posts").insert({ category: "general", body: "Rate 6" });
    expect(sixth.error?.code).toBe(RATE_LIMITED);
    expect(sixth.error?.message).toMatch(/up to 5 posts an hour/);
    await u.client.from("posts").delete().eq("id", ids[0]);
    expect((await u.client.from("posts").insert({ category: "general", body: "Rate 7" })).error?.code).toBe(RATE_LIMITED);
    // Other users aren't affected.
    expect((await d.client.from("posts").insert({ category: "general", body: "Someone else" })).error).toBeNull();
  });

  it("replies: 30 an hour", async () => {
    const [u] = await contributors(1);
    const target = await seedPost(a, "Reply target");
    for (let i = 0; i < 30; i++) expect((await u.client.from("replies").insert({ post_id: target, body: `r${i}` })).error).toBeNull();
    const extra = await u.client.from("replies").insert({ post_id: target, body: "r31" });
    expect(extra.error?.code).toBe(RATE_LIMITED);
    expect(extra.error?.message).toMatch(/30 replies an hour/);
  });

  it("reviews: 3 a day", async () => {
    const [u] = await contributors(1);
    for (let i = 0; i < 3; i++) expect((await u.client.from("reviews").insert(reviewInput((await company()).id))).error).toBeNull();
    const fourth = await u.client.from("reviews").insert(reviewInput((await company()).id));
    expect(fourth.error?.code).toBe(RATE_LIMITED);
    expect(fourth.error?.message).toMatch(/3 reviews a day/);
  });

  it("reports: 10 an hour", async () => {
    const [u] = await contributors(1);
    const targets = await Promise.all(Array.from({ length: 11 }, (_, i) => seedPost(a, `Report target ${i}`)));
    for (let i = 0; i < 10; i++) expect((await report(u, "post", targets[i])).data?.status).toBe("reported");
    const eleventh = await report(u, "post", targets[10]);
    expect(eleventh.error?.code).toBe(RATE_LIMITED);
    expect(eleventh.error?.message).toMatch(/10 reports an hour/);
  });
});

// ---------------------------------------------------------------- contact details

describe("phone numbers and emails are blocked on the server", () => {
  const BAD = ["Call 0803 123 4567", "WhatsApp +2348031234567", "email me: ada@example.com", "08031234567 is my line"];

  it("posts and replies", async () => {
    const target = await seedPost(a, "Clean post");
    for (const body of BAD) {
      expect((await b.client.from("posts").insert({ category: "general", body })).error?.code).toBe(CHECK_VIOLATION);
      expect((await b.client.from("replies").insert({ post_id: target, body })).error?.code).toBe(CHECK_VIOLATION);
    }
    expect((await a.client.from("posts").update({ body: BAD[0] }).eq("id", target)).error?.code).toBe(CHECK_VIOLATION);
  });

  it("reviews and interview reports", async () => {
    const co = await company();
    const [u] = await contributors(1);
    for (const text of BAD) {
      expect((await u.client.from("reviews").insert(reviewInput(co.id, { pros: `Good pay overall. ${text}` }))).error?.code).toBe(CHECK_VIOLATION);
      expect(
        (
          await u.client.from("interview_reports").insert({
            company_id: co.id,
            role_group: "tech_it",
            outcome: "offer",
            difficulty: 3,
            questions_asked: `They asked a lot. ${text}`,
            experience: "positive",
          })
        ).error?.code,
      ).toBe(CHECK_VIOLATION);
    }
  });

  it("ordinary numbers are fine", async () => {
    const { error } = await b.client.from("replies").insert({ post_id: await seedPost(a), body: "₦250,000 a month in Q3 2026, 3 years there" });
    expect(error).toBeNull();
  });
});

// ---------------------------------------------------------------- company requests and companies

describe("admin: company requests and companies", () => {
  it("approve creates an active company with a unique slug", async () => {
    await a.client.rpc("request_company", { p_name: "Zz Mod Test Brandnew Ventures", p_industry: "Other" });
    const { data: pending } = await mod.client.rpc("admin_company_requests", { p_status: "pending" });
    const req = pending.find((r: { name: string }) => r.name === "Zz Mod Test Brandnew Ventures");
    const { data: slug, error } = await mod.client.rpc("admin_approve_request", {
      p_request_id: req.id,
      p_name: "Zz Mod Test Brandnew Ventures",
      p_industry: "Technology & Software",
      p_state: "Lagos",
    });
    expect(error).toBeNull();
    expect(slug).toBe("zz-mod-test-brandnew-ventures");
    const { data: co } = await anonClient().from("companies").select("id, name, industry").eq("slug", slug).single();
    companies.push(co!.id);
    expect(co).toMatchObject({ name: "Zz Mod Test Brandnew Ventures", industry: "Technology & Software" });
    // Handling it twice fails.
    expect((await mod.client.rpc("admin_resolve_request", { p_request_id: req.id, p_action: "reject" })).error).not.toBeNull();
  });

  it("merge and reject", async () => {
    const existing = await company();
    await b.client.rpc("request_company", { p_name: "Zz Mod Test Qwerty Alpha", p_industry: "Other" });
    await c.client.rpc("request_company", { p_name: "Zz Mod Test Zxcvb Omega", p_industry: "Other" });
    const { data: pending } = await mod.client.rpc("admin_company_requests", { p_status: "pending" });
    const merge = pending.find((r: { name: string }) => r.name === "Zz Mod Test Qwerty Alpha");
    const reject = pending.find((r: { name: string }) => r.name === "Zz Mod Test Zxcvb Omega");
    expect((await mod.client.rpc("admin_resolve_request", { p_request_id: merge.id, p_action: "merge", p_company_id: existing.id })).error).toBeNull();
    expect((await mod.client.rpc("admin_resolve_request", { p_request_id: reject.id, p_action: "reject", p_note: "Not a company" })).error).toBeNull();
    const { data } = await service.from("company_requests").select("status, resolved_company_id").in("id", [merge.id, reject.id]).order("status");
    expect(data).toEqual([
      { status: "rejected", resolved_company_id: null },
      { status: "merged", resolved_company_id: existing.id },
    ]);
  });

  it("edit company details", async () => {
    const co = await company();
    const { error } = await mod.client.rpc("admin_update_company", {
      p_id: co.id,
      p_name: "Renamed Test Co",
      p_industry: "Fintech",
      p_state: "FCT",
      p_city: "Garki",
      p_website: "https://example.com",
      p_size_range: "11-50",
      p_description: "Edited by a moderator",
      p_status: "active",
    });
    expect(error).toBeNull();
    const { data } = await anonClient().from("companies").select("name, industry, city").eq("id", co.id).single();
    expect(data).toEqual({ name: "Renamed Test Co", industry: "Fintech", city: "Garki" });
  });
});
