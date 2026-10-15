import type { MetadataRoute } from "next";
import { createClient } from "@supabase/supabase-js";
import { publicEnv } from "@/lib/env";

// Public pages plus every active company. Read with the anon key, so it can
// only ever contain what an anonymous visitor could already see.
export const dynamic = "force-dynamic";

const COMPANY_TABS = ["", "/reviews", "/salaries", "/interviews"];

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const env = publicEnv();
  const site = env.NEXT_PUBLIC_SITE_URL;
  const pages: MetadataRoute.Sitemap = ["/", "/companies", "/guidelines", "/verification", "/privacy", "/terms"].map(
    (path) => ({ url: `${site}${path === "/" ? "" : path}` }),
  );

  const supabase = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.NEXT_PUBLIC_SUPABASE_ANON_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const { data } = await supabase.from("companies").select("slug").order("name").limit(10000);
  const companies = (data ?? []).flatMap(({ slug }: { slug: string }) =>
    COMPANY_TABS.map((tab) => ({ url: `${site}/companies/${encodeURIComponent(slug)}${tab}` })),
  );
  return [...pages, ...companies];
}
