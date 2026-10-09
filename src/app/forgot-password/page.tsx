import type { Metadata } from "next";
import Link from "next/link";
import { AuthCard } from "@/components/AuthCard";
import { ForgotPasswordForm } from "./ForgotPasswordForm";

export const metadata: Metadata = { title: "Forgot password" };

export default function ForgotPasswordPage() {
  return (
    <AuthCard title="Forgot your password?" intro="Enter the email you signed up with and we'll send you a link to choose a new password.">
      <ForgotPasswordForm />
      <Link href="/login" className="text-sm font-medium text-primary underline">
        Back to log in
      </Link>
    </AuthCard>
  );
}
