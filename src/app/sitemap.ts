import type { MetadataRoute } from "next";
import { banks } from "@/lib/banks";
import { guides } from "@/lib/guides";
import { latestGuideUpdate } from "@/lib/guides-index";

export default function sitemap(): MetadataRoute.Sitemap {
  const base = "https://cheki.et";
  const now = new Date();

  const staticPages: MetadataRoute.Sitemap = [
    { url: `${base}/`, lastModified: now, changeFrequency: "weekly", priority: 1 },
    { url: `${base}/banks`, lastModified: now, changeFrequency: "weekly", priority: 0.9 },
    { url: `${base}/guides`, lastModified: new Date(latestGuideUpdate(guides)), changeFrequency: "weekly", priority: 0.9 },
    { url: `${base}/developers`, lastModified: now, changeFrequency: "monthly", priority: 0.85 },
    { url: `${base}/compare`, lastModified: now, changeFrequency: "monthly", priority: 0.85 },
    { url: `${base}/docs`, lastModified: now, changeFrequency: "monthly", priority: 0.8 },
    { url: `${base}/endpoints`, lastModified: now, changeFrequency: "weekly", priority: 0.8 },
    { url: `${base}/status`, lastModified: now, changeFrequency: "daily", priority: 0.5 },
  ];

  // Only live providers: pages for banks still in development are noindexed
  // until their integration ships, so they stay out of the sitemap too.
  const bankPages: MetadataRoute.Sitemap = banks.filter((b) => b.status === "live").map((b) => ({
    url: `${base}/banks/${b.code}`,
    lastModified: now,
    changeFrequency: "weekly" as const,
    priority: 0.88,
  }));

  const guidePages: MetadataRoute.Sitemap = guides.map((g) => ({
    url: `${base}/guides/${g.slug}`,
    // The article's own last content change, not the build time.
    lastModified: new Date(g.updated),
    changeFrequency: "monthly" as const,
    priority: 0.85,
  }));

  // Canonical, indexable URLs only. Nothing that 301s (src/lib/seo-redirects.ts,
  // next.config.ts) belongs here.
  return [...staticPages, ...bankPages, ...guidePages];
}
