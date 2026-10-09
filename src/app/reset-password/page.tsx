import type { Metadata } from "next";
import { AuthCard } from "@/components/AuthCard";
import { ResetPasswordForm } from "./ResetPasswordForm";

export const metadata: Metadata = { title: "Choose a new password" };

// Reached from the password-reset email (which signs the user in); the
// middleware sends signed-out visitors to /forgot-password.
export default function ResetPasswordPage() {
  return (
    <AuthCard title="Choose a new password">
      <ResetPasswordForm />
    </AuthCard>
  );
}
