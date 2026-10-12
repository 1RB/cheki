/**
 * Facts the guides, /compare and the SEO pages quote that are not derived
 * from the manifest. Kept in one place so a re-check updates every page at
 * once.
 *
 * cheki's own bank counts never live here: they come from ./bank-counts.
 * No server imports either: /compare is a client component.
 */
import { RATE_LIMITS } from "./rate-limit-config";

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

/** Everything else said about the other services was last checked then. */
export const COMPETITOR_FACTS_AS_OF = "June 2026";

export interface CompetitorPricing {
  /** Paid plans, short enough for a table cell. */
  price: string;
  freeTier: string;
  perVerification: string;
  /** One sentence for prose and FAQ answers, starting with the service's name. */
  sentence: string;
}

/** Prices each service listed on its own site on COMPETITORS_CHECKED, in table order. */
export const COMPETITOR_PRICING: Record<Competitor, CompetitorPricing> = {
  "check.et": {
    price: "499 ETB/mo or 4,990/yr",
    freeTier: "200 (one-time)",
    perVerification: "Flat fee (Pro is unlimited)",
    sentence: "check.et charges 499 ETB/month or 4,990 ETB/year after 200 free verifications (one-time, not monthly).",
  },
  "verify.et": {
    price: "500-3,000 ETB/mo (API), 4,000 ETB/yr (app)",
    freeTier: "200/mo",
    perVerification: "~0.10 ETB (API)",
    sentence: "verify.et has a free tier of 200 verifications a month, then API plans from 500 to 3,000 ETB/month or a 4,000 ETB/year app plan.",
  },
  qbirr: {
    price: "500-8,000 ETB/mo",
    freeTier: "50/mo",
    perVerification: "0.08-0.50 ETB",
    sentence: "qbirr gives 50 free verifications a month, then charges 500-8,000 ETB/month.",
  },
  tinaverify: {
    price: "3,000-8,000 ETB per 90 days",
    freeTier: "None listed",
    perVerification: "0.84-0.91 ETB",
    sentence: "tinaverify sells credits for 3,000-8,000 ETB that expire after 90 days.",
  },
  tally: {
    price: "500-12,000+ ETB/mo",
    freeTier: "1-day trial",
    perVerification: "Flat fee",
    sentence: "tally charges 500-12,000+ ETB/month plus VAT, after a 1-day trial.",
  },
};

/** cheki's own row in the same shape. The hosted API is rate limited, and the row says so. */
export const CHEKI_PRICING = {
  price: "Free",
  freeTier: "No signup, no key; per-IP rate limits",
  perVerification: "0 ETB",
} as const;

/** "check.et charges .... verify.et has .... Prices as listed on each service's site on 12 October 2026." */
export function competitorPrices(services: Competitor[]): string {
  return `${services.map((c) => COMPETITOR_PRICING[c].sentence).join(" ")} Prices as listed on each service's site on ${COMPETITORS_CHECKED}.`;
}

/** Services that list more banks than cheki has live, in table order. */
export function servicesListingMoreBanks(liveCount: number): Competitor[] {
  return (Object.keys(COMPETITOR_BANKS_LISTED) as Competitor[]).filter((c) => COMPETITOR_BANKS_LISTED[c] > liveCount);
}

/** Per-minute limits of the hosted API, read from the table the limiters are built from. */
const perMinute = (l: { limit: number; windowMs: number }) => Math.round((l.limit * 60_000) / l.windowMs);

export const HOSTED_RATE_LIMITS = {
  verifyPerMinute: perMinute(RATE_LIMITS.verify),
  batchPerMinute: perMinute(RATE_LIMITS.batch),
  parsePerMinute: perMinute(RATE_LIMITS.parse),
  ocrPerMinute: perMinute(RATE_LIMITS.ocr),
} as const;

/** "fair per-IP rate limits (verify 30 per minute, batch 5 per minute); self-host for more." */
export const RATE_LIMIT_SENTENCE = `fair per-IP rate limits (verify ${HOSTED_RATE_LIMITS.verifyPerMinute} per minute, batch ${HOSTED_RATE_LIMITS.batchPerMinute} per minute); self-host for more.`;

/** "per-IP rate limits (verify 30/min, batch 5/min)", for meta descriptions and table cells. */
export const RATE_LIMIT_SHORT = `per-IP rate limits (verify ${HOSTED_RATE_LIMITS.verifyPerMinute}/min, batch ${HOSTED_RATE_LIMITS.batchPerMinute}/min)`;

/** "No signup and no API key, with fair per-IP rate limits (...); self-host for more." */
export const NO_SIGNUP_SENTENCE = `No signup and no API key, with ${RATE_LIMIT_SENTENCE}`;
