/**
 * Open Graph A/B test for the home card.
 *
 * Platforms (Telegram, WhatsApp, X, Facebook) fetch og:image once per URL and
 * cache it, so the split is by link, not by visitor:
 *
 *   https://cheki.et/?v=a   -> OG_AB.a card
 *   https://cheki.et/?v=b   -> OG_AB.b card
 *
 * next.config.ts rewrites those to /ab/{a,b} (the URL in the address bar stays
 * "/?v=a"). The page is the normal home page, noindexed with canonical "/".
 * The site-wide analytics (src/lib/analytics/url.ts) report its visits as
 * "/ab/{arm}", so the two arms show up as separate pages.
 */
import type { OgVariant } from "@/lib/og/variant";

export const OG_AB = {
  a: "pixels",
  b: "ember",
} as const satisfies Record<string, OgVariant>;

export type OgArm = keyof typeof OG_AB;
export const OG_ARMS = Object.keys(OG_AB) as OgArm[];

export function isOgArm(v: string): v is OgArm {
  return (OG_ARMS as string[]).includes(v);
}
