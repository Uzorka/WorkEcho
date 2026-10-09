import { describe, expect, it } from "vitest";
import { decodeCursor, encodeCursor } from "@/lib/feed-cursor";
import { postSchema, replySchema } from "@/lib/post-schema";
import { avatarColour, avatarInitials, timeAgo } from "@/lib/posts";

const id = "10000000-0000-4000-8000-000000000001";

describe("feed cursor", () => {
  it("round-trips for latest and top", () => {
    const post = { id, created_at: "2026-10-09T10:00:00.000Z", rank_score: 4 };
    expect(decodeCursor(encodeCursor(post, "latest"), "latest")).toEqual({ c: post.created_at, i: id });
    expect(decodeCursor(encodeCursor(post, "top"), "top")).toEqual({ c: post.created_at, i: id, l: 4 });
  });
  it("rejects tampered or junk cursors", () => {
    expect(decodeCursor("not-base64-json", "latest")).toBeNull();
    expect(decodeCursor(Buffer.from(JSON.stringify({ c: "yesterday", i: id })).toString("base64url"), "latest")).toBeNull();
    expect(decodeCursor(Buffer.from(JSON.stringify({ c: "2026-10-09T10:00:00Z", i: "1; drop table" })).toString("base64url"), "latest")).toBeNull();
    // A latest cursor has no like count, so it's not valid for top.
    expect(decodeCursor(encodeCursor({ id, created_at: "2026-10-09T10:00:00Z", rank_score: 1 }, "latest"), "top")).toBeNull();
    expect(decodeCursor(42, "latest")).toBeNull();
  });
});

describe("avatar", () => {
  it("uses the capital letters of the pseudonym", () => {
    expect(avatarInitials("QuietFalcon82")).toBe("QF");
    expect(avatarInitials("Deleted user")).toBe("?");
  });
  it("picks a stable colour per pseudonym", () => {
    expect(avatarColour("QuietFalcon82")).toBe(avatarColour("QuietFalcon82"));
    expect(avatarColour("Deleted user")).toBe("#6B7280");
  });
});

describe("timeAgo", () => {
  const now = Date.parse("2026-10-09T12:00:00Z");
  it("is short and friendly", () => {
    expect(timeAgo("2026-10-09T11:59:30Z", now)).toBe("just now");
    expect(timeAgo("2026-10-09T11:55:00Z", now)).toBe("5m");
    expect(timeAgo("2026-10-09T09:00:00Z", now)).toBe("3h");
    expect(timeAgo("2026-10-07T12:00:00Z", now)).toBe("2d");
    expect(timeAgo("2026-09-01T12:00:00Z", now)).toMatch(/Sept?/);
  });
});

describe("post and reply validation", () => {
  it("accepts a normal post with or without a company", () => {
    expect(postSchema.safeParse({ category: "general", company_id: "", body: "Hello all" }).data).toEqual({ category: "general", company_id: null, body: "Hello all" });
    expect(postSchema.safeParse({ category: "management", company_id: id, body: "Hi" }).success).toBe(true);
  });
  it("enforces limits, categories and no contact details", () => {
    expect(postSchema.safeParse({ category: "general", company_id: "", body: "   " }).success).toBe(false);
    expect(postSchema.safeParse({ category: "general", company_id: "", body: "x".repeat(1001) }).success).toBe(false);
    expect(postSchema.safeParse({ category: "general", company_id: "", body: "x".repeat(1000) }).success).toBe(true);
    expect(postSchema.safeParse({ category: "gossip", company_id: "", body: "Hi" }).success).toBe(false);
    expect(postSchema.safeParse({ category: "general", company_id: "not-a-uuid", body: "Hi" }).success).toBe(false);
    expect(postSchema.safeParse({ category: "general", company_id: "", body: "DM 08031234567" }).success).toBe(false);
    expect(replySchema.safeParse({ body: "x".repeat(501) }).success).toBe(false);
    expect(replySchema.safeParse({ body: "x".repeat(500) }).success).toBe(true);
  });
});
