import { describe, expect, it } from "vitest";
import { aboutYouSchema, changePasswordSchema, deleteAccountSchema, safeNextPath, signupSchema } from "@/lib/auth-schemas";

describe("signupSchema", () => {
  it("needs a valid email, an 8+ character password and agreement", () => {
    expect(signupSchema.safeParse({ email: " Ada@Example.com ", password: "longenough", agree: "on" }).data?.email).toBe(
      "ada@example.com",
    );
    expect(signupSchema.safeParse({ email: "nope", password: "longenough", agree: "on" }).success).toBe(false);
    expect(signupSchema.safeParse({ email: "a@b.co", password: "short", agree: "on" }).success).toBe(false);
    expect(signupSchema.safeParse({ email: "a@b.co", password: "longenough" }).success).toBe(false);
  });
});

describe("aboutYouSchema", () => {
  it("accepts the three user types and an optional state", () => {
    expect(aboutYouSchema.parse({ user_type: "job_seeker", state: "" })).toEqual({ user_type: "job_seeker", state: null });
    expect(aboutYouSchema.parse({ user_type: "former_employee", state: "FCT" }).state).toBe("FCT");
  });
  it("rejects unknown types and states", () => {
    expect(aboutYouSchema.safeParse({ user_type: "admin", state: "" }).success).toBe(false);
    expect(aboutYouSchema.safeParse({ user_type: "job_seeker", state: "London" }).success).toBe(false);
  });
});

describe("password and delete confirmations", () => {
  it("requires matching new passwords", () => {
    expect(changePasswordSchema.safeParse({ current: "x", password: "newpassword", confirm: "different" }).success).toBe(false);
    expect(changePasswordSchema.safeParse({ current: "x", password: "newpassword", confirm: "newpassword" }).success).toBe(true);
  });
  it("requires typing DELETE exactly", () => {
    expect(deleteAccountSchema.safeParse({ confirm: "delete" }).success).toBe(false);
    expect(deleteAccountSchema.safeParse({ confirm: "DELETE" }).success).toBe(true);
  });
});

describe("safeNextPath", () => {
  it("allows same-site paths only", () => {
    expect(safeNextPath("/me")).toBe("/me");
    expect(safeNextPath("/onboarding?step=2")).toBe("/onboarding?step=2");
    for (const bad of ["https://evil.com", "//evil.com", "/\\evil.com", "evil", "", undefined, 42, "/a\nb"])
      expect(safeNextPath(bad, "/")).toBe("/");
  });
});
