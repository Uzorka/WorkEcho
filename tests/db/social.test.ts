import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { adminClient, anonClient, createContributor, createTestCompany, deleteTestUser, type TestUser } from "./helpers";

// Social feed: posts, replies, likes, notifications and cursor pagination.

const PERMISSION_DENIED = "42501";
const UNIQUE_VIOLATION = "23505";
const admin = adminClient();
let a: TestUser, b: TestUser, c: TestUser, d: TestUser, adminUser: TestUser;
const users: TestUser[] = [];
const companies: string[] = [];

async function post(u: TestUser, overrides: Record<string, unknown> = {}) {
  const { data, error } = await u.client.from("posts").insert({ category: "general", body: "Test post body", ...overrides }).select("id").single();
  if (error) throw error;
  return data.id as string;
}

async function reply(u: TestUser, postId: string, body = "Test reply") {
  const { data, error } = await u.client.from("replies").insert({ post_id: postId, body }).select("id").single();
  if (error) throw error;
  return data.id as string;
}

const notificationsFor = async (u: TestUser) => (await admin.from("notifications").select("*").eq("user_id", u.id)).data ?? [];

beforeAll(async () => {
  [a, b, c, d, adminUser] = await Promise.all([1, 2, 3, 4, 5].map(() => createContributor(admin)));
  users.push(a, b, c, d, adminUser);
  await admin.from("profiles").update({ is_admin: true }).eq("id", adminUser.id);
});

afterAll(async () => {
  // Remove test posts too (deleting a user keeps their posts as "Deleted user").
  await admin.from("posts").delete().in("author_id", users.map((u) => u.id));
  await admin.from("companies").delete().in("id", companies);
  await Promise.all(users.map((u) => deleteTestUser(admin, u)));
});

describe("posts and replies: ownership", () => {
  let postA: string, replyA: string;

  beforeAll(async () => {
    postA = await post(a, { body: "A's original post" });
    replyA = await reply(a, postA, "A's original reply");
  });

  it("publish instantly with the author's pseudonym", async () => {
    const { data } = await anonClient().from("public_posts").select("body, author_pseudonym").eq("id", postA).single();
    const { data: profile } = await admin.from("profiles").select("pseudonym").eq("id", a.id).single();
    expect(data).toEqual({ body: "A's original post", author_pseudonym: profile!.pseudonym });
  });

  it("user B can't edit or delete A's post", async () => {
    expect((await b.client.from("posts").update({ body: "Hijacked" }).eq("id", postA).select("id")).data ?? []).toEqual([]);
    expect((await b.client.from("posts").delete().eq("id", postA).select("id")).data ?? []).toEqual([]);
    expect((await adminUser.client.from("posts").delete().eq("id", postA).select("id")).data ?? []).toEqual([]);
    expect((await admin.from("posts").select("body").eq("id", postA).single()).data!.body).toBe("A's original post");
  });

  it("user B can't edit or delete A's reply", async () => {
    expect((await b.client.from("replies").update({ body: "Hijacked" }).eq("id", replyA).select("id")).data ?? []).toEqual([]);
    expect((await b.client.from("replies").delete().eq("id", replyA).select("id")).data ?? []).toEqual([]);
    expect((await admin.from("replies").select("body").eq("id", replyA).single()).data!.body).toBe("A's original reply");
  });

  it("A can edit (marked edited) and delete their own", async () => {
    expect((await a.client.from("posts").update({ body: "A's edited post" }).eq("id", postA).select("id")).data).toHaveLength(1);
    const { data } = await anonClient().from("public_posts").select("body, edited_at").eq("id", postA).single();
    expect(data!.body).toBe("A's edited post");
    expect(data!.edited_at).not.toBeNull();
    expect((await a.client.from("replies").update({ body: "A's edited reply" }).eq("id", replyA).select("id")).data).toHaveLength(1);
    const temp = await post(a);
    expect((await a.client.from("posts").delete().eq("id", temp).select("id")).data).toEqual([{ id: temp }]);
  });

  it("users can't set author_id, status or created_at, or move a post to another company", async () => {
    for (const extra of [{ author_id: b.id }, { status: "hidden" }, { created_at: new Date(0).toISOString() }])
      expect((await c.client.from("posts").insert({ category: "general", body: "x", ...extra })).error?.code).toBe(PERMISSION_DENIED);
    expect((await a.client.from("posts").update({ status: "published" }).eq("id", postA)).error?.code).toBe(PERMISSION_DENIED);
    expect((await a.client.from("posts").update({ company_id: null }).eq("id", postA)).error?.code).toBe(PERMISSION_DENIED);
    expect((await c.client.from("replies").insert({ post_id: postA, body: "x", author_id: b.id })).error?.code).toBe(PERMISSION_DENIED);
  });

  it("anonymous visitors can't post, reply or like", async () => {
    const anon = anonClient();
    expect((await anon.from("posts").insert({ category: "general", body: "x" })).error?.code).toBe(PERMISSION_DENIED);
    expect((await anon.from("replies").insert({ post_id: postA, body: "x" })).error?.code).toBe(PERMISSION_DENIED);
    expect((await anon.from("post_likes").insert({ post_id: postA })).error?.code).toBe(PERMISSION_DENIED);
  });

  it("enforces body limits", async () => {
    expect((await c.client.from("posts").insert({ category: "general", body: "x".repeat(1001) })).error?.code).toBe("23514");
    expect((await c.client.from("posts").insert({ category: "general", body: "   " })).error?.code).toBe("23514");
    expect((await c.client.from("replies").insert({ post_id: postA, body: "x".repeat(501) })).error?.code).toBe("23514");
  });

  it("hidden posts disappear and can't get replies or likes", async () => {
    const id = await post(c);
    await admin.from("posts").update({ status: "hidden" }).eq("id", id);
    expect((await anonClient().from("public_posts").select("id").eq("id", id)).data).toEqual([]);
    expect((await d.client.from("replies").insert({ post_id: id, body: "x" })).error?.code).toBe(PERMISSION_DENIED);
    expect((await d.client.from("post_likes").insert({ post_id: id })).error?.code).toBe(PERMISSION_DENIED);
  });

  it("banned users can't post", async () => {
    await admin.from("profiles").update({ is_banned: true }).eq("id", d.id);
    expect((await d.client.from("posts").insert({ category: "general", body: "x" })).error?.code).toBe(PERMISSION_DENIED);
    await admin.from("profiles").update({ is_banned: false }).eq("id", d.id);
  });
});

describe("likes", () => {
  it("count once per user, can be removed, and show liked_by_me only to the liker", async () => {
    const id = await post(a);
    expect((await b.client.from("post_likes").insert({ post_id: id })).error).toBeNull();
    expect((await b.client.from("post_likes").insert({ post_id: id })).error?.code).toBe(UNIQUE_VIOLATION);
    expect((await c.client.from("post_likes").insert({ post_id: id })).error).toBeNull();
    expect((await c.client.from("post_likes").insert({ post_id: id, user_id: d.id })).error?.code).toBe(PERMISSION_DENIED);

    expect((await anonClient().from("public_posts").select("like_count, liked_by_me").eq("id", id).single()).data).toEqual({ like_count: 2, liked_by_me: false });
    expect((await b.client.from("public_posts").select("liked_by_me").eq("id", id).single()).data!.liked_by_me).toBe(true);
    expect((await d.client.from("public_posts").select("liked_by_me").eq("id", id).single()).data!.liked_by_me).toBe(false);

    // C can't remove B's like; B can.
    await c.client.from("post_likes").delete().eq("post_id", id);
    expect((await anonClient().from("public_posts").select("like_count").eq("id", id).single()).data!.like_count).toBe(1);
    await b.client.from("post_likes").delete().eq("post_id", id);
    expect((await anonClient().from("public_posts").select("like_count").eq("id", id).single()).data!.like_count).toBe(0);
    expect((await b.client.from("post_likes").select("user_id")).error?.code).toBe(PERMISSION_DENIED);
  });
});

describe("author ids never leave the database", () => {
  it("public views, the feed RPC and base tables", async () => {
    const id = await post(a, { body: "Leak check post" });
    await reply(b, id, "Leak check reply");
    for (const client of [anonClient(), b.client, adminUser.client]) {
      const posts = await client.from("public_posts").select("*").eq("id", id);
      const replies = await client.from("public_replies").select("*").eq("post_id", id);
      const feed = await client.rpc("feed_posts", { p_limit: 50 });
      for (const rows of [posts.data, replies.data, feed.data]) {
        expect(rows!.length).toBeGreaterThan(0);
        for (const row of rows!) {
          expect(row).not.toHaveProperty("author_id");
          expect(row).not.toHaveProperty("user_id");
          for (const u of users) expect(JSON.stringify(row)).not.toContain(u.id);
        }
      }
      expect((await client.from("public_posts").select("author_id")).error).not.toBeNull();
    }
    expect((await anonClient().from("posts").select("id")).error?.code).toBe(PERMISSION_DENIED);
    expect((await anonClient().from("replies").select("id")).error?.code).toBe(PERMISSION_DENIED);
    expect((await a.client.from("posts").select("author_id")).error?.code).toBe(PERMISSION_DENIED);
    expect((await b.client.from("replies").select("author_id")).error?.code).toBe(PERMISSION_DENIED);
    expect((await a.client.from("notifications").select("user_id")).error?.code).toBe(PERMISSION_DENIED);
    // is_mine is per viewer.
    expect((await a.client.from("public_posts").select("is_mine").eq("id", id).single()).data!.is_mine).toBe(true);
    expect((await b.client.from("public_posts").select("is_mine").eq("id", id).single()).data!.is_mine).toBe(false);
  });
});

describe("notifications", () => {
  it("a reply notifies the post owner only, without saying who replied", async () => {
    const before = { a: (await notificationsFor(a)).length, b: (await notificationsFor(b)).length, c: (await notificationsFor(c)).length };
    const id = await post(a);
    await reply(b, id);
    await reply(a, id, "Owner replying to their own post");

    const aNotes = await notificationsFor(a);
    expect(aNotes.length).toBe(before.a + 1);
    expect((await notificationsFor(b)).length).toBe(before.b);
    expect((await notificationsFor(c)).length).toBe(before.c);
    const n = aNotes.find((x) => x.post_id === id)!;
    expect(n.type).toBe("reply_to_your_post");
    expect(Object.keys(n).sort()).toEqual(["created_at", "id", "is_read", "message", "post_id", "type", "user_id"]);
  });

  it("users read and mark only their own; nobody creates them directly", async () => {
    const id = await post(c);
    await reply(d, id);
    const mine = await c.client.from("notifications").select("id, is_read").eq("post_id", id);
    expect(mine.data).toHaveLength(1);
    const noteId = mine.data![0].id;

    expect((await d.client.from("notifications").select("id").eq("id", noteId)).data).toEqual([]);
    expect((await d.client.from("notifications").update({ is_read: true }).eq("id", noteId).select("id")).data ?? []).toEqual([]);
    expect((await d.client.from("notifications").insert({ user_id: c.id, type: "reply_to_your_post", post_id: id })).error?.code).toBe(PERMISSION_DENIED);
    expect((await c.client.from("notifications").update({ post_id: id }).eq("id", noteId)).error?.code).toBe(PERMISSION_DENIED);
    expect((await anonClient().from("notifications").select("id")).error?.code).toBe(PERMISSION_DENIED);

    expect((await c.client.from("notifications").update({ is_read: true }).eq("id", noteId).select("is_read")).data).toEqual([{ is_read: true }]);
  });
});

describe("cursor pagination", () => {
  let co: { id: string };
  const ids: string[] = [];

  beforeAll(async () => {
    co = await createTestCompany(admin);
    companies.push(co.id);
    // Inserted with the service role (no rate limit), spread across 4 authors.
    const authors = [a, b, c, d];
    for (let i = 0; i < 23; i++) {
      const { data, error } = await admin
        .from("posts")
        .insert({ author_id: authors[i % 4].id, company_id: co.id, category: "general", body: `Page test ${i}` })
        .select("id")
        .single();
      if (error) throw error;
      ids.push(data.id);
    }
    // Five posts with the exact same timestamp: the id tie-break must keep them apart.
    const same = new Date(Date.now() - 60_000).toISOString();
    await admin.from("posts").update({ created_at: same }).in("id", ids.slice(5, 10));
    // Varied like counts (with ties) for "top".
    for (const [i, likers] of [[0, [b, c, d]], [3, [a, c]], [7, [a, b]], [12, [a]], [20, [b]]] as const)
      for (const u of likers) await u.client.from("post_likes").insert({ post_id: ids[i] });
  });

  async function pageAll(sort: "latest" | "top", limit: number) {
    type Row = { created_at: string; id: string; like_count: number };
    const seen: Row[] = [];
    for (let guard = 0; guard < 20; guard++) {
      const cursor: Row | undefined = seen[seen.length - 1];
      const { data, error }: { data: Row[] | null; error: unknown } = await anonClient().rpc("feed_posts", {
        p_sort: sort,
        p_company_id: co.id,
        p_after_created: cursor?.created_at ?? null,
        p_after_id: cursor?.id ?? null,
        p_after_likes: sort === "top" ? (cursor?.like_count ?? null) : null,
        p_limit: limit,
      });
      if (error) throw error;
      if (!data?.length) break;
      seen.push(...data);
    }
    return seen;
  }

  it("latest: every post exactly once, newest first", async () => {
    const rows = await pageAll("latest", 4);
    expect(rows.map((r) => r.id).sort()).toEqual([...ids].sort());
    expect(new Set(rows.map((r) => r.id)).size).toBe(ids.length);
    for (let i = 1; i < rows.length; i++) expect(Date.parse(rows[i - 1].created_at)).toBeGreaterThanOrEqual(Date.parse(rows[i].created_at));
  });

  it("top this week: every post exactly once, most liked first", async () => {
    const rows = await pageAll("top", 3);
    expect(new Set(rows.map((r) => r.id)).size).toBe(ids.length);
    expect(rows.map((r) => r.like_count).slice(0, 4)).toEqual([3, 2, 2, 1]);
    for (let i = 1; i < rows.length; i++) expect(rows[i - 1].like_count).toBeGreaterThanOrEqual(rows[i].like_count);
  });

  it("top only covers the last 7 days", async () => {
    await admin.from("posts").update({ created_at: new Date(Date.now() - 8 * 86_400_000).toISOString() }).eq("id", ids[22]);
    const rows = await pageAll("top", 10);
    expect(rows.map((r) => r.id)).not.toContain(ids[22]);
    expect((await pageAll("latest", 10)).map((r) => r.id)).toContain(ids[22]);
  });

  it("filters by category", async () => {
    const { data } = await anonClient().rpc("feed_posts", { p_company_id: co.id, p_category: "management", p_limit: 50 });
    expect(data).toEqual([]);
  });
});
