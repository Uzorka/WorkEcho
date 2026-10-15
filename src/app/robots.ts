import type { MetadataRoute } from "next";
import { publicEnv } from "@/lib/env";
import { NO_CRAWL_PATHS, allowIndexing } from "@/lib/seo";

export const dynamic = "force-dynamic";

export default function robots(): MetadataRoute.Robots {
  if (!allowIndexing(process.env.VERCEL_ENV)) return { rules: { userAgent: "*", disallow: "/" } };
  const site = publicEnv().NEXT_PUBLIC_SITE_URL;
  return {
    rules: { userAgent: "*", allow: "/", disallow: NO_CRAWL_PATHS },
    sitemap: `${site}/sitemap.xml`,
  };
}
