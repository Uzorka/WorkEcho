import type { Metadata } from "next";
import { Placeholder } from "@/components/Placeholder";

export const metadata: Metadata = { title: "Privacy" };

export default function PrivacyPage() {
  return (
    <Placeholder
      title="Privacy"
      intro="How WorkEcho protects your identity, what we store, and how to ask us to delete it."
      comingIn="Slice 5 (a draft pending legal review)"
    />
  );
}
