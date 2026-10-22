/**
 * One URL per search intent.
 *
 * The /verify/* programmatic pages, three bank how-to guides and the
 * comparison guide targeted the same searches as /banks/{code}, the topic
 * guides, /compare, /docs and /developers, and split ranking signals between
 * them. Their content now lives on the page that owns the intent, and each old
 * URL answers a single 301 to it.
 *
 * Every entry also names the heading on the destination that carries the old
 * page's main query, with its stable id, so the search surface survives the
 * move (tests/seo/consolidation.test.ts checks each one is really there).
 *
 * Imported by next.config.ts, so relative imports only.
 */
import manifest from "./manifest/banks.json";
import { withArticle } from "./indefinite-article";

export interface ConsolidatedUrl {
  /** The removed path. */
  source: string;
  /** The canonical page that owns the intent now (path only, no hash). */
  path: string;
  /** id of the heading on `path` that carries the old page's main query. */
  headingId: string;
  /** That heading's visible text. */
  heading: string;
  /** The old page's best distinct question, now in the destination's visible FAQ (and its FAQPage JSON-LD). */
  faq?: string;
  /**
   * Send the 301 to `path#headingId` instead of the top of the page: used when
   * the old page was about one section of the destination (one fraud tactic,
   * one API endpoint), not about the destination as a whole.
   */
  anchor?: boolean;
}

const shortName = (id: string): string => {
  const b = (manifest as { id: string; shortName?: string; initials?: string }[]).find((x) => x.id === id);
  if (!b) throw new Error(`seo-redirects: unknown bank ${id}`);
  return b.shortName ?? b.initials ?? id;
};

/** Bank page headings, shared with src/lib/bank-page-content.ts. */
export const BANK_HEADING = {
  requiredInfo: { id: "what-you-need", text: (short: string) => `What you need to verify ${withArticle(short)} receipt` },
  howToVerify: { id: "how-to-verify", text: (short: string) => `How to verify ${withArticle(short)} receipt, step by step` },
  fake: { id: "fake-receipt", text: (short: string) => `How to detect a fake ${short} receipt` },
  format: { id: "receipt-format", text: (short: string) => `${short} receipt format explained` },
  geoBlocking: { id: "geo-blocking", text: (short: string) => `${short} geo-blocking` },
  download: { id: "download-receipt", text: (short: string) => `How to get or download ${withArticle(short)} receipt (PDF)` },
} as const;

/** The banks that had their own fake-receipt and receipt-format pages. */
export const BANKS_WITH_TOPIC_PAGES = ["cbe", "telebirr", "boa", "mpesa", "dashen"] as const;
/** The banks that had a /guides/how-to-verify-{code}-receipt article. */
export const BANKS_WITH_HOWTO_GUIDES = ["cbe", "telebirr", "boa"] as const;

/** The question each bank how-to guide brought to the bank page's FAQ. */
const HOWTO_FAQ: Record<(typeof BANKS_WITH_HOWTO_GUIDES)[number], string> = {
  cbe: "Can I verify CBE receipts from outside Ethiopia?",
  telebirr: "Can I scan the QR code on a Telebirr receipt?",
  boa: "Can I verify inter-bank BOA transfers without the QR code?",
};

const FRAUD = "/guides/payment-fraud-ethiopia";
const FREE = "/guides/free-receipt-verification-no-api-key";

export const CONSOLIDATED_URLS: ConsolidatedUrl[] = [
  // Free / no-API-key verification
  { source: "/verify/free-receipt-verification-ethiopia", path: FREE, headingId: "free-receipt-verification", heading: "Free receipt verification in Ethiopia, step by step", faq: "Which banks can I verify for free?" },
  { source: "/verify/ethiopian-receipt-api-free", path: FREE, headingId: "free-api", heading: "Free Ethiopian receipt verification API", anchor: true, faq: "Is there an SDK for the free API?" },

  // Fraud: one guide, one section per tactic
  { source: "/verify/how-to-check-fake-receipt-ethiopia", path: FRAUD, headingId: "check-fake-receipt", heading: "How to check if a receipt is fake", faq: "What should I do if a receipt is fake?" },
  { source: "/verify/edited-screenshot-receipt-fraud", path: FRAUD, headingId: "edited-screenshots", heading: "1. Edited screenshot receipt fraud", anchor: true, faq: "Can I spot an edited screenshot by looking at it?" },
  { source: "/verify/old-receipt-reuse-fraud", path: FRAUD, headingId: "old-receipt-reuse", heading: "2. Old receipt reuse fraud", anchor: true, faq: "Can someone reuse a receipt from the same day?" },
  { source: "/verify/reference-number-fraud-ethiopia", path: FRAUD, headingId: "reference-number-fraud", heading: "4. Fabricated receipts and reference number fraud", anchor: true, faq: "Can I tell a fake reference number by its format?" },
  { source: "/verify/telebirr-sms-spoofing-fraud", path: FRAUD, headingId: "telebirr-sms-spoofing", heading: "6. Fake Telebirr receipts and SMS spoofing", anchor: true, faq: "How can I tell if a Telebirr SMS is fake?" },

  // Receipt formats reference
  { source: "/verify/ethiopian-bank-receipt-formats", path: "/guides/ethiopian-bank-receipt-formats", headingId: "at-a-glance", heading: "Ethiopian bank receipt formats at a glance", faq: "What format does CBE use for receipts?" },

  // Per-bank fraud and format pages, folded into the bank page
  ...BANKS_WITH_TOPIC_PAGES.flatMap((code): ConsolidatedUrl[] => [
    {
      source: `/verify/fake-${code}-receipt-detection`,
      path: `/banks/${code}`,
      headingId: BANK_HEADING.fake.id,
      heading: BANK_HEADING.fake.text(shortName(code)),
      anchor: true,
      faq: `How do I know if ${withArticle(shortName(code))} receipt is fake?`,
    },
    {
      source: `/verify/${code}-receipt-format-explained`,
      path: `/banks/${code}`,
      headingId: BANK_HEADING.format.id,
      heading: BANK_HEADING.format.text(shortName(code)),
      anchor: true,
      faq: `What format does ${shortName(code)} use for receipts?`,
    },
  ]),

  // Bank how-to guides: the bank page is the checker and the one page for "verify a X receipt"
  ...BANKS_WITH_HOWTO_GUIDES.map((code): ConsolidatedUrl => ({
    source: `/guides/how-to-verify-${code}-receipt`,
    path: `/banks/${code}`,
    headingId: BANK_HEADING.howToVerify.id,
    heading: BANK_HEADING.howToVerify.text(shortName(code)),
    faq: HOWTO_FAQ[code],
  })),

  // Comparison twins: /compare is the one comparison page
  { source: "/guides/check-et-vs-verify-et-vs-cheki", path: "/compare", headingId: "which-fits", heading: "check.et vs verify.et vs cheki: which one fits you", faq: "Does check.et have access to private bank APIs?" },
  { source: "/verify/cheki-vs-check-et-vs-verify-et", path: "/compare", headingId: "profiles", heading: "cheki vs the competition, service by service", faq: "Can I self-host check.et, verify.et, qbirr, or tinaverify?" },

  // API endpoint pages: one section each in the API docs
  { source: "/verify/verify-receipt-api-endpoint", path: "/docs", headingId: "verify", heading: "POST /api/verify: receipt verification API", anchor: true, faq: "Does a 200 response mean the receipt is verified?" },
  { source: "/verify/batch-verification-api", path: "/docs", headingId: "batch", heading: "POST /api/verify/batch: batch receipt verification", anchor: true, faq: "What happens if one receipt in a batch fails?" },
  { source: "/verify/bank-listing-api-endpoint", path: "/docs", headingId: "banks", heading: "GET /api/banks: list supported banks", anchor: true, faq: "Can /api/banks tell me which bank a reference belongs to?" },
  { source: "/verify/receipt-health-check-api", path: "/docs", headingId: "health", heading: "GET /api/health: bank endpoint health check", anchor: true, faq: "How often is the health check updated?" },

  // SDK pages
  { source: "/verify/receipt-verification-sdk-typescript", path: "/developers", headingId: "typescript-sdk", heading: "TypeScript SDK for receipt verification", anchor: true, faq: "How do I install the cheki TypeScript SDK?" },
  { source: "/verify/receipt-verification-python-library", path: "/developers", headingId: "python-library", heading: "Python library for receipt verification", anchor: true, faq: "How do I install the cheki Python library?" },

  // Business landing page
  { source: "/verify/receipt-verification-for-business", path: "/", headingId: "business", heading: "Receipt verification for your business", anchor: true, faq: "Can I integrate cheki into my POS system?" },

  // The /verify index
  { source: "/verify", path: "/guides", headingId: "gx-verify", heading: "Verify a receipt" },
];

/** Where the 301 for one entry points. */
export const redirectDestination = (u: ConsolidatedUrl): string => (u.anchor ? `${u.path}#${u.headingId}` : u.path);

/**
 * The redirects for next.config.ts. statusCode 301 rather than permanent: true
 * (which Next sends as 308): these are old indexed URLs, and 301 is the code
 * crawlers and link checkers expect for a page that moved for good.
 */
export const consolidatedRedirects = CONSOLIDATED_URLS.map((u) => ({
  source: u.source,
  destination: redirectDestination(u),
  statusCode: 301 as const,
}));

/** Every removed path, for tests and link checks. */
export const REMOVED_PATHS: readonly string[] = CONSOLIDATED_URLS.map((u) => u.source);
