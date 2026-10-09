import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { ensureProfile, regeneratePseudonym } from "@/lib/profile-service";
import { PSEUDONYM_PATTERN } from "@/lib/pseudonym";
import { adminClient, anonClient, createTestUser, deleteTestUser, type TestUser } from "./helpers";

// Permission rules for profiles, checked against a real Supabase with RLS.
// Actors: anonymous visitor, user A, user B, and an admin.

const PERMISSION_DENIED = "42501";
const admin = adminClient();
let a: TestUser;
let b: TestUser;
let adminUser: TestUser;

async function row(id: string) {
  const { data } = await admin.from("profiles").select("*").eq("id", id).single();
  return data;
}

beforeAll(async () => {
  [a, b, adminUser] = await Promise.all([createTestUser(admin), createTestUser(admin), createTestUser(admin)]);
  await Promise.all([ensureProfile(admin, a.id), ensureProfile(admin, b.id), ensureProfile(admin, adminUser.id)]);
  await admin.from("profiles").update({ is_admin: true }).eq("id", adminUser.id);
});

afterAll(async () => {
  await Promise.all([deleteTestUser(admin, a), deleteTestUser(admin, b), deleteTestUser(admin, adminUser)]);
});

describe("anonymous visitor", () => {
  it("cannot read the profiles base table", async () => {
    const { data, error } = await anonClient().from("profiles").select("*");
    expect(error?.code).toBe(PERMISSION_DENIED);
    expect(data).toBeNull();
  });

  it("cannot insert, update or delete profiles", async () => {
    const anon = anonClient();
    expect((await anon.from("profiles").insert({ id: a.id, pseudonym: "BadActor11" })).error?.code).toBe(PERMISSION_DENIED);
    expect((await anon.from("profiles").update({ is_admin: true }).eq("id", a.id)).error?.code).toBe(PERMISSION_DENIED);
    expect((await anon.from("profiles").delete().eq("id", a.id)).error?.code).toBe(PERMISSION_DENIED);
  });

  it("can read pseudonyms (and only pseudonyms) from public_profiles", async () => {
    const { data, error } = await anonClient().from("public_profiles").select("*");
    expect(error).toBeNull();
    const pseudonymA = (await row(a.id))!.pseudonym;
    expect(data!.map((r) => r.pseudonym)).toContain(pseudonymA);
    for (const r of data!) expect(Object.keys(r)).toEqual(["pseudonym"]);
  });

  it("cannot call complete_onboarding", async () => {
    expect((await anonClient().rpc("complete_onboarding")).error).not.toBeNull();
  });
});

describe("user A and user B", () => {
  it("A reads only their own row", async () => {
    const { data, error } = await a.client.from("profiles").select("id, pseudonym");
    expect(error).toBeNull();
    expect(data).toEqual([{ id: a.id, pseudonym: (await row(a.id))!.pseudonym }]);
  });

  it("A cannot read B's row", async () => {
    const { data } = await a.client.from("profiles").select("*").eq("id", b.id);
    expect(data).toEqual([]);
  });

  it("A cannot edit B's row", async () => {
    const before = await row(b.id);
    const { data } = await a.client.from("profiles").update({ user_type: "job_seeker", state: "Kano" }).eq("id", b.id).select();
    expect(data ?? []).toEqual([]);
    expect(await row(b.id)).toEqual(before);
  });

  it("A can update their own user_type and state", async () => {
    const { data, error } = await a.client
      .from("profiles")
      .update({ user_type: "current_employee", state: "Lagos" })
      .eq("id", a.id)
      .select("user_type, state");
    expect(error).toBeNull();
    expect(data).toEqual([{ user_type: "current_employee", state: "Lagos" }]);
  });

  it("A cannot set an invalid state", async () => {
    const { error } = await a.client.from("profiles").update({ state: "Atlantis" }).eq("id", a.id);
    expect(error).not.toBeNull();
  });

  it("nobody can set is_admin or is_banned on themselves", async () => {
    for (const change of [{ is_admin: true }, { is_banned: true }, { is_admin: true, user_type: "job_seeker" as const }]) {
      const { error } = await a.client.from("profiles").update(change).eq("id", a.id);
      expect(error?.code).toBe(PERMISSION_DENIED);
    }
    const after = await row(a.id);
    expect(after!.is_admin).toBe(false);
    expect(after!.is_banned).toBe(false);
  });

  it("A cannot pick their own pseudonym, reset regenerations or mark onboarding done directly", async () => {
    for (const change of [{ pseudonym: "ChosenName12" }, { pseudonym_regenerations: 0 }, { onboarded_at: new Date().toISOString() }]) {
      const { error } = await a.client.from("profiles").update(change).eq("id", a.id);
      expect(error?.code).toBe(PERMISSION_DENIED);
    }
  });

  it("A cannot insert or delete profile rows", async () => {
    expect((await a.client.from("profiles").insert({ id: a.id, pseudonym: "SecondSelf12" })).error?.code).toBe(PERMISSION_DENIED);
    expect((await a.client.from("profiles").delete().eq("id", a.id)).error?.code).toBe(PERMISSION_DENIED);
    expect(await row(a.id)).not.toBeNull();
  });

  it("complete_onboarding needs a user type and only touches the caller's row", async () => {
    // B has no user type yet.
    expect((await b.client.rpc("complete_onboarding")).data).toBe(false);
    expect((await row(b.id))!.onboarded_at).toBeNull();
    // A has one (set above).
    expect((await a.client.rpc("complete_onboarding")).data).toBe(true);
    expect((await row(a.id))!.onboarded_at).not.toBeNull();
    expect((await row(b.id))!.onboarded_at).toBeNull();
  });
});

describe("admin", () => {
  it("an admin still cannot read other users' rows from the browser client", async () => {
    const { data } = await adminUser.client.from("profiles").select("id");
    expect(data).toEqual([{ id: adminUser.id }]);
  });

  it("an admin cannot set is_admin or is_banned on another user from the browser client", async () => {
    const { error } = await adminUser.client.from("profiles").update({ is_banned: true }).eq("id", b.id);
    expect(error?.code).toBe(PERMISSION_DENIED);
    expect((await row(b.id))!.is_banned).toBe(false);
  });
});

describe("server-side pseudonym assignment", () => {
  it("gives each new profile a valid, unique pseudonym", async () => {
    const pa = (await row(a.id))!.pseudonym;
    const pb = (await row(b.id))!.pseudonym;
    expect(pa).toMatch(PSEUDONYM_PATTERN);
    expect(pb).toMatch(PSEUDONYM_PATTERN);
    expect(pa.toLowerCase()).not.toBe(pb.toLowerCase());
  });

  it("ensureProfile is idempotent", async () => {
    const first = await row(b.id);
    await ensureProfile(admin, b.id);
    expect((await row(b.id))!.pseudonym).toBe(first!.pseudonym);
  });

  it("the database rejects duplicate pseudonyms, ignoring case", async () => {
    const pa = (await row(a.id))!.pseudonym;
    const { error } = await admin.from("profiles").update({ pseudonym: pa.toUpperCase().slice(0, 1) + pa.slice(1).toLowerCase() }).eq("id", b.id);
    expect(error?.code).toBe("23505");
  });

  it("allows 3 regenerations during onboarding, then stops", async () => {
    const seen = new Set([(await row(b.id))!.pseudonym]);
    for (let i = 1; i <= 3; i++) {
      const r = await regeneratePseudonym(admin, b.id);
      expect(r.ok).toBe(true);
      if (r.ok) {
        expect(r.profile.pseudonym_regenerations).toBe(i);
        expect(seen.has(r.profile.pseudonym)).toBe(false);
        seen.add(r.profile.pseudonym);
      }
    }
    expect(await regeneratePseudonym(admin, b.id)).toEqual({ ok: false, reason: "limit" });
    expect((await row(b.id))!.pseudonym_regenerations).toBe(3);
  });

  it("does not allow regeneration after onboarding", async () => {
    // A finished onboarding above and never regenerated.
    expect(await regeneratePseudonym(admin, a.id)).toEqual({ ok: false, reason: "onboarded" });
  });

  it("deleting the auth user deletes the profile", async () => {
    const c = await createTestUser(admin);
    await ensureProfile(admin, c.id);
    await admin.auth.admin.deleteUser(c.id);
    const { data } = await admin.from("profiles").select("id").eq("id", c.id);
    expect(data).toEqual([]);
  });
});
