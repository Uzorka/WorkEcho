import type { Metadata } from "next";
import { Placeholder } from "@/components/Placeholder";

export const metadata: Metadata = { title: "Create" };

export default function CreatePage() {
  return (
    <Placeholder
      title="Create"
      intro="Write a post, review a company, or share a salary or interview experience."
      comingIn="Slices 2–4"
    />
  );
}
