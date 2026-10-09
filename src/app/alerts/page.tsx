import type { Metadata } from "next";
import { Placeholder } from "@/components/Placeholder";

export const metadata: Metadata = { title: "Alerts" };

export default function AlertsPage() {
  return <Placeholder title="Alerts" intro="Replies to your posts will show here." comingIn="Slice 4 (social feed)" />;
}
