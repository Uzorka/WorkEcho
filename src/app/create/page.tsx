import type { Metadata } from "next";
import Link from "next/link";
import { Placeholder } from "@/components/Placeholder";

export const metadata: Metadata = { title: "Create" };

export default function CreatePage() {
  return (
    <Placeholder
      title="Create"
      intro="Write a post, review a company, or share a salary or interview experience."
      comingIn="Slices 3–4"
    >
      <p className="mt-3 text-sm">
        Want to review a company now?{" "}
        <Link href="/companies" className="font-medium text-primary underline">
          Find it on Companies
        </Link>{" "}
        and tap &ldquo;Write a review&rdquo;.
      </p>
    </Placeholder>
  );
}
