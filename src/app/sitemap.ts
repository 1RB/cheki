import type { MetadataRoute } from "next";
import { banks } from "@/lib/banks";
import { guides } from "@/lib/guides";

export default function sitemap(): MetadataRoute.Sitemap {
  const base = "https://cheki.app";
  const now = new Date();

  const staticPages: MetadataRoute.Sitemap = [
    { url: `${base}/`, lastModified: now, changeFrequency: "weekly", priority: 1 },
    { url: `${base}/banks`, lastModified: now, changeFrequency: "weekly", priority: 0.9 },
    { url: `${base}/guides`, lastModified: now, changeFrequency: "weekly", priority: 0.9 },
    { url: `${base}/developers`, lastModified: now, changeFrequency: "monthly", priority: 0.85 },
    { url: `${base}/compare`, lastModified: now, changeFrequency: "monthly", priority: 0.85 },
    { url: `${base}/docs`, lastModified: now, changeFrequency: "monthly", priority: 0.8 },
  ];

  const bankPages: MetadataRoute.Sitemap = banks.map((b) => ({
    url: `${base}/banks/${b.code}`,
    lastModified: now,
    changeFrequency: "weekly" as const,
    priority: 0.88,
  }));

  const guidePages: MetadataRoute.Sitemap = guides.map((g) => ({
    url: `${base}/guides/${g.slug}`,
    lastModified: now,
    changeFrequency: "monthly" as const,
    priority: 0.85,
  }));

  return [...staticPages, ...bankPages, ...guidePages];
}
