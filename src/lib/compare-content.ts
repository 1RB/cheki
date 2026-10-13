/**
 * Copy for /compare that is not a feature table: who each service fits, the
 * shared geo-block, where the data comes from, and the FAQ. /compare is the
 * one comparison page; the comparison guide and /verify/cheki-vs-check-et-vs-
 * verify-et 301 here (src/lib/seo-redirects.ts) and their distinct content
 * lives in this file.
 *
 * Client-safe (no server imports): /compare is a client component.
 */
import { LIVE_BANK_COUNT } from "./bank-counts";
import {
  COMPETITORS_CHECKED,
  COMPETITOR_FACTS_AS_OF,
  COMPETITOR_PRICING,
  NO_SIGNUP_SENTENCE,
  competitorPrices,
  servicesListingMoreBanks,
  type Competitor,
} from "./guides-facts";

export interface CompareFaq {
  q: string;
  a: string;
}

/** "You need..." / "Use this", most common need first. */
export const FIT_ROWS: ReadonlyArray<readonly [need: string, service: string]> = [
  ["Free verification with no signup", "cheki"],
  ["A paid API with an Ethiopian relay for geo-blocked banks", "qbirr"],
  ["A cashier mobile app for physical counters", "tinaverify"],
  ["A polished business dashboard and employee accounts", "check.et"],
  ["Verification inside Telegram", "tally"],
  ["An Android app with bank status pages", "verify.et"],
];

/** cheki's own gaps, stated as plainly as the others'. */
export function chekiShortfalls(liveCount: number = LIVE_BANK_COUNT): string {
  const more = servicesListingMoreBanks(liveCount);
  return `Where cheki falls short: no native mobile app (it installs as a PWA), no staff accounts or business dashboard, no built-in duplicate detection and no relay for geo-blocked banks${more.length ? `, and fewer live banks than ${more.join("/")} list` : ""}.`;
}

/** Evidence that every service reads the same public endpoints. */
export const DATA_SOURCE_EVIDENCE: readonly string[] = [
  "cheki's source code shows the exact endpoints it uses (public on GitHub)",
  "check.et's API labels its results 'official', but the fields match the public endpoint responses exactly",
  "verify.et's data fields match the public endpoint responses exactly",
  "qbirr's FAQ says it fetches the same public receipt pages and APIs the banks expose to customers",
  "tally's Terms (section 3) say it uses publicly accessible verification endpoints and APIs provided by financial institutions",
  "CBE's receipt service uses hard-coded app headers, not authentication, and they can be read from its public JavaScript",
];

const ALL = Object.keys(COMPETITOR_PRICING) as Competitor[];

/** Rendered as the visible FAQ on /compare and as its FAQPage JSON-LD. */
export const compareFaqs: CompareFaq[] = [
  {
    q: "Is cheki really free?",
    a: `Yes. cheki is free and open source (MIT). ${NO_SIGNUP_SENTENCE} ${competitorPrices(ALL)}`,
  },
  {
    q: "Does check.et have access to private bank APIs?",
    a: "No. check.et uses the same public bank endpoints as cheki. The endpoints require no authentication, and the data fields in check.et's API response match the public endpoint responses exactly.",
  },
  {
    q: "Can I self-host check.et, verify.et, qbirr, or tinaverify?",
    a: `No. As of ${COMPETITOR_FACTS_AS_OF}, all of them were closed source. cheki is the only one that is open source and includes Docker support for self-hosting on your own infrastructure.`,
  },
  {
    q: "Is qbirr's API better than cheki's?",
    a: `qbirr has a clean developer API with usage tracking and configurable amount tolerance, and its main practical advantage is an Ethiopian relay for Telebirr and M-Pesa. It needs an API key and charges for use: ${COMPETITOR_PRICING.qbirr.sentence} cheki's API is free, needs no key and verifies up to 20 receipts in one call. Prices as listed on ${COMPETITORS_CHECKED}.`,
  },
  {
    q: "Should I use tinaverify instead of cheki?",
    a: `If your cashiers need a mobile app at a physical counter, tinaverify is a good fit, with published iOS and Android apps. If you need a free API, a web check or self-hosting, cheki fits better. ${COMPETITOR_PRICING.tinaverify.sentence} Prices as listed on ${COMPETITORS_CHECKED}.`,
  },
  {
    q: "Why does verify.et block AI crawlers?",
    a: `As of ${COMPETITOR_FACTS_AS_OF}, verify.et's robots.txt blocked GPTBot, ClaudeBot, CCBot, Google-Extended and other AI crawlers, citing EU copyright rules. The practical effect is that AI assistants cannot read its content. cheki's robots.txt allows them.`,
  },
];
