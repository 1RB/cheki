/**
 * Facts the guide articles quote that are not derived from the manifest.
 * Kept in one place so a re-check updates every article at once.
 *
 * cheki's own bank counts never live here: they come from ./bank-counts.
 */
import { limiters } from "./rate-limit";

/** When competitor prices and bank lists were last re-checked on their public sites. */
export const COMPETITORS_CHECKED = "12 October 2026";

/** Banks and wallets each service listed on its own site on COMPETITORS_CHECKED. */
export const COMPETITOR_BANKS_LISTED = {
  "check.et": 10,
  "verify.et": 10,
  qbirr: 7,
  tinaverify: 6,
  tally: 4,
} as const;

export type Competitor = keyof typeof COMPETITOR_BANKS_LISTED;

/** Services that list more banks than cheki has live, in table order. */
export function servicesListingMoreBanks(liveCount: number): Competitor[] {
  return (Object.keys(COMPETITOR_BANKS_LISTED) as Competitor[]).filter((c) => COMPETITOR_BANKS_LISTED[c] > liveCount);
}

/** Per-minute limits of the hosted API, read from the limiters themselves. */
const perMinute = (l: { limit: number; windowMs: number }) => Math.round((l.limit * 60_000) / l.windowMs);

export const HOSTED_RATE_LIMITS = {
  verifyPerMinute: perMinute(limiters.verify),
  batchPerMinute: perMinute(limiters.batch),
} as const;

/** "fair per-IP rate limits (verify 30 per minute, batch 5 per minute); self-host for more." */
export const RATE_LIMIT_SENTENCE = `fair per-IP rate limits (verify ${HOSTED_RATE_LIMITS.verifyPerMinute} per minute, batch ${HOSTED_RATE_LIMITS.batchPerMinute} per minute); self-host for more.`;
