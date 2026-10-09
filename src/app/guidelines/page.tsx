import type { Metadata } from "next";
import { Placeholder } from "@/components/Placeholder";

export const metadata: Metadata = { title: "Community guidelines" };

export default function GuidelinesPage() {
  return (
    <Placeholder
      title="Community guidelines"
      intro="Review the company and its practices, not named individuals. Good, mixed and bad experiences are all welcome."
      comingIn="Slice 5"
    />
  );
}
