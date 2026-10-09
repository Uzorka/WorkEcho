import type { Metadata } from "next";
import { Placeholder } from "@/components/Placeholder";

export const metadata: Metadata = { title: "Companies" };

export default function CompaniesPage() {
  return (
    <Placeholder
      title="Companies"
      intro="Search Nigerian companies and read reviews, salaries and interview experiences."
      comingIn="Slice 2 (companies and reviews)"
    />
  );
}
