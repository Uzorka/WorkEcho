import type { Metadata } from "next";
import { Placeholder } from "@/components/Placeholder";

export const metadata: Metadata = { title: "Terms" };

export default function TermsPage() {
  return (
    <Placeholder
      title="Terms"
      intro="The rules for using WorkEcho."
      comingIn="Slice 5 (a draft pending legal review)"
    />
  );
}
