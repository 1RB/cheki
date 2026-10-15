/**
 * The visible FAQs on /docs and /developers. Each list drives both the
 * rendered questions and that page's FAQPage JSON-LD, so the two never drift.
 *
 * The questions came from the /verify API endpoint and SDK pages, which now
 * 301 to the matching section of /docs and /developers (src/lib/seo-redirects.ts).
 * Client-safe: /developers is a client component.
 */
import { HOSTED_RATE_LIMITS } from "./guides-facts";

export interface ApiFaq {
  q: string;
  a: string;
}

const { verifyPerMinute, batchPerMinute, parsePerMinute, ocrPerMinute } = HOSTED_RATE_LIMITS;

export const docsFaqs: ApiFaq[] = [
  {
    q: "Do I need an API key for /api/verify?",
    a: "No. There is no API key, bearer token or OAuth. POST JSON with the bank id and the receipt link or reference; BOA, and older CBE receipts with only an FT reference, also need the account number.",
  },
  {
    q: "Is there a rate limit?",
    a: `Yes, per IP: /api/verify ${verifyPerMinute} per minute, /api/verify/batch ${batchPerMinute} per minute, /api/parse ${parsePerMinute} per minute and /api/ocr ${ocrPerMinute} per minute. Over the limit you get a 429 with a Retry-After header. Self-host for higher limits.`,
  },
  {
    q: "Does a 200 response mean the receipt is verified?",
    a: "No. Read the verified field. A 200 can still be unverified, such as a BOA QR code that BOA could not confirm (decodedOnly: true). Only verified: true means the bank's own record confirmed the receipt.",
  },
  {
    q: "What happens if one receipt in a batch fails?",
    a: "Each receipt is verified independently. If one fails (receipt not found, geo-blocked), the others still succeed. The results array keeps the request order, with a status for each receipt.",
  },
  {
    q: "Can /api/banks tell me which bank a reference belongs to?",
    a: "Not from that endpoint: it does not return reference formats. If you have the receipt link (from a QR code or a shared receipt), send it as the reference without a bank and cheki detects the bank from the link.",
  },
  {
    q: "How often is the health check updated?",
    a: "Results are cached for 5 minutes, on the server and at the CDN, so polling more often than that returns the same snapshot. Concurrent calls share one probe of the bank endpoints.",
  },
];

export const developersFaqs: ApiFaq[] = [
  {
    q: "How do I install the cheki TypeScript SDK?",
    a: 'Run npm install cheki-verify, then import { Cheki } from "cheki-verify". It has no runtime dependencies; it uses the platform\'s fetch (Node.js 20+).',
  },
  {
    q: "Can I use the TypeScript SDK in the browser?",
    a: `Call it from your server. The hosted API does not send CORS headers on the verify routes, so browser calls to cheki.et are blocked. Your backend also keeps your users' requests under its own per-IP rate limit (verify: ${verifyPerMinute} per minute).`,
  },
  {
    q: "How does the TypeScript SDK report errors?",
    a: "Any non-2xx response throws ChekiAPIError with the HTTP status, the server's error text and, for geo-blocked banks, a fallbackUrl. 429 throws ChekiRateLimitError (with the Retry-After seconds) and 413 throws ChekiPayloadTooLargeError. Bad input throws ChekiValidationError before any request, and network failures and timeouts throw ChekiNetworkError and ChekiTimeoutError. A receipt the bank does not have is a 422 ChekiAPIError.",
  },
  {
    q: "How do I install the cheki Python library?",
    a: "Install it with pip install cheki (Python 3.10+). It uses the requests library for HTTP calls and also installs the cheki-verify command-line tool.",
  },
  {
    q: "Does the Python library parse receipts itself?",
    a: "No. ChekiClient calls the cheki API, which fetches the receipt from the bank, parses it and applies the verification gate on the server. You get structured fields back (amount, sender, receiver, date) without parsing anything locally.",
  },
  {
    q: "Can I use the Python library without the API?",
    a: "The old direct mode, which fetched banks from your own machine, is deprecated: its parsers lack the server's verification gate and hardening, and it will be removed in the next major version. If you cannot use the hosted API, self-host the cheki server (on an Ethiopian IP if you need the geo-blocked banks) and point ChekiClient at it.",
  },
];

/** FAQPage JSON-LD for one of the lists above. */
export function faqPageJsonLd(faqs: readonly ApiFaq[]) {
  return {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: faqs.map((f) => ({ "@type": "Question", name: f.q, acceptedAnswer: { "@type": "Answer", text: f.a } })),
  };
}
