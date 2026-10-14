/**
 * Every page path analytics may report (see analyticsUrl in ./url). Server
 * side only: it reads the bank manifest and the guides, and the root layout
 * hands the resulting list to the client component.
 *
 * STATIC_PAGES must list each non-dynamic page under src/app; a test fails
 * when a page is added without deciding here whether it is counted.
 */
import { banks } from "@/lib/banks";
import { articles } from "@/lib/guides";
import { OG_ARMS } from "@/lib/og/ab";

export const STATIC_PAGES = ["/", "/banks", "/guides", "/developers", "/compare", "/docs", "/endpoints", "/status"] as const;

export function analyticsPaths(): string[] {
  return [
    ...STATIC_PAGES,
    ...banks.map((b) => `/banks/${b.code}`),
    ...articles.map((a) => `/guides/${a.slug}`),
    ...OG_ARMS.map((v) => `/ab/${v}`),
  ];
}
