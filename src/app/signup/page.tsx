import type { Metadata } from "next";
import { Placeholder } from "@/components/Placeholder";

export const metadata: Metadata = { title: "Sign up" };

export default function SignupPage() {
  return (
    <Placeholder
      title="Create an account"
      intro="Sign up with a personal email, not your work email. You'll get a generated pseudonym — no photos, no phone number."
      comingIn="Slice 1 (accounts)"
    />
  );
}
