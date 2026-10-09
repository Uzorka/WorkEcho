import type { Metadata } from "next";
import Link from "next/link";
import { AuthCard } from "@/components/AuthCard";
import { Notice } from "@/components/Notice";
import { safeNextPath } from "@/lib/auth-schemas";
import { LoginForm } from "./LoginForm";

export const metadata: Metadata = { title: "Log in" };

const NOTICES: Record<string, string> = {
  "signed-out": "You've signed out.",
  "account-deleted": "Your account has been deleted.",
  "link-invalid": "That link is invalid or has expired. Log in, or ask for a new link.",
};

export default async function LoginPage({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  const { next, notice } = await searchParams;
  const safeNext = next ? safeNextPath(next, "") : "";
  return (
    <AuthCard title="Log in">
      {notice && NOTICES[notice] && <Notice>{NOTICES[notice]}</Notice>}
      <LoginForm next={safeNext || undefined} />
      <p className="text-sm text-muted">
        New to WorkEcho?{" "}
        <Link href="/signup" className="font-medium text-primary underline">
          Create an account
        </Link>
      </p>
    </AuthCard>
  );
}
