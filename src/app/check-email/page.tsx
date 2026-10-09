import type { Metadata } from "next";
import Link from "next/link";
import { AuthCard } from "@/components/AuthCard";

export const metadata: Metadata = { title: "Check your email" };

export default function CheckEmailPage() {
  return (
    <AuthCard title="Check your email">
      <p>
        We&apos;ve sent you a link to confirm your email. Open it on this phone or computer to finish
        setting up your account.
      </p>
      <p className="text-sm text-muted">
        Can&apos;t find it? Check your spam or promotions folder. The link expires after an hour.
      </p>
      <Link href="/login" className="font-medium text-primary underline">
        Back to log in
      </Link>
    </AuthCard>
  );
}
