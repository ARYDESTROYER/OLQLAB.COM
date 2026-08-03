import type { MetadataRoute } from "next";
import { SITE_URL } from "@/lib/site-metadata";

const routes = [
  { path: "/", priority: 1, changeFrequency: "monthly" as const },
  { path: "/about", priority: 0.8, changeFrequency: "monthly" as const },
  { path: "/framework", priority: 0.8, changeFrequency: "monthly" as const },
  { path: "/assessments", priority: 0.9, changeFrequency: "monthly" as const },
  { path: "/coaching", priority: 0.9, changeFrequency: "monthly" as const },
  { path: "/blindspot", priority: 0.8, changeFrequency: "monthly" as const },
  { path: "/work", priority: 0.8, changeFrequency: "monthly" as const },
  { path: "/oql", priority: 0.7, changeFrequency: "monthly" as const },
  { path: "/contact", priority: 0.7, changeFrequency: "yearly" as const },
];

export default function sitemap(): MetadataRoute.Sitemap {
  return routes.map((route) => ({
    url: `${SITE_URL}${route.path}`,
    changeFrequency: route.changeFrequency,
    priority: route.priority,
  }));
}
