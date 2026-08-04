import type { MetadataRoute } from "next";
import { SITE_URL } from "@/lib/site-metadata";

export default function robots(): MetadataRoute.Robots {
  const isProduction = !process.env.VERCEL_ENV || process.env.VERCEL_ENV === "production";

  if (!isProduction) {
    return {
      rules: {
        userAgent: "*",
        disallow: "/",
      },
    };
  }

  return {
    rules: {
      userAgent: "*",
      allow: "/",
      disallow: ["/admin/", "/api/", "/assessment/", "/dashboard/", "/reports/", "/signin/"],
    },
    sitemap: `${SITE_URL}/sitemap.xml`,
    host: SITE_URL,
  };
}
