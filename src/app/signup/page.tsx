import type { Metadata } from "next";
import Link from "next/link";
import { AuthCard } from "@/components/AuthCard";
import { SignupForm } from "./SignupForm";

export const metadata: Metadata = { title: "Sign up" };

export default function SignupPage() {
  return (
    <AuthCard
      title="Create an account"
      intro="You'll get a generated pseudonym. No real name, no photo, no phone number."
    >
      <p className="rounded-xl border border-primary/30 bg-primary-soft p-3 text-sm font-medium">
        Use a personal email, not your work email. Your employer may be able to see emails sent to
        your work address.
      </p>
      <SignupForm />
      <p className="text-sm text-muted">
        Already have an account?{" "}
        <Link href="/login" className="font-medium text-primary underline">
          Log in
        </Link>
      </p>
    </AuthCard>
  );
}
