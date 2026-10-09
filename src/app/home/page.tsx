import { redirect } from "next/navigation";

// /home is the same feed as /.
export default async function HomeAlias({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  const q = new URLSearchParams(Object.entries(await searchParams).filter((e): e is [string, string] => typeof e[1] === "string"));
  redirect(q.size ? `/?${q}` : "/");
}
