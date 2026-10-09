import type { Metadata } from "next";
import { Placeholder } from "@/components/Placeholder";

export const metadata: Metadata = { title: "Log in" };

export default function LoginPage() {
  return <Placeholder title="Log in" intro="Log in with your email and password." comingIn="Slice 1 (accounts)" />;
}
