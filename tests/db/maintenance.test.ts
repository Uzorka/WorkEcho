import { execFileSync } from "node:child_process";
import { randomUUID } from "node:crypto";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { adminClient, anonClient, createContributor, createTestCompany, deleteTestUser, type TestUser } from "./helpers";

// Slice 7: daily clean-up (retention). Only the server (service role) may run it.

const PERMISSION_DENIED = "42501";
const DB_URL = process.env.SUPABASE_DB_URL ?? "postgresql://postgres:postgres@127.0.0.1:54322/postgres";
const sql = (q: string) => execFileSync("psql", [DB_URL, "-tAc", q], { encoding: "utf8" }).trim();
const count = (q: string) => Number(sql(`select count(*) from ${q}`));

const service = adminClient();
let a: TestUser;
let b: TestUser;
let companyId: string;
let postId: string;
// Unlinked rows outlive the test users, so each run uses its own names.
const RUN = randomUUID().slice(0, 8);

beforeAll(async () => {
  [a, b] = await Promise.all([createContributor(service), createContributor(service)]);
  companyId = (await createTestCompany(service)).id;
  postId = sql(`insert into public.posts (author_id, category, body) values ('${a.id}', 'general', 'maintenance test') returning id`).split("\n")[0];
});

afterAll(async () => {
  await Promise.all([deleteTestUser(service, a), deleteTestUser(service, b)]);
  sql(`delete from public.posts where id = '${postId}'; delete from public.reports where content_key like 'mt-${RUN}-%'; delete from public.company_requests where name like 'MT ${RUN} %'`);
  await service.from("companies").delete().eq("id", companyId);
});

describe("who can run the clean-up", () => {
  it("anonymous visitors cannot", async () => {
    const { error } = await anonClient().rpc("run_maintenance");
    expect(error?.code).toBe(PERMISSION_DENIED);
  });

  it("signed-in users cannot", async () => {
    const { error } = await a.client.rpc("run_maintenance");
    expect(error?.code).toBe(PERMISSION_DENIED);
  });

  it("admins cannot call it from the browser either", async () => {
    await service.from("profiles").update({ is_admin: true }).eq("id", b.id);
    const { error } = await b.client.rpc("run_maintenance");
    expect(error?.code).toBe(PERMISSION_DENIED);
    await service.from("profiles").update({ is_admin: false }).eq("id", b.id);
  });

  it("the server (service role) can, and gets counts only", async () => {
    const { data, error } = await service.rpc("run_maintenance");
    expect(error).toBeNull();
    expect(Object.keys(data).sort()).toEqual([
      "company_requests_unlinked",
      "notifications_deleted",
      "rate_limit_events_deleted",
      "reports_unlinked",
      "verification_challenges_deleted",
      "verifications_expired",
    ]);
    expect(Object.values(data).every((v) => typeof v === "number")).toBe(true);
  });
});

describe("what it cleans up", () => {
  beforeAll(async () => {
    const u = a.id;
    sql(`
      insert into public.rate_limit_events (user_id, action, created_at) values
        ('${u}', 'mt-old', now() - interval '3 days'), ('${u}', 'mt-new', now() - interval '1 day');
      insert into public.verification_challenges (user_id, company_id, code_hash, expires_at, created_at) values
        ('${u}', '${companyId}', 'x', now() - interval '8 days', now() - interval '8 days'),
        ('${u}', '${companyId}', 'y', now() + interval '10 minutes', now());
      insert into public.notifications (user_id, type, post_id, is_read, created_at) values
        ('${u}', 'reply_to_your_post', '${postId}', true,  now() - interval '91 days'),
        ('${u}', 'reply_to_your_post', '${postId}', false, now() - interval '91 days'),
        ('${u}', 'reply_to_your_post', '${postId}', false, now() - interval '13 months'),
        ('${u}', 'reply_to_your_post', '${postId}', true,  now() - interval '10 days');
      insert into public.reports (content_type, content_id, content_key, reporter_id, reason, status, created_at, resolved_at) values
        ('post', '${postId}', 'mt-${RUN}-closed-old', '${u}', 'spam', 'dismissed', now() - interval '14 months', now() - interval '13 months'),
        ('post', '${postId}', 'mt-${RUN}-closed-new', '${u}', 'spam', 'dismissed', now() - interval '14 months', now() - interval '1 month'),
        ('post', '${postId}', 'mt-${RUN}-open-old',   '${u}', 'spam', 'open',      now() - interval '14 months', null);
      insert into public.company_requests (requester_id, name, industry, status, created_at) values
        ('${u}', 'MT ${RUN} handled old', 'Other', 'rejected', now() - interval '13 months'),
        ('${u}', 'MT ${RUN} pending old', 'Other', 'pending',  now() - interval '13 months'),
        ('${u}', 'MT ${RUN} handled new', 'Other', 'approved', now() - interval '1 month');
      insert into public.verifications (user_id, company_id, verified_at, expires_at, status) values
        ('${u}', '${companyId}', now() - interval '13 months', now() - interval '1 month', 'active');
    `);
    const { error } = await service.rpc("run_maintenance");
    expect(error).toBeNull();
  });

  it("deletes posting-limit timestamps older than 2 days, keeps recent ones", () => {
    expect(count(`public.rate_limit_events where user_id = '${a.id}' and action = 'mt-old'`)).toBe(0);
    expect(count(`public.rate_limit_events where user_id = '${a.id}' and action = 'mt-new'`)).toBe(1);
  });

  it("deletes verification codes older than 7 days, keeps fresh ones", () => {
    expect(count(`public.verification_challenges where user_id = '${a.id}' and code_hash = 'x'`)).toBe(0);
    expect(count(`public.verification_challenges where user_id = '${a.id}' and code_hash = 'y'`)).toBe(1);
  });

  it("deletes read alerts after 90 days and all alerts after a year", () => {
    expect(count(`public.notifications where user_id = '${a.id}' and created_at < now() - interval '1 year'`)).toBe(0);
    expect(count(`public.notifications where user_id = '${a.id}' and is_read and created_at < now() - interval '90 days'`)).toBe(0);
    // Unread 91-day-old alert and the recent read one stay.
    expect(count(`public.notifications where user_id = '${a.id}'`)).toBe(2);
  });

  it("unlinks the reporter 12 months after a report closes; open reports keep it", () => {
    const reporter = (key: string) => sql(`select coalesce(reporter_id::text, 'null') from public.reports where content_key = '${key}'`);
    expect(reporter(`mt-${RUN}-closed-old`)).toBe("null");
    expect(reporter(`mt-${RUN}-closed-new`)).toBe(a.id);
    expect(reporter(`mt-${RUN}-open-old`)).toBe(a.id);
    // The report itself is kept.
    expect(count(`public.reports where content_key like 'mt-${RUN}-%'`)).toBe(3);
  });

  it("unlinks the requester from handled company requests after 12 months", () => {
    const requester = (name: string) => sql(`select coalesce(requester_id::text, 'null') from public.company_requests where name = '${name}'`);
    expect(requester(`MT ${RUN} handled old`)).toBe("null");
    expect(requester(`MT ${RUN} pending old`)).toBe(a.id);
    expect(requester(`MT ${RUN} handled new`)).toBe(a.id);
  });

  it("marks verifications past their expiry date as expired", () => {
    expect(sql(`select status from public.verifications where user_id = '${a.id}' and company_id = '${companyId}'`)).toBe("expired");
  });

  it("never touches published content", () => {
    expect(count(`public.posts where id = '${postId}' and status = 'published'`)).toBe(1);
  });
});
