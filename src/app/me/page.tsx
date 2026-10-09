import type { Metadata } from "next";
import { Placeholder } from "@/components/Placeholder";

export const metadata: Metadata = { title: "Me" };

export default function MePage() {
  return (
    <Placeholder
      title="Me"
      intro="Your pseudonym, account settings and privacy controls."
      comingIn="Slice 1 (accounts)"
    />
  );
}
