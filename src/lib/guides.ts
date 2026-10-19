import { internalPageLink, type InternalPageLink } from "./internal-links";
import { IN_DEVELOPMENT_BANK_COUNT, LIVE_BANK_COUNT, TOTAL_BANK_COUNT, liveBankList } from "./bank-counts";
import { COMPETITORS_CHECKED, RATE_LIMIT_SENTENCE } from "./guides-facts";
import { DEFAULT_TTL_MS } from "./receipt-cache";
// Block-based content system for guides and blog posts
// Supports rich formatting: text, lists, code, callouts, tables, quotes, steps

export type ContentBlock =
  /**
   * An h2. `id` is a stable anchor for headings other pages and redirects link
   * to (src/lib/seo-redirects.ts); without it the id is "section-{index}".
   */
  | { type: "heading"; text: string; id?: string }
  | { type: "text"; text: string }
  | { type: "list"; items: string[] }
  | { type: "ordered"; items: string[] }
  | { type: "code"; lang?: string; code: string }
  | { type: "callout"; variant: "info" | "warning" | "tip" | "success" | "danger" | "quote"; title?: string; text: string }
  | { type: "table"; headers: string[]; rows: string[][] }
  | { type: "quote"; text: string; cite?: string }
  | { type: "steps"; items: { title: string; text: string }[] }
  | { type: "divider" };

export interface Article {
  slug: string;
  title: string;
  description: string;
  category: "bank" | "fraud" | "business" | "api" | "comparison" | "technical" | "open-source";
  bankCode?: string;
  excerpt: string;
  /** First published (YYYY-MM-DD). */
  date: string;
  /**
   * Last content change (YYYY-MM-DD). Rendered as "Updated", emitted as
   * dateModified in the Article JSON-LD and used as the sitemap lastmod.
   * Bump it whenever the article's text changes.
   */
  updated: string;
  readTime: string;
  content: ContentBlock[];
  seo: {
    title: string;
    description: string;
    keywords: string[];
  };
  faq?: { q: string; a: string }[];
  /** Slugs of related guides, shown first under "Continue reading". */
  related?: string[];
  /**
   * Related non-guide pages (live bank pages and hubs, see
   * src/lib/internal-links.ts), listed after the related guides. Gives bank
   * pages and hubs in-content links from the guides that discuss them.
   */
  relatedPages?: string[];
}

/** How long a bank-confirmed result stays in the server's memory (receipt-cache). */
const CACHE_HOURS = Math.round(DEFAULT_TTL_MS / 3_600_000);

/**
 * How to redact a receipt before posting it, shared by the fraud guide and
 * the contribution guide. What cheki keeps follows src/lib/receipt-cache.ts
 * and the privacy page (src/lib/trust-pages.ts).
 */
export const REDACT_BEFORE_SHARING: ContentBlock[] = [
  { type: "heading", id: "redact-before-sharing", text: "Redact a receipt before you share it publicly" },
  { type: "text", text: "Receipts get posted to Telegram groups, Facebook and GitHub issues, often to warn others about a scam. A receipt shows more than the payment, so cover these fields first:" },
  {
    type: "list",
    items: [
      "Account numbers. Keep at most the last 4 digits, the way cheki shows them (1****6171).",
      "Phone numbers, including the payer's telebirr or M-Pesa number.",
      "Full names of the payer and the receiver. Initials are enough to tell the story.",
      "The reference, Receipt ID, receipt link and QR code when the post is public. Anyone who has them can open the full receipt at the bank.",
    ],
  },
  { type: "text", text: "Cover each field with a solid box. A light blur or pixel filter can sometimes be reversed. Crop out the status bar and anything else on the screen too." },
  { type: "text", text: `You do not need to share a receipt with anyone to check it. cheki has no accounts and no database. It fetches the receipt from the bank and shows you the result. A receipt the bank confirmed stays in the server's memory for up to ${CACHE_HOURS} hours, so checking it again is instant, and is then dropped. Details: https://cheki.et/privacy` },
];

export const articles: Article[] = [
  {
    slug: "cbe-receipt-qr-code",
    title: "CBE Receipt QR Codes: What They Contain and How to Scan Them",
    description:
      "CBE's new receipt sharing system uses short URLs and QR codes. Learn what's inside them, how to scan them, and how to verify instantly with cheki.",
    category: "bank",
    bankCode: "cbe",
    excerpt:
      "CBE launched a new receipt sharing system at mbreciept.cbe.com.et. Here's what the QR codes contain, how the API works, and why it makes verification easier.",
    date: "2026-06-18",
    updated: "2026-10-19",
    readTime: "4 min",
    content: [
      { type: "text", text: "Commercial Bank of Ethiopia recently launched a new receipt sharing system. When you complete a transfer in the CBE mobile app, you can now share a short link like https://mbreciept.cbe.com.et/fHCxExampleRcpt01. The recipient opens this link and sees the full receipt in their browser, no app required." },
      { type: "text", text: "This is a significant upgrade from the old system, which required the FT reference number and the last 8 digits of the receiving account to construct a receipt URL. The new system uses a single short ID and returns clean JSON data instead of a PDF." },

      { type: "heading", text: "What the QR code contains" },
      { type: "text", text: "The QR code on a CBE receipt encodes a URL in this format:" },
      { type: "code", code: "https://mbreciept.cbe.com.et/{SHORT_ID}" },
      { type: "text", text: "The short ID is a random string like fHCxExampleRcpt01. It maps to a single transaction on CBE's backend. When you scan the QR code, you get this URL, which you can paste into cheki's URL input mode to verify instantly." },

      { type: "callout", variant: "tip", title: "Try it now", text: "Open cheki.et and paste any mbreciept.cbe.com.et link into the receipt field. cheki calls CBE's JSON API and returns the full transaction data in under 2 seconds." },

      { type: "heading", text: "The API behind the receipts" },
      { type: "text", text: "The mbreciept.cbe.com.et page is a Nuxt.js single-page app. When it loads, it calls a JSON API at a different domain:" },
      { type: "code", lang: "http", code: "GET https://Mb.cbe.com.et/api/v1/transactions/public/transaction-detail/{SHORT_ID}\n\nHeaders:\n  X-App-ID: d1292e42-7400-49de-a2d3-9731caa4c819\n  X-App-Version: 0a01980b-9859-1369-8198-59f403820000" },
      { type: "text", text: "The response is structured JSON with all the transaction details:" },
      { type: "code", lang: "json", code: '{\n  "id": "FT26SAMPLE01",\n  "transactionType": "ACNX",\n  "debitAccountNo": "1********4321",\n  "creditAccountNo": "1********6171",\n  "amountCredited": "1250.50",\n  "creditCurrency": "ETB",\n  "dateTimes": ["Thu 2026-10-01  EAT (UTC+03:00)"],\n  "debitAccountHolder": "ABEBE KEBEDE",\n  "creditAccountHolder": "TIGIST ALEMU",\n  "paymentDetails": ["Invoice 42"]\n}' },
      { type: "text", text: "cheki uses this API directly. When you paste a mbreciept link, cheki extracts the short ID, calls the JSON API, and returns the parsed result. No PDF parsing needed, which makes it faster and more reliable than the old endpoint." },

      { type: "heading", text: "Old vs new CBE receipt system" },
      {
        type: "table",
        headers: ["Feature", "Old system (apps.cbe.com.et)", "New system (mbreciept.cbe.com.et)"],
        rows: [
          ["Input needed", "FT reference + last 8 digits of account", "Single short URL or QR scan"],
          ["Response format", "PDF document", "Structured JSON"],
          ["Parsing", "Requires PDF text extraction", "Direct JSON parsing"],
          ["Speed", "2-4 seconds", "0.5-2 seconds"],
          ["Account number required", "Yes", "No"],
          ["QR code support", "No", "Yes (encodes receipt URL)"],
          ["Share link", "Long URL with sensitive data", "Short random ID"],
        ],
      },

      { type: "callout", variant: "warning", title: "Old system: legacy, often unreachable", text: "The old endpoint (apps.cbe.com.et:100) is CBE's legacy receipt system. Another verifier reports apps.cbe.com.et unreachable since July 2026, and it often does not answer cheki either, though it has answered at times (October 2026). cheki still tries an FT reference + account, but the mbreciept.cbe.com.et link is the reliable way to verify." },

      { type: "heading", text: "How to scan a CBE QR code with cheki" },
      {
        type: "steps",
        items: [
          { title: "Open cheki.et on your phone", text: "The QR scanner uses your phone's camera, so mobile works best." },
          { title: "Tap Scan QR with camera", text: "It's the camera button next to the receipt field. Allow camera access when prompted." },
          { title: "Point at the QR code", text: "Hold your phone over the QR code on the receipt. A scan box overlay shows where to aim." },
          { title: "Automatic verification", text: "Once the QR code is detected, the URL is extracted and verification happens automatically. The result appears in under 2 seconds." },
        ],
      },

      { type: "heading", text: "Privacy and security" },
      { type: "text", text: "The new CBE receipt system masks account numbers in the API response. Instead of showing the full account number, it returns a masked version like 1********8348. This is better for privacy than the old PDF system, which included full account numbers in the document text." },
      { type: "text", text: "The short ID in the URL is random and not guessable, which prevents receipt enumeration. You can only access a receipt if someone shares the link with you." },
      { type: "callout", variant: "warning", title: "X-App-ID headers", text: "The new CBE API requires hardcoded X-App-ID and X-App-Version headers. These are embedded in the mbreciept.cbe.com.et JavaScript bundle. If CBE rotates these headers, cheki will need to update them. The old PDF endpoint has no such requirement." },

      { type: "heading", text: "Inside the short ID: what we found" },
      { type: "text", text: "We reverse-engineered the token format. The short ID in a v1 mbreciept URL (like fHCxExampleRcpt01) is standard base64url encoding of 13 bytes. The first 3 bytes are a fixed header (7c70b1, which is why all v1 tokens start with \"fHCx\"). The remaining 10 bytes are an encrypted payload containing the transaction's FT reference." },
      { type: "text", text: "The encryption uses a keyed cipher with per-token seeding. We verified this by comparing multiple tokens: the same plaintext byte at the same position produces different ciphertext bytes across receipts. This rules out simple encoding schemes (XOR, base-N packing, substitution) and confirms the payload is cryptographically protected." },
      { type: "text", text: "CBE's server validates tokens cryptographically. If you submit an old FT reference to the new API, it rejects it with \"Security Alert: Invalid or tampered legacy token!\" This is intentional. The new system prevents receipt enumeration. With the old system, anyone could guess FT references and pull receipts. With tokens, you can only verify receipts that were explicitly shared with you." },
      { type: "text", text: "CBE has already shipped a v2 token format. Newer receipts use URLs like https://mbreciept.cbe.com.et/v2-hfHCxExample0001, which carry the v2- prefix. The v2 payload is 15 bytes (vs v1's 13) and uses a different layout. Both v1 and v2 tokens work on the same API endpoint. cheki passes the full token through unchanged, so both formats work automatically." },
      { type: "callout", variant: "info", title: "Can you generate a token from an FT reference?", text: "No. The payload is encrypted with a server-side secret. There is no public endpoint to convert FT references to tokens, and the CBE mobile app generates tokens server-side at share-time. If you only have an FT reference, you cannot construct a valid mbreciept URL." },
      { type: "callout", variant: "warning", title: "Legacy endpoint status", text: "The old CBE receipt endpoint (apps.cbe.com.et:100) is a legacy format. Another verifier reports apps.cbe.com.et unreachable since July 2026, and it often does not answer cheki either, though it has answered at times (October 2026). cheki still tries an old FT reference and account suffix, and tells you plainly when CBE does not answer. The reliable fix is to ask the sender for the mbreciept.cbe.com.et link." },
    ],
    faq: [
      { q: "Can I still use the old CBE receipt system with FT reference and account number?", a: "cheki still accepts it as a legacy format: enter the FT reference and the last 8 digits of the receiving account. CBE's old endpoint (apps.cbe.com.et:100) is often unreachable, so if the check fails, ask the sender to share the mbreciept.cbe.com.et link from the CBE app. It works with a single tap in cheki." },
      { q: "Do I need the CBE app to scan QR codes?", a: "No. cheki has a built-in QR scanner that uses your phone's camera. Open cheki.et, tap Scan QR with camera, and point it at the QR code on the receipt." },
      { q: "What if the CBE receipt link doesn't work?", a: "The mbreciept.cbe.com.et service may occasionally be down. If the link returns a 502 or timeout, try again later. An old FT reference + account is a legacy fallback, but that endpoint is often unreachable too." },
    ],
    related: ["free-receipt-verification-no-api-key", "ethiopian-bank-receipt-formats", "payment-fraud-ethiopia"],
    relatedPages: ["/banks/cbe"],
    seo: {
      title: "CBE Receipt QR Codes: What They Contain and How to Scan Them",
      description: "CBE's new receipt sharing system uses short URLs and QR codes. Learn what's inside, how the API works, and how to verify instantly with cheki for free.",
      keywords: ["CBE receipt QR code", "mbreciept cbe", "CBE receipt sharing", "scan CBE QR code", "CBE new receipt system", "verify CBE receipt link"],
    },
  },
  {
    slug: "free-receipt-verification-no-api-key",
    title: "Free Ethiopian Receipt Verification Without API Keys or Signup",
    description:
      "Stop paying check.et 499 ETB/month. Verify CBE, Telebirr, BOA, and M-Pesa receipts for free with no signup and no API key, under fair per-IP rate limits. Here's how.",
    category: "comparison",
    excerpt:
      "check.et charges 499 ETB/month after 200 one-time free verifications, and verify.et's API plans start at 500 ETB/month. Both use the same public bank endpoints cheki uses for free. Here's the complete guide to free verification.",
    date: "2026-06-18",
    updated: "2026-10-19",
    readTime: "5 min",
    content: [
      { type: "text", text: "If you're an Ethiopian business owner, you've probably heard of check.et or verify.et. They verify bank receipts so you can confirm payments before releasing goods. They charge you for data that is already free." },
      { type: "callout", variant: "warning", title: "The reality", text: "check.et and verify.et verify receipts by hitting the exact same public bank URLs that anyone can access for free. They add a pricing layer on top of public data. cheki removes that layer." },

      { type: "heading", text: "What check.et, verify.et, qbirr, tinaverify, and tally actually do" },
      { type: "text", text: "Every Ethiopian bank publishes transaction receipts at public URLs. These URLs require no authentication. Here are the actual endpoints:" },
      {
        type: "table",
        headers: ["Bank", "Public endpoint", "Format", "Cost"],
        rows: [
          ["CBE (new)", "Mb.cbe.com.et/api/v1/transactions/public/transaction-detail/{id}", "JSON", "Free"],
          ["CBE (legacy)", "apps.cbe.com.et:100/?id={ref}{account}", "PDF", "Free"],
          ["Telebirr", "transactioninfo.ethiotelecom.et/receipt/{ref}", "HTML", "Free"],
          ["BOA", "cs.bankofabyssinia.com/api/onlineSlip/getDetails/?id={ref}{acct}", "JSON", "Free"],
          ["Dashen", "receipts.dashenbanksc.com/receipt/{ref}", "HTML", "Free"],
          ["M-Pesa (beta)", "m-pesabusiness.safaricom.et/api/receipt/getReceipt?trxNo={ref}", "PDF inside JSON", "Free"],
        ],
      },
      { type: "text", text: "check.et, verify.et, qbirr, tinaverify, and tally all fetch these URLs, parse the response, and return structured data. That's exactly what cheki does, except cheki is free and open source." },

      { type: "heading", text: "Pricing comparison" },
      {
        type: "table",
        headers: ["Service", "Free tier", "Paid plan", "Per verification cost"],
        rows: [
          ["cheki", "No signup, no key; per-IP rate limits", "None (free)", "0 ETB"],
          ["check.et", "200 (one-time, not monthly)", "499 ETB/month or 4,990 ETB/year", "Flat fee (Pro is unlimited)"],
          ["verify.et", "200/month", "500-3,000 ETB/month (API), 699 ETB/month or 4,000 ETB/year (app)", "~0.10 ETB per API verification"],
          ["qbirr", "50/month", "500-8,000 ETB/month", "0.08-0.50 ETB per verification"],
          ["tinaverify", "None listed", "3,000-8,000 ETB per 90 days (credits)", "0.84-0.91 ETB per verification"],
          ["tally", "1-day trial", "500-12,000+ ETB/month", "Flat fee"],
        ],
      },
      { type: "text", text: `Prices as listed on each service's public site on ${COMPETITORS_CHECKED}. Other details about these services are as of June 2026.` },
      { type: "callout", variant: "info", title: "Important detail", text: `check.et's 200 free verifications are a one-time allowance, not monthly. Once you use them, you must upgrade. cheki has no allowance to use up: no signup and no key, just ${RATE_LIMIT_SENTENCE}` },

      { type: "heading", id: "free-receipt-verification", text: "Free receipt verification in Ethiopia, step by step" },
      {
        type: "steps",
        items: [
          { title: "Go to cheki.et", text: "No signup, no login, no account creation. Just open the page and start verifying." },
          { title: "Paste your receipt reference or URL", text: "Paste the CBE receipt link (or its Receipt ID), a transaction ID for Telebirr, or any full receipt URL. cheki auto-detects the bank. An older CBE receipt with only an FT reference also needs the last 8 digits of the receiving account." },
          { title: "Click Verify", text: "cheki fetches the receipt from the bank's public endpoint and shows you the result in 1-3 seconds." },
          { title: "Review the data", text: "You'll see the sender name, receiver name, amount, date, and source URL. Copy the JSON if you need it for your records." },
        ],
      },

      { type: "heading", id: "free-api", text: "Free Ethiopian receipt verification API" },
      { type: "text", text: "If you're a developer, cheki provides a free REST API with no authentication:" },
      { type: "code", lang: "bash", code: 'curl -X POST https://cheki.et/api/verify \\\n  -H "Content-Type: application/json" \\\n  -d \'{"bank":"cbe","reference":"https://mbreciept.cbe.com.et/fHCxExampleRcpt01"}\'' },
      { type: "text", text: "No API key header. No Bearer token. Just POST and get JSON back. Requests are rate limited per IP: verify 30 per minute, batch 5 per minute, parse and OCR 20 per minute each. Over the limit you get a 429 with a Retry-After header." },
      { type: "text", text: "The same keyless API covers every step of an integration:" },
      { type: "list", items: [
        "POST /api/verify: verify one receipt",
        "POST /api/verify/batch: verify up to 20 receipts, 5 at a time",
        "GET /api/banks: every supported bank, with what each one needs",
        "GET /api/health: which bank endpoints answer right now",
        "GET /api/receipt: open the bank's own copy of a receipt",
      ]},
      { type: "text", text: "Compare this to check.et, which requires a business account, an API key generation step, and Authorization headers:" },
      { type: "code", lang: "bash", code: '# check.et requires all this:\nexport CHECK_ET_API_KEY=chk_xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx\n\ncurl -X POST https://api.check.et/api/v1/verify \\\n  -H "Authorization: Bearer $CHECK_ET_API_KEY" \\\n  -H "Content-Type: application/json" \\\n  -d \'{"bank":"cbe","transaction_number":"FT26SAMPLE01","account_number":"1000000006171"}\'' },

      { type: "callout", variant: "success", title: "Migrating from check.et", text: "If you're currently using check.et's API, migrating to cheki is simple. Change the URL from api.check.et to cheki.et, remove the Authorization header, and rename transaction_number to reference and account_number to accountNumber. The response structure is similar." },

      { type: "heading", text: "What about verify.et?" },
      { type: "text", text: `verify.et is made by Suba Software. On ${COMPETITORS_CHECKED} its pricing page listed a free Hobby tier (200 verifications a month), API plans from 500 ETB a month, and app plans of 699 ETB a month (team) or 4,000 ETB a year, and its site offered a free receipt check with no account. It has an Android app on the Play Store, and as of June 2026 it used Telegram for sign-in. Its REST API is the way to integrate: its docs say official SDK packages are not published yet.` },
      { type: "text", text: `verify.et's robots.txt blocked AI crawlers as of June 2026; on ${COMPETITORS_CHECKED} it welcomed them by name, and cheki's allows them too. cheki also publishes an llms.txt file with key facts for AI assistants.` },

      { type: "heading", text: "Self-hosting for zero cost and zero dependency" },
      { type: "text", text: "If you don't want to depend on cheki.et at all, you can self-host the entire system with Docker:" },
      { type: "code", lang: "bash", code: "git clone https://github.com/1RB/cheki.git\ncd cheki\ndocker-compose up -d\n\n# Your API is now at http://localhost:3000/api/verify\n# No external dependencies. No API calls to cheki.et.\n# Full control. MIT licensed." },
      { type: "text", text: "Self-hosting on an Ethiopian IP also bypasses Telebirr and M-Pesa geo-blocking, which affects both cheki's hosted version and check.et's servers." },
    ],
    faq: [
      { q: "Is cheki really free forever?", a: "Yes. cheki is MIT licensed open source. The hosted version at cheki.et is free with no signup and no API key; it applies fair per-IP rate limits (verify 30 per minute, batch 5 per minute) so one client cannot starve everyone else. You can also self-host with Docker at zero cost and set your own limits. There is no premium tier, no credit system, and no plan to add one." },
      { q: "How is cheki different from check.et?", a: "cheki uses the same public bank endpoints as check.et. The difference is that cheki is free, open source, requires no signup or API key, and allows you to self-host. check.et charges 499 ETB/month after 200 one-time free verifications." },
      { q: "Can I use cheki for my business?", a: "Yes. cheki has no per-business or per-user restrictions. Use the web interface, the API, or self-host with Docker. The hosted API is rate limited per IP (verify 30 per minute, batch 5 per minute); self-host with Docker if you need more." },
      { q: "Which banks can I verify for free?", a: `All ${LIVE_BANK_COUNT} live banks and wallets: ${liveBankList()}. Each one is read from the receipt page or API the bank itself publishes.` },
      { q: "Is there an SDK for the free API?", a: "Yes. There are SDKs for TypeScript (npm install cheki-verify), Python (pip install cheki), Go, PHP and Dart, plus a command-line tool. None of them needs an API key." },
    ],
    related: ["payment-verification-api-guide", "self-hosting-docker-guide", "payment-fraud-ethiopia"],
    relatedPages: ["/compare", "/developers"],
    seo: {
      title: "Free Receipt Verification in Ethiopia: No API Key, No Signup",
      description: "Stop paying check.et 499 ETB/month. Verify CBE, Telebirr, BOA, and M-Pesa receipts for free with no signup and no API key, under fair per-IP rate limits.",
      keywords: ["free receipt verification ethiopia", "free ethiopian receipt api", "ethiopian receipt verification api free", "check.et alternative free", "verify.et alternative", "free CBE verification", "no API key receipt verify", "free ethiopian bank verification"],
    },
  },
  {
    slug: "payment-fraud-ethiopia",
    // The H1 and Article headline say what the title promises (the "fake
    // receipt" search intent): Google shows the H1 in results when they differ.
    title: "How to Check if a Receipt Is Fake in Ethiopia (CBE, Telebirr)",
    description:
      "How to check if a receipt is fake: edited screenshots, reused receipts, made-up reference numbers, Telebirr SMS spoofing and social engineering, and how to catch every one with automated verification.",
    category: "fraud",
    excerpt:
      "Payment fraud costs Ethiopian businesses millions every year. Here are the specific tactics fraudsters use and exactly how to catch each one.",
    date: "2026-06-18",
    updated: "2026-10-16",
    readTime: "10 min",
    content: [
      { type: "text", text: "**Short answer:** a receipt is real only if the bank has a record of it. Paste the receipt link, QR code or reference into cheki (or check it in the bank's own app), then match the amount, the receiver and the date with the payment you expected. A screenshot, a PDF or an SMS on its own proves nothing." },
      { type: "text", text: "Payment fraud is one of the biggest challenges for Ethiopian businesses. Unlike countries with card payments and automatic merchant confirmation, most Ethiopian transactions happen through bank transfers and mobile money. Merchants must manually verify each payment before releasing goods. This creates opportunities for fraud." },

      { type: "heading", id: "check-fake-receipt", text: "How to check if a receipt is fake" },
      {
        type: "steps",
        items: [
          { title: "Get the reference, not just the screenshot", text: "Ask for the receipt link, the QR code or the transaction reference. A screenshot on its own proves nothing." },
          { title: "Check it with the bank", text: "Paste it into cheki. cheki asks the bank's own receipt record, and the result is verified only when the bank confirms it." },
          { title: "Compare the details", text: "Match the amount, the receiver (your own name and account) and the date with the payment you expected." },
          { title: "Record the reference", text: "Keep every reference you accept, so the same receipt cannot be used twice." },
        ],
      },
      { type: "text", text: "If the bank has no record of the reference, treat the receipt as fake until the money shows up in your account. If the bank cannot be reached (Telebirr and M-Pesa only answer Ethiopian networks), open the receipt link on a phone on an Ethiopian network rather than accepting the screenshot." },

      { type: "heading", text: "The 6 most common fraud tactics in Ethiopia" },

      { type: "heading", id: "edited-screenshots", text: "1. Edited screenshot receipt fraud" },
      { type: "text", text: "The most basic and most common tactic. The fraudster takes a real receipt screenshot and edits the amount or date using a photo editing app. They change 1,000 ETB to 10,000 ETB, or modify the date to make an old payment look recent." },
      { type: "callout", variant: "danger", title: "Why it works", text: "The human eye cannot reliably detect well-edited screenshots, especially on small phone screens under pressure at a busy counter. Staff often glance at the screenshot, see the right amount, and release goods." },
      { type: "text", text: "Detection: Verify the transaction reference against the bank's official system. If the amount on the official receipt doesn't match what the screenshot shows, it's fake. cheki does this automatically." },
      { type: "text", text: "The edits that come up most:" },
      { type: "list", items: [
        "Amount: the transferred amount raised to a higher value",
        "Reference: swapped for one from a different, smaller transaction",
        "Date: an old receipt's date changed to make it look recent",
        "Name: the sender name changed to match the expected buyer",
        "Composite: pieces of several real receipts combined into one",
      ]},

      { type: "heading", id: "old-receipt-reuse", text: "2. Old receipt reuse fraud" },
      { type: "text", text: "Also called duplicate receipt fraud. The fraudster makes a genuine payment and receives a real receipt. A week later, they return and present the same receipt for a new purchase. The receipt is legitimate, but it was for a previous transaction." },
      { type: "callout", variant: "warning", title: "Hard to detect manually", text: "The receipt is real. The reference number checks out. The amount matches. Without tracking which receipts have been used, staff have no way to know it's a duplicate." },
      { type: "text", text: "Detection: Store every verified transaction reference in your system. Before accepting a payment, check if the reference has already been used. cheki's API returns the transaction date, so you can also reject receipts older than a set time window." },
      { type: "text", text: "The same receipt can also come back on the same day: paid once in the morning, then shown to a different staff member in the afternoon as a new payment. A date check alone misses that, which is why the reference log matters." },

      { type: "heading", text: "3. Wrong account screenshots" },
      { type: "text", text: "The fraudster sends a screenshot of a transfer to a different account. The screenshot shows a real transfer for the right amount, but the money went to someone else's account, not yours." },
      { type: "text", text: "Detection: Verify the receiver name and account on the official receipt. cheki returns the receiver name and account number, which you can compare against your own." },

      { type: "heading", id: "reference-number-fraud", text: "4. Fabricated receipts and reference number fraud" },
      { type: "text", text: "Some fraudsters create completely fake receipts that mimic the design of the real banking app. These are harder to make but can fool staff who don't know exactly what the real receipt looks like." },
      { type: "text", text: "Detection: Verify the transaction reference. If the reference doesn't exist on the bank's system, the receipt is fake. The bank endpoint will return a 404 or error." },
      { type: "text", text: "Reference numbers follow patterns, so a made-up one can look right:" },
      { type: "list", items: [
        "CBE: new receipts carry a Receipt ID in the mbreciept.cbe.com.et link or QR code; older ones show FT plus 10 letters and digits (e.g. FT26SAMPLE01)",
        "Telebirr: 10 letters and digits starting with a 2-3 letter prefix (e.g. DET0SAMPLE)",
        "BOA: the transaction reference plus the last 5 digits of the account on the receipt",
        "Dashen: a 16-character FT Ref (e.g. B22WDTI00SAMPLE1)",
      ]},
      { type: "text", text: "A format check only catches careless fakes. FT plus today's date plus random characters passes it and still does not exist at CBE. Only the bank's own record can tell, which is what cheki asks." },

      { type: "heading", text: "5. Social engineering" },
      { type: "text", text: "The fraudster creates urgency. They claim they're in a hurry, the transfer is processing, or they'll lose a flight. They pressure staff into releasing goods before verification is complete." },
      { type: "text", text: "Detection: Never release goods under time pressure. If a customer is genuinely in a hurry, verify the payment first and release goods after. A real payment can be verified in 1-3 seconds with cheki." },

      { type: "heading", id: "telebirr-sms-spoofing", text: "6. Telebirr SMS spoofing fraud" },
      { type: "text", text: "A text arrives that looks exactly like Telebirr's payment notification, apparently from Telebirr's own short code, with a made-up transaction number and amount. No money moved." },
      { type: "callout", variant: "danger", title: "Why it works", text: "SMS sender names are not authenticated on most networks. SMS gateways and SIM boxes can send under any sender ID, so the fake lands in the same thread as real Telebirr messages." },
      { type: "text", text: "Detection: Never release goods on an SMS alone. Check the transaction number with cheki, or in the Telebirr app under Accounts, then Verify Payment. If Telebirr has no record of it, the SMS was fake. Train delivery staff and cashiers to check during busy hours too, when skipping it is most tempting." },

      ...REDACT_BEFORE_SHARING,

      { type: "heading", text: "Building a fraud prevention checklist" },
      {
        type: "table",
        headers: ["Fraud type", "What to check", "How cheki helps"],
        rows: [
          ["Edited screenshot", "Amount on official receipt vs claimed amount", "cheki returns the official amount from the bank"],
          ["Duplicate receipt", "Has this reference been used before?", "Store references in your DB, check before accepting"],
          ["Wrong account", "Receiver name and account match yours", "cheki returns receiver name and account number"],
          ["Fabricated receipt", "Does the reference exist on the bank system?", "cheki returns 404 if the receipt doesn't exist"],
          ["Social engineering", "Never skip verification under pressure", "cheki verifies in 1-3 seconds, no excuse to skip"],
          ["Telebirr SMS spoofing", "Does the transaction number exist at Telebirr?", "cheki checks the number with Telebirr instead of trusting the SMS"],
        ],
      },

      { type: "heading", text: "Automating fraud prevention" },
      { type: "text", text: "Manual verification is unreliable because it depends on human judgment under pressure. The solution is to automate verification so every transaction is checked, every time, with no exceptions." },
      { type: "text", text: "With cheki's API, you can integrate verification into your POS system, e-commerce checkout, or delivery app. Here's a simple integration pattern:" },
      { type: "code", lang: "javascript", code: "// Before releasing goods, verify the payment\nconst response = await fetch('https://cheki.et/api/verify', {\n  method: 'POST',\n  headers: { 'Content-Type': 'application/json' },\n  body: JSON.stringify({\n    bank: 'cbe',\n    reference: customerReference,\n    accountNumber: myAccountNumber\n  })\n});\n\nconst result = await response.json();\n\n// Check 1: Does the receipt exist?\nif (!result.verified) return reject('Receipt not found');\n\n// Check 2: Does the amount match?\nif (result.amount !== expectedAmount) return reject('Amount mismatch');\n\n// Check 3: Is the receiver our account?\nif (result.receiverAccount !== myAccount) return reject('Wrong account');\n\n// Check 4: Is this a duplicate?\nif (await isDuplicate(result.reference)) return reject('Duplicate receipt');\n\n// Check 5: Is the payment recent?\nif (isOlderThan(result.date, 1, 'hour')) return reject('Stale payment');\n\n// All checks passed\nreturn approve();" },
      { type: "callout", variant: "tip", title: "Use batch verification for reconciliation", text: "At the end of each day, use cheki's batch endpoint to verify all receipts at once. POST to /api/verify/batch with up to 20 receipts per request. This catches any fraud that slipped through during the day." },
    ],
    faq: [
      { q: "How common is payment fraud in Ethiopia?", a: "While exact statistics are not publicly available, payment fraud is widely reported across Ethiopian retail, delivery, and e-commerce. Fake screenshots are the most common tactic, followed by duplicate receipts." },
      { q: "Can cheki detect all types of fraud?", a: "cheki detects edited screenshots, fabricated receipts, and wrong-account transfers by verifying against the bank's official system. Duplicate detection requires you to store verified references in your own database. cheki provides the data; you implement the duplicate check." },
      { q: "Is automated verification better than manual checking?", a: "Yes. Manual checking is slow, error-prone, and depends on human judgment under pressure. Automated verification with cheki completes in 1-3 seconds and eliminates human error. Every transaction should be verified, not just suspicious ones." },
      { q: "Can I spot an edited screenshot by looking at it?", a: "Sometimes: uneven fonts, misaligned text or blurry patches around the amount can give it away. A careful edit leaves none of that, so the reliable test is the bank's own record of the reference." },
      { q: "Can someone reuse a receipt from the same day?", a: "Yes. A genuine morning payment can be shown again to a different staff member in the afternoon. Log every reference you accept and refuse one you have already seen." },
      { q: "Can I tell a fake reference number by its format?", a: "No. Fakes are usually made to match the format, so a reference that looks right proves nothing on its own. Paste it into cheki: only the bank's own record can say whether that payment exists." },
      { q: "How can I tell if a Telebirr SMS is fake?", a: "Not from the SMS itself: the sender name can be spoofed. Check the transaction number with cheki or in the Telebirr app. If Telebirr has no record of it, the SMS was fake." },
      { q: "What should I do if a receipt is fake?", a: "Do not release the goods. Ask the sender to complete the payment, keep the fake receipt as evidence, and report intentional fraud to the bank and the police." },
    ],
    related: ["cbe-receipt-qr-code", "free-receipt-verification-no-api-key", "self-hosting-docker-guide"],
    relatedPages: ["/banks"],
    seo: {
      title: "How to Check if a Receipt Is Fake: Payment Fraud in Ethiopia",
      description: "How to check if a receipt is fake in Ethiopia: edited screenshots, reused receipts, made-up reference numbers and Telebirr SMS spoofing, and how to catch each one.",
      keywords: ["payment fraud ethiopia", "how to check fake receipt ethiopia", "fake receipt ethiopia", "edited screenshot receipt", "old receipt reuse fraud", "reference number fraud", "telebirr sms spoofing", "telebirr fraud", "CBE fake screenshot", "duplicate receipt fraud"],
    },
  },
  {
    slug: "ethiopian-bank-receipt-formats",
    title: "Ethiopian Bank Receipt Formats: A Complete Reference",
    description:
      "Every Ethiopian bank receipt reference format, endpoint URL, and response type in one place. CBE, Telebirr, BOA, M-Pesa, Dashen, Awash, Zemen, CBE Birr, Siinqee, eBirr, ZamZam.",
    category: "technical",
    excerpt:
      `The definitive reference for Ethiopian bank receipt formats. Reference patterns, endpoint URLs, required fields, and response types for the ${LIVE_BANK_COUNT} live banks and wallets, plus the ones still in research.`,
    date: "2026-06-18",
    updated: "2026-10-19",
    readTime: "6 min",
    content: [
      { type: "text", text: "This is a complete technical reference for every Ethiopian bank and mobile wallet receipt system. If you're building a verification system, integrating payments, or just want to understand how Ethiopian bank receipts work, this is your reference." },

      { type: "callout", variant: "info", title: "All endpoints are public", text: "Every endpoint listed here is publicly accessible without authentication. The data is free. cheki, check.et, and verify.et all use these same endpoints." },

      { type: "heading", id: "at-a-glance", text: "Ethiopian bank receipt formats at a glance" },
      {
        type: "table",
        headers: ["Bank or wallet", "What the bank returns", "What you give cheki"],
        rows: [
          ["CBE", "JSON (older receipts: PDF)", "Receipt ID or mbreciept.cbe.com.et link (older: FT reference + last 8 digits of the receiving account)"],
          ["Telebirr", "HTML page (Ethiopian networks only)", "Transaction number, or the receipt QR code"],
          ["BOA", "JSON", "Reference + last 5 digits of the account on the receipt, the slip link, or the receipt QR code"],
          ["M-Pesa (beta)", "PDF inside a JSON response (Ethiopian networks only)", "Transaction number"],
          ["Dashen", "HTML page", "16-character FT Ref"],
          ["Awash", "HTML page", "Share link from the Awash SMS or app"],
          ["Siinqee and eBirr", "HTML page", "Receipt link from receipt.ebirr.com"],
          ["ZamZam (beta)", "JSON", "Receipt link, or the number at the end of it"],
        ],
      },
      { type: "text", text: "The sections below give each bank's endpoint, reference pattern and the fields its receipt carries." },

      { type: "heading", text: "CBE (Commercial Bank of Ethiopia)" },
      { type: "text", text: "CBE has two receipt systems. The new system (mbreciept) is preferred for its clean JSON response." },
      { type: "heading", text: "New system (mbreciept.cbe.com.et)" },
      {
        type: "table",
        headers: ["Field", "Value"],
        rows: [
          ["URL format", "https://mbreciept.cbe.com.et/{SHORT_ID}"],
          ["API endpoint", "https://Mb.cbe.com.et/api/v1/transactions/public/transaction-detail/{SHORT_ID}"],
          ["Required headers", "X-App-ID, X-App-Version"],
          ["Response format", "JSON"],
          ["Input needed", "Short URL or QR code scan"],
          ["Account number required", "No"],
          ["Geo-blocked", "No"],
        ],
      },
      { type: "heading", text: "Legacy system (apps.cbe.com.et, older receipts)" },
      {
        type: "table",
        headers: ["Field", "Value"],
        rows: [
          ["URL format", "https://apps.cbe.com.et:100/?id={FT_REFERENCE}{LAST_8_DIGITS}"],
          ["Response format", "PDF"],
          ["Input needed", "FT reference (starts with FT) + last 8 digits of receiving account"],
          ["Account number required", "Yes (last 8 digits)"],
          ["Geo-blocked", "No"],
        ],
      },
      { type: "text", text: "Reference format: FT followed by 10 alphanumeric characters. Example: FT26SAMPLE01" },
      { type: "code", code: "# Old CBE URL construction\nFT_REFERENCE = 'FT26SAMPLE01'\nACCOUNT = '1000000006171'\nLAST_8 = ACCOUNT[-8:]  # '00006171'\nURL = f'https://apps.cbe.com.et:100/?id={FT_REFERENCE}{LAST_8}'\n# https://apps.cbe.com.et:100/?id=FT26SAMPLE0100006171" },

      { type: "heading", text: "Telebirr (Ethio Telecom)" },
      {
        type: "table",
        headers: ["Field", "Value"],
        rows: [
          ["URL format", "https://transactioninfo.ethiotelecom.et/receipt/{REFERENCE}"],
          ["Response format", "HTML"],
          ["Input needed", "Transaction reference only"],
          ["Account number required", "No"],
          ["Geo-blocked", "Yes (Ethiopian IPs only)"],
        ],
      },
      { type: "text", text: "Reference format: 2-3 letter prefix followed by 6-8 alphanumeric characters. Common prefixes:" },
      {
        type: "table",
        headers: ["Prefix", "Transaction type"],
        rows: [
          ["DET", "Person-to-person transfer (most common)"],
          ["CHQ", "Cheque-related transaction"],
          ["DAB", "Bank account transfer"],
          ["DEL", "Merchant payment"],
          ["ADQ", "Additional transaction types"],
        ],
      },
      { type: "code", code: "# Telebirr URL construction\nREFERENCE = 'DET0SAMPLE'\nURL = f'https://transactioninfo.ethiotelecom.et/receipt/{REFERENCE}'" },
      { type: "callout", variant: "warning", title: "Geo-blocking", text: "Telebirr's endpoint blocks all non-Ethiopian IP addresses at the network level. Cloud servers (AWS, Vercel, Cloudflare) cannot reach it. Self-host cheki on an Ethiopian server or use the fallback URL feature." },

      { type: "heading", text: "Bank of Abyssinia (BOA)" },
      {
        type: "table",
        headers: ["Field", "Value"],
        rows: [
          ["URL format", "https://cs.bankofabyssinia.com/api/onlineSlip/getDetails/?id={REFERENCE}{LAST_5_DIGITS}"],
          ["QR format", "AES-256-CBC encrypted CSV (decrypts to source, amount, reference, date, receiver)"],
          ["Response format", "JSON"],
          ["Input needed", "The BOA slip link, OR the transaction reference + last 5 digits of the account on the receipt, OR the QR payload"],
          ["Account number required", "Yes (last 5 digits), skipped for a slip link that ends with them, or a QR payload"],
          ["Geo-blocked", "No"],
        ],
      },
      { type: "text", text: "Reference format: Alphanumeric, typically starts with 2 letters. Example: AB12345678 or FT26SAMPLE07" },
      { type: "callout", variant: "tip", title: "QR verification works for inter-bank transfers", text: "BOA's online slip API does not recognize inter-bank transfer references (e.g., FT... sent to CBE). However, the QR code on the receipt is an AES-256-CBC encrypted payload that carries the reference and the full receiving account. cheki decrypts it server-side with the key exposed in BOA's receipt web app and asks BOA with those values. Anyone can build such a QR, so a decrypted QR alone is never shown as verified: if BOA cannot be reached, the result is marked as decoded only. See our BOA QR code breakdown for encryption parameters and security analysis." },
      { type: "callout", variant: "tip", title: "No Selenium needed", text: "Unlike the ethiobank_receipts library which requires Chrome WebDriver for BOA, cheki uses BOA's JSON API directly. This works in serverless environments without browser dependencies." },

      { type: "heading", text: "M-Pesa Ethiopia (Safaricom)" },
      {
        type: "table",
        headers: ["Field", "Value"],
        rows: [
          ["URL format", "https://m-pesabusiness.safaricom.et/api/receipt/getReceipt?trxNo={REFERENCE}"],
          ["Response format", "JSON"],
          ["Input needed", "Transaction reference only"],
          ["Account number required", "No"],
          ["Geo-blocked", "Yes (Ethiopian IPs only)"],
        ],
      },
      { type: "text", text: "Reference format: Alphanumeric Safaricom transaction reference." },

      { type: "heading", text: "Dashen Bank" },
      {
        type: "table",
        headers: ["Field", "Value"],
        rows: [
          ["URL format", "https://receipts.dashenbanksc.com/receipt/{REFERENCE}"],
          ["Response format", "HTML"],
          ["Input needed", "Transaction reference only"],
          ["Account number required", "No"],
          ["Geo-blocked", "No"],
        ],
      },
      { type: "text", text: "Reference format: Alphanumeric Dashen transaction reference. Use the Transaction Reference, not the Transfer Reference. Works for both within-Dashen and Other Bank Transfer (inter-bank) receipts." },

      { type: "heading", text: "Awash Bank" },
      { type: "text", text: "Awash Bank receipts are public HTML pages on awashpay.awashbank.com, served by a Java backend called MoonlightMBanking behind an F5 BIG-IP WAF. We have fully reverse-engineered the share-link structure using 18 real samples collected from SMS messages, GitHub repos, and community contributions. The share link is sent automatically via SMS after every transaction." },
      {
        type: "table",
        headers: ["Field", "Value"],
        rows: [
          ["URL format", "https://awashpay.awashbank.com:8225/-{TX_ID_BASE36}-{COUNTER_BASE36}"],
          ["Part 1 (TX_ID_BASE36)", "Numeric Transaction ID encoded in base-36 (case-insensitive)"],
          ["Part 2 (COUNTER_BASE36)", "Server-side counter, 6 chars base-36, strictly validated"],
          ["Response format", "HTML"],
          ["Input needed", "Full Awash share link (from SMS or app)"],
          ["Account number required", "No"],
          ["Geo-blocked", "No"],
          ["Backend", "Java (MoonlightMBanking), nginx, F5 BIG-IP ASM WAF"],
          ["App package", "com.sc.awashpay (AwashBirr Pro)"],
          ["SMS delivery", "Share link sent automatically in SMS after every transaction"],
        ],
      },
      { type: "heading", text: "Transaction ID structure" },
      { type: "text", text: "The numeric Transaction ID is not random. Since 2026, it has a fixed structure: YYMMDDHHMM followed by a 5-digit per-minute sequence number. For example, Transaction ID 260607112200001 breaks down as:" },
      {
        type: "table",
        headers: ["Component", "Digits", "Value", "Meaning"],
        rows: [
          ["YY", "2", "26", "Year (2026)"],
          ["MM", "2", "06", "Month (June)"],
          ["DD", "2", "07", "Day (7th)"],
          ["HH", "2", "11", "Hour (11)"],
          ["MI", "2", "22", "Minute (22)"],
          ["SEQ", "5", "00001", "Per-minute sequence number"],
        ],
      },
      { type: "text", text: "This means the Transaction ID itself encodes the transaction date and time down to the minute. The 5-digit sequence resets each minute and is not globally monotonic. We verified this against all 13 new-format samples. Transactions before 2026 use a different hex-like format (e.g. E3BF28E4B8C1) that does not follow this structure." },

      { type: "heading", text: "URL structure breakdown" },
      { type: "text", text: "Example share link (synthetic values, not a real receipt): https://awashpay.awashbank.com:8225/-2KDL95XE81-4U0000" },
      {
        type: "table",
        headers: ["Segment", "Base-36 value", "Decimal value", "Meaning"],
        rows: [
          ["Part 1", "2KDL95XE81", "260607112200001", "Transaction ID (YYMMDDHHMM + 5-digit seq)"],
          ["Part 2", "4U0000", "292253184", "Server counter (increases with time)"],
        ],
      },
      { type: "text", text: "We verified this with 18 real Awash receipts spanning April 2025 to June 2026, covering transaction types including Send To Bank, IPS Bank Transfer, Send to Wallet, Telebirr Transfer, Merchant Payment, and Other Bank Transfer. In every case, converting part 1 from base-36 to decimal produced the exact Transaction ID. The URL is case-insensitive (lowercase works)." },

      { type: "heading", text: "Counter analysis (18 samples)" },
      { type: "text", text: "Part 2 is not a hash of the Transaction ID. We tested and ruled out: CRC32, Adler32, MD5/SHA1/SHA256 truncation, Java hashCode, DJB2, FNV-1a, HMAC, affine functions, modulo operations, and bit manipulation. It is a monotonically increasing counter with an accelerating rate that correlates with time." },
      {
        type: "table",
        headers: ["Date", "Counter (decimal)", "Rate since previous", "Source"],
        rows: [
          ["2025-04-10", "78,960,518", "—", "GitHub"],
          ["2025-07-26", "120,823,236", "4.4/sec", "SMS"],
          ["2025-08-04", "124,196,936", "5.4/sec", "GitHub"],
          ["2025-11-04", "167,318,568", "5.4/sec", "SMS"],
          ["2026-01-28", "214,318,325", "6.4/sec", "GitHub SMS"],
          ["2026-02-11", "222,463,161", "6.7/sec", "SMS"],
          ["2026-03-08", "236,606,890", "6.6/sec", "SMS"],
          ["2026-03-14", "240,498,506", "7.5/sec", "SMS"],
          ["2026-04-01", "251,165,242", "~7.1/sec (interpolated)", "Brute-forced"],
          ["2026-04-02", "251,958,281", "~7.2/sec", "SMS"],
          ["2026-04-17", "261,177,944", "7.1/sec", "SMS"],
          ["2026-05-14", "277,774,515", "7.2/sec", "Original samples"],
          ["2026-06-07", "292,535,286", "7.2/sec", "Original samples"],
          ["2026-06-22", "302,458,159", "7.5/sec", "Community"],
        ],
      },
      { type: "text", text: "The counter rate is accelerating: 4.4/sec in mid-2025, 6.4/sec by January 2026, and 7.5/sec by June 2026. A quadratic model fits with R-squared = 0.9999 and maximum residual of ±1M. For dates bracketed by nearby samples, local linear interpolation gives predictions within ±100K." },
      { type: "text", text: "The server strictly validates both segments. Replacing part 2 with a nearby value returns 'Mistmatch / invalid receipt id'. Omitting it returns 'Invalid receipt id'. Part 2 must be exactly 6 base-36 characters (5 or 7 chars returns mismatch). Extra dashes or special characters are rejected by the WAF." },

      { type: "heading", text: "Server architecture" },
      { type: "text", text: "The Awash receipt server runs a Java application called MoonlightMBanking (revealed by the JSESSIONID cookie path). It sits behind nginx and an F5 BIG-IP ASM WAF that blocks all paths except the /-{part1}-{part2} receipt URL pattern. A merchant API exists at /awashbirrpro/merchant-api/ but is also WAF-blocked. The receipt HTML contains no client-side token generation logic: the share URL is pre-baked in the HTML and only used to render a QR code." },
      {
        type: "table",
        headers: ["Component", "Details"],
        rows: [
          ["Backend app", "MoonlightMBanking (Java, Jetty/Tomcat)"],
          ["Web server", "nginx"],
          ["WAF", "F5 BIG-IP ASM (blocks all non-receipt paths)"],
          ["Load balancer", "F5 BIG-IP (TS01121d40 persistence cookie)"],
          ["App name", "AwashBirr Pro (com.sc.awashpay)"],
          ["Merchant API", "/awashbirrpro/merchant-api/DebitRequest/ (WAF-blocked)"],
          ["Dev API", "/awashpaytest/Rest/ (separate endpoint)"],
          ["Client-side JS", "Only QRCode generation, no token logic"],
          ["SMS delivery", "Receipt link included in SMS automatically after transaction"],
        ],
      },

      { type: "heading", text: "Brute-force proof of concept (2 successes)" },
      { type: "text", text: "We have proven that a valid share URL can be constructed from a Transaction ID alone, without the Awash app or SMS, by brute-forcing the counter. We did this successfully twice:" },
      {
        type: "table",
        headers: ["Target date", "Transaction ID", "Predicted P2", "Actual P2", "Offset", "URLs scanned", "Time"],
        rows: [
          ["2026-05-14", "2605141207xxxxx", "277,659,280", "277,776,101", "+116,821", "116,820", "18.3 min"],
          ["2026-04-01", "2604011822xxxxx", "251,236,520", "251,165,242", "-71,278", "65,243", "16.5 min"],
        ],
      },
      { type: "text", text: "Both scans ran at 66-106 req/sec with zero WAF blocks and less than 0.01% error rate. The server did not rate-limit or block the probing. The April 1 scan was especially efficient because we had a nearby sample from April 2 (just 1 day away) to anchor the prediction." },
      { type: "callout", variant: "success", title: "What this means", text: "Given a Transaction ID, cheki can construct the share URL by: (1) converting the txID to base-36 for part 1, (2) extracting the timestamp from the txID structure, (3) predicting the counter using our 18-sample model, and (4) brute-forcing the remaining uncertainty. With nearby anchor samples, the scan takes 15-20 minutes. With 50+ samples, it could drop to under 1 minute." },

      { type: "heading", text: "What we still need to figure out" },
      { type: "ordered", items: [
        "Is the counter global across all Awash transactions, or per branch / per sender / per channel?",
        "Why did one Transaction ID (March 28) resist brute-forcing across 8M+ URLs? Was the counter outside our model range, or is there a different explanation?",
        "What is the relationship between the old hex-format txIDs (pre-2026) and the new YYMMDDHHMM format?",
        "Can the counter prediction be improved with more samples from underrepresented time periods?",
      ]},

      { type: "callout", variant: "tip", title: "Help us improve the counter model", text: "We have 18 samples but need more from underrepresented periods (especially March 2026, September-December 2025, and pre-July 2025). If you have Awash SMS messages with receipt links, send the two-part token (e.g. 2KDL95XE81-4U0000) and the transaction date/time through the private form on the Awash bank page. Please don't post tokens on GitHub: a token opens the full receipt. Each sample narrows the prediction window and reduces brute-force time." },
      { type: "callout", variant: "info", title: "Privacy note", text: "An Awash token is as sensitive as the full link: anyone with it can open the receipt, with names and amounts. Only send tokens through the private form, which goes to the maintainer and is not published. In public (a GitHub issue), share only the transaction date/time and the token's shape with characters masked, e.g. 2KDL9XXXXX-4UXXXX." },

      { type: "heading", text: "How to verify Awash with cheki" },
      { type: "text", text: "Paste the full share link from your Awash SMS or app into cheki. The parser will extract the Transaction ID, receiver, amount, date, and other fields from the official HTML receipt. cheki handles all receipt variants (Transfer successful, Transaction successful, Transaction Details, Telebirr Transfer) including IPS bank transfers, merchant payments, send-to-wallet, and other-bank transfers." },
      { type: "heading", text: "Zemen Bank" },
      {
        type: "table",
        headers: ["Field", "Value"],
        rows: [
          ["URL format", "https://share.zemenbank.com/rt/{REFERENCE}/pdf"],
          ["Response format", "PDF"],
          ["Input needed", "Transaction reference only"],
          ["Account number required", "No"],
          ["Geo-blocked", "No"],
        ],
      },

      { type: "heading", text: "CBE Birr" },
      {
        type: "table",
        headers: ["Field", "Value"],
        rows: [
          ["URL format", "https://cbepay1.cbe.com.et/aureceipt?TID={REFERENCE}&PH={PAYER_PHONE}"],
          ["Response format", "PDF for real receipts (reported by other verifiers; an unknown reference returns an empty HTML viewer). In development in cheki"],
          ["Input needed", "Transaction reference + payer phone number"],
          ["Account number required", "No (phone instead)"],
          ["Geo-blocked", "No"],
        ],
      },

      { type: "heading", text: "Siinqee Bank" },
      {
        type: "table",
        headers: ["Field", "Value"],
        rows: [
          ["URL format", "https://siinqeebank.com/receipt/{REFERENCE}"],
          ["Response format", "HTML"],
          ["Input needed", "Transaction reference only"],
          ["Account number required", "No"],
          ["Geo-blocked", "No"],
        ],
      },

      { type: "heading", text: "eBirr (Nib, Wegagen, Ahadu, KAAFI)" },
      { type: "text", text: "eBirr is a mobile money platform connecting 5 Ethiopian financial institutions through a single receipt endpoint. Each partner bank has its own tenant code in the URL." },
      {
        type: "table",
        headers: ["Field", "Value"],
        rows: [
          ["URL format", "https://receipt.ebirr.com/{tenant}/{token}"],
          ["Tenant codes", "nib (Nib International), wegagen (Wegagen), ahadu (Ahadu), kaafimf (KAAFI Microfinance)"],
          ["Response format", "HTML"],
          ["Input needed", "Full receipt URL or tenant/token string (e.g., nib/abc123)"],
          ["Account number required", "No"],
          ["Geo-blocked", "No"],
        ],
      },
      { type: "text", text: "The user shares the receipt from the eBirr app to get a receipt.ebirr.com/{tenant}/{token} URL. cheki auto-detects the tenant and maps it to the correct partner bank. Invalid tokens return a 'Not Found Page' (HTTP 200 with red H1)." },
      { type: "callout", variant: "info", title: "eBirr vs Telebirr", text: "eBirr and Telebirr are completely different services. Telebirr is Ethio Telecom's mobile wallet. eBirr is a separate mobile money platform that partners with multiple banks (Nib, Wegagen, Ahadu, KAAFI, Siinqee/Coopbank)." },

      { type: "heading", text: "ZamZam Bank (beta)" },
      {
        type: "table",
        headers: ["Field", "Value"],
        rows: [
          ["Receipt link", "https://receipt.zamzambank.com.et/receipt/{RECEIPT_ID}"],
          ["Data endpoint", "https://receipt-backend.zamzambank.com.et/api/v1/invoice/{RECEIPT_ID}"],
          ["Response format", "JSON (an unknown id answers HTTP 200 with null)"],
          ["Input needed", "The receipt link, or the numeric receipt id at its end"],
          ["Account number required", "No"],
          ["Geo-blocked", "No"],
        ],
      },
      { type: "text", text: "The receipt link opens a web app; its data comes from ZamZam's JSON service, which expects a fixed credential that ZamZam ships inside that public web app (cheki sends the same one). The record names the ZamZam account holder, the amount, the date (no time) and ZamZam's transaction reference. cheki masks the account number to its first digit and last 4. Whether the holder paid or received is inferred from the record's debit/credit flag, which is why ZamZam support is in beta." },

      { type: "heading", text: "Other Ethiopian banks (researching)" },
      { type: "text", text: "The following banks are licensed in Ethiopia but do not yet have confirmed public receipt verification endpoints. cheki lists them as 'in development' and is actively researching their receipt systems:" },
      {
        type: "table",
        headers: ["Bank", "Established", "Branches", "Status"],
        rows: [
          ["Abay Bank", "2010", "279", "Researching"],
          ["Addis International Bank", "2011", "146", "Researching"],
          ["Amhara Bank", "2022", "320", "Researching"],
          ["Berhan International Bank", "2009", "-", "Researching"],
          ["Bunna International Bank", "2009", "-", "Researching"],
          ["Enat Bank", "2013", "-", "Researching (women-focused)"],
          ["Global Bank Ethiopia", "2012", "-", "Researching"],
          ["Lion International Bank", "2006", "-", "Researching (aka Anbessa)"],
          ["Oromia International Bank", "2008", "-", "Researching"],
          ["Hibret Bank", "1998", "-", "Researching (formerly United Bank)"],
          ["Hijra Bank", "2021", "-", "Researching (Islamic)"],
          ["Shabelle Bank", "2021", "-", "Researching"],
          ["Goh Betoch Bank", "2021", "-", "Researching (housing/mortgage)"],
          ["Tsedey Bank", "2022", "-", "Researching"],
          ["Gadaa Bank", "2022", "-", "Researching"],
          ["Rammis Bank", "2022", "-", "Researching"],
          ["Development Bank of Ethiopia", "1901", "-", "State development bank (no retail)"],
        ],
      },
      { type: "callout", variant: "tip", title: "Help us add more banks", text: "If you have a receipt from any of these banks with a QR code or receipt URL, contact us on GitHub. We'll investigate the endpoint and add it to cheki for free." },

      { type: "heading", text: "Auto-detection patterns" },
      { type: "text", text: "cheki auto-detects the bank from the reference format. Here are the detection rules:" },
      {
        type: "table",
        headers: ["Pattern", "Bank"],
        rows: [
          ["Starts with FT", "CBE"],
          ["Starts with DET, CHQ, DAB, DEL, ADQ, DEP, CHG", "Telebirr"],
          ["2 letters + digits (general)", "BOA"],
          ["2 letters + 6+ digits", "M-Pesa"],
          ["awashpay.awashbank.com:8225/-{A}-{B}", "Awash Bank"],
          ["receipt.ebirr.com/{tenant}/{token}", "eBirr"],
          ["tenant/token (nib/, wegagen/, ahadu/, kaafimf/)", "eBirr"],
          ["receipt.zamzambank.com.et/receipt/{id}", "ZamZam Bank (a bare number needs ZamZam chosen)"],
        ],
      },
      { type: "callout", variant: "info", title: "URL auto-detection", text: "cheki also detects the bank from pasted URLs. If you paste a mbreciept.cbe.com.et link, it knows it's CBE. If you paste a transactioninfo.ethiotelecom.et link, it knows it's Telebirr. If you paste an awashpay.awashbank.com:8225/-... link, it knows it's Awash. No manual bank selection needed." },
    ],
    faq: [
      { q: "What format does CBE use for receipts?", a: "Current CBE receipts carry a Receipt ID, shared as a mbreciept.cbe.com.et link or QR code; the receipt itself is JSON from mb.cbe.com.et with the payer, receiver, masked accounts, amount, date and reference. Older receipts were PDFs at apps.cbe.com.et:100, looked up by FT reference plus the last 8 digits of the receiving account, a legacy format cheki still accepts." },
      { q: "Are these bank endpoints official APIs?", a: "These are public endpoints that the banks use for their own receipt sharing systems. They are not documented official APIs, but they are publicly accessible without authentication. cheki, check.et, and verify.et all use these same endpoints." },
      { q: "Can the banks change or remove these endpoints?", a: "Yes. If a bank changes their endpoint, cheki needs to update its parser. Because cheki is open source, anyone can submit a fix. This is an advantage over closed services like check.et." },
      { q: "Which banks require an account number?", a: "BOA requires the last 5 digits of the account on the receipt, which a full BOA slip link can carry. CBE's current receipts (the mbreciept link or Receipt ID) need no account number; only an older CBE receipt with just an FT reference needs the last 8 digits. CBE Birr needs the payer's phone. All other banks only need the receipt link or reference." },
    ],
    related: ["cbe-receipt-qr-code", "boa-qr-code-receipts", "payment-verification-api-guide"],
    relatedPages: ["/endpoints", "/banks"],
    seo: {
      title: "Ethiopian Bank Receipt Formats: Complete Reference",
      description: "Every Ethiopian bank receipt reference format, endpoint URL, and response type. CBE, Telebirr, BOA, M-Pesa, Dashen, Awash, Zemen, CBE Birr, Siinqee, eBirr, ZamZam.",
      keywords: ["ethiopian bank receipt format", "ethiopian bank receipt formats", "cbe receipt format", "telebirr receipt format", "boa receipt json", "CBE FT reference", "telebirr transaction ID format", "BOA receipt endpoint", "ethiopian bank API", "receipt verification reference pattern"],
    },
  },
  {
    slug: "self-hosting-docker-guide",
    title: "Self-Hosting cheki with Docker: Complete Guide",
    description:
      "Run your own free Ethiopian receipt verification API with Docker. Bypass geo-blocks, keep data in-house, and customize for your needs.",
    category: "technical",
    excerpt:
      "Self-hosting cheki gives you full control, zero cost, and bypasses Telebirr/M-Pesa geo-blocking. Here's the complete Docker setup guide.",
    date: "2026-06-18",
    updated: "2026-10-12",
    readTime: "5 min",
    content: [
      { type: "text", text: "Self-hosting cheki gives you three advantages over the hosted version: full control over your data, no dependency on cheki.et, and the ability to bypass Telebirr and M-Pesa geo-blocking by running on an Ethiopian IP address." },

      { type: "heading", text: "Prerequisites" },
      { type: "list", items: [
        "Docker and Docker Compose installed",
        "A server with internet access (an Ethiopian IP for Telebirr/M-Pesa support)",
        "Git",
      ]},

      { type: "heading", text: "Quick start" },
      { type: "code", lang: "bash", code: "git clone https://github.com/1RB/cheki.git\ncd cheki\ndocker-compose up -d\n\n# API is now available at http://localhost:3000\n# Web UI is at http://localhost:3000\n# API docs at http://localhost:3000/docs" },
      { type: "callout", variant: "success", title: "That's it", text: "The Docker image includes everything: Next.js, the API routes, PDF parsing, and all bank integrations. No external database or API keys needed." },

      { type: "heading", text: "What you get" },
      {
        type: "table",
        headers: ["Endpoint", "Method", "Description"],
        rows: [
          ["/api/verify", "POST", "Verify a single receipt"],
          ["/api/verify/batch", "POST", "Verify up to 20 receipts at once"],
          ["/api/banks", "GET", "List supported banks and status"],
          ["/api/health", "GET", "Check API and per-bank endpoint health"],
          ["/api/receipt", "GET", "Download raw receipt file from bank"],
        ],
      },

      { type: "heading", text: "Bypassing Telebirr and M-Pesa geo-blocks" },
      { type: "text", text: "Telebirr (transactioninfo.ethiotelecom.et) and M-Pesa (m-pesabusiness.safaricom.et) block all non-Ethiopian IP addresses at the TCP level. This means cloud servers on AWS, Vercel, Cloudflare, and most international hosting providers cannot reach these endpoints." },
      { type: "text", text: "If you self-host cheki on a server with an Ethiopian IP address, Telebirr and M-Pesa verification will work without any workarounds. This is the cleanest solution." },
      { type: "callout", variant: "tip", title: "Ethiopian hosting options", text: "Ethio Telecom and various local ISPs offer fixed IP addresses. A small VPS or dedicated server in Ethiopia can run cheki for a few hundred birr per month, under rate limits you set yourself." },

      { type: "callout", variant: "warning", title: "No header tricks", text: "The block is on the real network address, so headers like X-Forwarded-For change nothing and cheki does not send them. From a server outside Ethiopia, cheki makes one quick attempt and then gives the user the bank's own receipt link to open." },

      { type: "heading", text: "Customizing cheki" },
      { type: "text", text: "Since cheki is open source, you can modify it for your needs:" },
      { type: "list", items: [
        "Add custom bank parsers in src/app/api/verify/route.ts",
        "Change the UI in src/app/page.tsx",
        "Add authentication if you want to restrict access",
        "Add a database for duplicate detection and audit trails",
        "Modify the Python library in /python for custom integrations",
      ]},

      { type: "heading", text: "Production deployment" },
      { type: "text", text: "For production, consider:" },
      { type: "list", items: [
        "Put cheki behind a reverse proxy (nginx, Caddy) with TLS",
        "Add rate limiting to protect the underlying bank endpoints",
        "Monitor with the /api/health endpoint",
        "Set up logging for audit trails",
        "Use a process manager (PM2, systemd) if not using Docker",
      ]},
      { type: "code", lang: "yaml", code: "# Example docker-compose override for production\nservices:\n  cheki:\n    restart: always\n    ports:\n      - \"127.0.0.1:3000:3000\"  # Only listen on localhost\n    environment:\n      - NODE_ENV=production" },
    ],
    faq: [
      { q: "Do I need a database to self-host cheki?", a: "No. cheki is stateless. It fetches receipts on demand and returns the result. If you want duplicate detection or audit trails, you need to add your own database layer." },
      { q: "Can I self-host cheki outside Ethiopia?", a: "Yes, but Telebirr and M-Pesa verification will not work from non-Ethiopian IPs. CBE and BOA work globally. For full support, host on an Ethiopian IP." },
      { q: "How much does self-hosting cost?", a: "The software is free (MIT license). You only pay for your server. A small VPS in Ethiopia costs a few hundred birr per month. cheki has no per-verification cost." },
    ],
    related: ["free-receipt-verification-no-api-key", "ethiopian-bank-receipt-formats", "payment-verification-api-guide"],
    relatedPages: ["/developers", "/docs"],
    seo: {
      title: "Self-Hosting cheki with Docker: Complete Guide",
      description: "Run your own free Ethiopian receipt verification API with Docker. Bypass geo-blocks, keep data in-house, and customize for your needs.",
      keywords: ["self-host receipt verification", "docker ethiopian bank", "cheki self-hosting", "telebirr geo-block bypass", "free verification API docker"],
    },
  },
  {
    slug: "payment-verification-api-guide",
    title: "Building a Payment Verification System with cheki's Free API",
    description:
      "Complete developer guide to integrating Ethiopian bank receipt verification into your app, POS system, or e-commerce checkout with cheki's free REST API.",
    category: "api",
    excerpt:
      "From cURL to production: everything you need to integrate free Ethiopian receipt verification into your application.",
    date: "2026-06-18",
    updated: "2026-10-19",
    readTime: "8 min",
    content: [
      { type: "text", text: "This guide walks through integrating cheki's free REST API into a real application. No API key, no signup; requests are rate limited per IP. We'll cover single verification, batch verification, error handling, and fraud prevention patterns." },

      { type: "heading", text: "API overview" },
      {
        type: "table",
        headers: ["Endpoint", "Method", "Purpose"],
        rows: [
          ["/api/verify", "POST", "Verify a single receipt"],
          ["/api/verify/batch", "POST", "Verify up to 20 receipts at once"],
          ["/api/banks", "GET", "List supported banks and status"],
          ["/api/health", "GET", "Check API and per-bank endpoint latency"],
        ],
      },
      { type: "text", text: "Base URL: https://cheki.et" },
      { type: "callout", variant: "success", title: "No authentication", text: "cheki's API requires no API key, no Bearer token, and no signup. Just POST and get JSON. This is different from check.et which requires a business account and Authorization header." },

      { type: "heading", text: "Single verification" },
      { type: "text", text: "The most common use case: verify one receipt at a time." },
      { type: "code", lang: "bash", code: 'curl -X POST https://cheki.et/api/verify \\\n  -H "Content-Type: application/json" \\\n  -d \'{\n    "bank": "cbe",\n    "reference": "FT26SAMPLE01",\n    "accountNumber": "1000000006171"\n  }\'' },
      { type: "text", text: "Response:" },
      { type: "code", lang: "json", code: '{\n  "success": true,\n  "verified": true,\n  "bank": "Commercial Bank of Ethiopia",\n  "reference": "FT26SAMPLE01",\n  "amount": 1250.5,\n  "currency": "ETB",\n  "senderName": "ABEBE KEBEDE",\n  "senderAccount": "1****4321",\n  "receiverName": "TIGIST ALEMU",\n  "receiverAccount": "1****6171",\n  "date": "2026-10-01",\n  "sourceUrl": "https://apps.cbe.com.et:100/?id=FT26SAMPLE0100006171"\n}' },

      { type: "heading", text: "URL-based verification" },
      { type: "text", text: "If you have a receipt URL (e.g. from a QR code or shared link), you can skip the bank field. cheki auto-detects the bank from the URL:" },
      { type: "code", lang: "bash", code: 'curl -X POST https://cheki.et/api/verify \\\n  -H "Content-Type: application/json" \\\n  -d \'{\n    "reference": "https://mbreciept.cbe.com.et/fHCxExampleRcpt01"\n  }\'' },

      { type: "heading", text: "Batch verification" },
      { type: "text", text: "For end-of-day reconciliation, verify up to 20 receipts in a single request (5 are checked at a time, and each one counts against the per-IP verify limit):" },
      { type: "code", lang: "bash", code: 'curl -X POST https://cheki.et/api/verify/batch \\\n  -H "Content-Type: application/json" \\\n  -d \'{\n    "receipts": [\n      {"bank": "cbe", "reference": "https://mbreciept.cbe.com.et/fHCxExampleRcpt01"},\n      {"bank": "telebirr", "reference": "DET0SAMPLE"},\n      {"bank": "boa", "reference": "AB12345678", "accountNumber": "12345"}\n    ]\n  }\'' },

      { type: "heading", text: "JavaScript integration" },
      { type: "code", lang: "javascript", code: "class ChekiAPI {\n  constructor(baseUrl = 'https://cheki.et') {\n    this.baseUrl = baseUrl;\n  }\n\n  async verify(bank, reference, accountNumber) {\n    const res = await fetch(`${this.baseUrl}/api/verify`, {\n      method: 'POST',\n      headers: { 'Content-Type': 'application/json' },\n      body: JSON.stringify({ bank, reference, accountNumber })\n    });\n    return res.json();\n  }\n\n  async verifyUrl(url) {\n    const res = await fetch(`${this.baseUrl}/api/verify`, {\n      method: 'POST',\n      headers: { 'Content-Type': 'application/json' },\n      body: JSON.stringify({ reference: url })\n    });\n    return res.json();\n  }\n\n  async batchVerify(receipts) {\n    const res = await fetch(`${this.baseUrl}/api/verify/batch`, {\n      method: 'POST',\n      headers: { 'Content-Type': 'application/json' },\n      body: JSON.stringify({ receipts })\n    });\n    return res.json();\n  }\n}\n\n// Usage\nconst cheki = new ChekiAPI();\nconst result = await cheki.verify('cbe', 'FT26SAMPLE01', '1000000006171');\nif (result.verified && result.amount === expectedAmount) {\n  console.log('Payment confirmed:', result.amount, result.currency);\n}" },

      { type: "heading", text: "Python integration" },
      { type: "code", lang: "python", code: "import requests\n\nclass ChekiAPI:\n    def __init__(self, base_url='https://cheki.et'):\n        self.base_url = base_url\n\n    def verify(self, bank, reference, account_number=None):\n        payload = {'bank': bank, 'reference': reference}\n        if account_number:\n            payload['accountNumber'] = account_number\n        r = requests.post(f'{self.base_url}/api/verify', json=payload)\n        return r.json()\n\n    def verify_url(self, url):\n        r = requests.post(f'{self.base_url}/api/verify',\n                         json={'reference': url})\n        return r.json()\n\n# Usage\ncheki = ChekiAPI()\nresult = cheki.verify('cbe', 'FT26SAMPLE01', '1000000006171')\nif result.get('verified') and result.get('amount') == expected_amount:\n    print(f'Payment confirmed: {result[\"amount\"]} {result[\"currency\"]}')" },

      { type: "heading", text: "Error handling" },
      { type: "text", text: "The API returns structured errors. Handle these cases:" },
      {
        type: "table",
        headers: ["HTTP Status", "Error", "Action"],
        rows: [
          ["200", "success: true, verified: true", "Payment confirmed"],
          ["200", "success: true, verified: false, decodedOnly: true", "BOA QR decoded but not confirmed by the bank. Not proof of payment"],
          ["400", "Missing fields or malformed reference", "Check request body"],
          ["404", "Bank not supported (unknown id or still in development)", "Check the bank id against /api/banks"],
          ["422", "Receipt not found, or the bank's response failed verification", "Treat as unverified; ask the customer to check the reference"],
          ["429", "Per-IP rate limit (Retry-After header)", "Wait Retry-After seconds, then retry once"],
          ["502", "Bank unreachable or geo-blocked (fallbackUrl for geo-blocked banks)", "Retry later, or open fallbackUrl in a browser"],
        ],
      },

      { type: "heading", text: "Fraud prevention checklist" },
      { type: "text", text: "Before releasing goods or services, run these checks:" },
      {
        type: "steps",
        items: [
          { title: "Check verified", text: "Accept only result.verified === true. verified: false does not always mean the receipt is fake: it can mean the bank has no such receipt, the bank's answer failed cheki's verification gate (no amount, wrong reference, failed or pending status), a BOA QR code was only decoded (decodedOnly), or the content was only parsed from what you sent (parsed, /api/parse). None of these is proof of payment." },
          { title: "Check amount", text: "Compare result.amount with the expected payment amount. Reject if different." },
          { title: "Check receiver", text: "Compare result.receiverAccount with your account number. Reject if different." },
          { title: "Check freshness", text: "Parse result.date and reject if the payment is older than your acceptable window (e.g. 1 hour)." },
          { title: "Check duplicates", text: "Store result.reference in your database. Before accepting, check if it already exists." },
        ],
      },
      { type: "code", lang: "javascript", code: "async function verifyPayment(customerRef, expectedAmount, myAccount) {\n  const result = await cheki.verify('cbe', customerRef, myAccount);\n\n  if (!result.success || !result.verified)\n    return { ok: false, reason: result.error || 'Not verified by the bank' };\n\n  if (result.amount !== expectedAmount)\n    return { ok: false, reason: `Amount mismatch: ${result.amount} vs ${expectedAmount}` };\n\n  if (result.receiverAccount && !result.receiverAccount.endsWith(myAccount.slice(-5)))\n    return { ok: false, reason: 'Wrong receiving account' };\n\n  const paymentDate = new Date(result.date);\n  const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000);\n  if (paymentDate < oneHourAgo)\n    return { ok: false, reason: 'Payment is too old' };\n\n  if (await isDuplicate(result.reference))\n    return { ok: false, reason: 'Duplicate receipt' };\n\n  return { ok: true, data: result };\n}" },

      { type: "callout", variant: "tip", title: "Self-host for production", text: "For production use, self-host cheki with Docker. This gives you full control, eliminates dependency on cheki.et, and allows you to add authentication, rate limiting, and logging." },
    ],
    faq: [
      { q: "Is the API really free? Are there limits?", a: "It is free and needs no authentication. The hosted API is rate limited per IP: verify 30 per minute, batch 5 per minute (up to 20 receipts each), parse and OCR 20 per minute each. Over the limit you get a 429 with a Retry-After header. For higher volume, self-host cheki with Docker." },
      { q: "What happens when a bank is geo-blocked?", a: "For Telebirr and M-Pesa, if cheki's server cannot reach the bank, the API returns success: false with a fallbackUrl field. You can redirect the user's browser to this URL, which works because the user's Ethiopian IP is not blocked." },
      { q: "Can I use the API commercially?", a: "Yes. cheki is MIT licensed. Use it in commercial products, SaaS, internal tools, or anything else. No attribution required (though appreciated)." },
    ],
    related: ["free-receipt-verification-no-api-key", "self-hosting-docker-guide", "ethiopian-bank-receipt-formats"],
    relatedPages: ["/docs", "/developers"],
    seo: {
      title: "Building a Payment Verification System with cheki's Free API",
      description: "Complete developer guide to integrating Ethiopian bank receipt verification with cheki's free REST API. JavaScript, Python, batch verification, and fraud prevention.",
      keywords: ["ethiopian payment verification API", "free receipt API", "CBE API integration", "telebirr API verify", "ethiopian bank API developer", "cheki API guide"],
    },
  },
  {
    slug: "open-source-ethiopian-fintech",
    title: "Open Source Ethiopian Fintech: Why It Matters",
    description:
      "Why open source matters for Ethiopian financial technology, how cheki fits in, and what the future of community-built fintech looks like.",
    category: "open-source",
    excerpt:
      "Ethiopian fintech is dominated by paid services wrapping public data. Open source changes the equation. This is what community-built tools like cheki do differently.",
    date: "2026-06-18",
    updated: "2026-10-15",
    readTime: "5 min",
    content: [
      { type: "text", text: "Ethiopia's fintech scene has a peculiar characteristic: many of the most useful services are built on top of public data that anyone can access, yet wrapped in paywalls and closed source code. cheki challenges this model by being completely open source and free." },

      { type: "heading", text: "The problem with closed-source fintech in Ethiopia" },
      { type: "text", text: "When a service like check.et or verify.et is closed source, several things happen:" },
      { type: "list", items: [
        "Users can't verify how their data is handled",
        "If the company shuts down, the service disappears",
        "Pricing can change without notice",
        "No one can audit the verification process for accuracy",
        "The community can't contribute improvements or new bank support",
        "AI tools and search engines may be blocked from accessing content",
      ]},

      { type: "heading", text: "What open source changes" },
      { type: "text", text: "cheki is MIT licensed. This means:" },
      { type: "list", items: [
        "Anyone can read the source code and verify exactly how receipt verification works",
        "Anyone can self-host with Docker, eliminating dependency on cheki.et",
        "If a bank changes their endpoint, anyone can submit a fix via GitHub",
        "If a new bank launches, anyone can add support",
        "The community owns the tool, not a company",
        "No one can shut it down or put it behind a paywall",
      ]},

      { type: "callout", variant: "quote", title: "Linus's Law", text: "\"Given enough eyeballs, all bugs are shallow.\" Open source means the code is reviewed by more people, which leads to better quality and faster fixes." },

      { type: "heading", text: "Existing open source projects" },
      { type: "text", text: "cheki is not the only open source Ethiopian receipt verification project. Here's the full picture:" },
      {
        type: "table",
        headers: ["Project", "Language", "Banks", "Stars", "Unique feature"],
        rows: [
          ["cheki", "TypeScript + Python", "9", "0", "Web UI + API + Docker + QR scanning"],
          ["ethiobank_receipts", "Python", "6", "40", "PyPI published, multithreaded"],
          ["verification-engine", "TypeScript", "4", "1", "OCR + SMS parsing, npm published"],
          ["telebirr-receipt", "JavaScript", "1", "14", "Telebirr-only, npm published"],
          ["receipt_verify", "TypeScript", "2", "2", "NestJS + PostgreSQL + duplicate detection"],
          ["veri-py", "Python", "6", "0", "Async/sync, image verification via OpenAI"],
        ],
      },
      { type: "text", text: "cheki builds on the work of these projects and adds: web UI, REST API, batch verification, TypeScript SDK, Python library, Docker, bank-specific guide pages, QR code scanning, URL auto-detection, and SEO content that helps users discover the free alternative." },

      { type: "heading", text: "Why AI access matters" },
      { type: "text", text: "More people are asking AI assistants like ChatGPT and Claude for help with Ethiopian payment verification. When someone asks 'how do I verify a CBE receipt for free', the AI should be able to find and cite cheki." },
      { type: "text", text: "cheki's robots.txt explicitly allows GPTBot, ClaudeBot, CCBot, Google-Extended, PerplexityBot, and all other AI crawlers. We also publish an llms.txt file with key facts that AI assistants can reference directly." },
      { type: "callout", variant: "tip", title: "llms.txt", text: "cheki publishes a /llms.txt file with structured facts about the service, supported banks, API endpoints, and key data. This is a new standard for making websites AI-readable. Visit https://cheki.et/llms.txt to see it." },

      { type: "heading", text: "Contributing to cheki" },
      { type: "text", text: "cheki welcomes contributions from the Ethiopian developer community. Ways to contribute:" },
      { type: "list", items: [
        "Add support for a new bank by implementing a parser in src/app/api/verify/route.ts",
        "Improve the UI/UX in src/app/page.tsx",
        "Write a guide or blog post about your experience with payment verification",
        "Test with real receipts and report bugs",
        "Star the repo on GitHub to help others discover it",
        "Self-host and share your experience",
      ]},
      { type: "text", text: "GitHub: https://github.com/1RB/cheki" },
    ],
    faq: [
      { q: "Is cheki affiliated with any Ethiopian bank?", a: "No. cheki is not affiliated with any Ethiopian bank or wallet. It uses publicly accessible receipt endpoints. All data comes from official bank systems." },
      { q: "Can I fork cheki and build my own paid service?", a: "Technically yes, since it's MIT licensed. But we'd prefer you didn't put a paywall on public data. If you build something on top of cheki, keep it free or open source." },
      { q: "How can I contribute to cheki?", a: "Fork the repo on GitHub, make your changes, and submit a pull request. Read the contributing guide in the README for details on adding bank support, improving the UI, or writing guides." },
    ],
    related: ["contribute-new-bank", "contribute-translations", "self-hosting-docker-guide"],
    relatedPages: ["/compare"],
    seo: {
      title: "Open Source Ethiopian Fintech: Why It Matters",
      description: "Why open source matters for Ethiopian financial technology, how cheki fits in, and why community-built tools are better than paywalled services wrapping public data.",
      keywords: ["open source ethiopian fintech", "free ethiopian payment tools", "cheki open source", "ethiopian bank verification open source", "MIT license ethiopia"],
    },
  },
  {
    slug: "boa-qr-code-receipts",
    title: "BOA QR Codes: Encrypted Receipts and How Decryption Works",
    description:
      "Bank of Abyssinia QR codes use AES-256-CBC encryption, not URLs like CBE. Here's how the encryption works, what's inside the payload, and how cheki decrypts it for instant inter-bank verification.",
    category: "technical",
    bankCode: "boa",
    excerpt:
      "BOA's receipt QR codes are AES-256-CBC encrypted payloads using CryptoJS format. The key is public in BOA's web app. This guide covers how decryption works and why inter-bank transfers need it.",
    date: "2026-06-19",
    updated: "2026-10-19",
    readTime: "6 min",
    content: [
      { type: "text", text: "Bank of Abyssinia takes a different approach to receipt QR codes than CBE. Instead of encoding a URL that points to a server-side receipt, BOA encrypts the full transaction data directly into the QR code. This means the QR code itself IS the receipt, not just a link to one." },

      { type: "callout", variant: "info", title: "Two approaches, same goal", text: "CBE's QR codes encode a short URL (mbreciept.cbe.com.et/{id}) that redirects to server-side data. BOA's QR codes encode the transaction data itself, encrypted with AES-256-CBC. Both work, but they have different security trade-offs." },

      { type: "heading", text: "What the QR code contains" },
      { type: "text", text: "When you scan a BOA receipt QR code with a standard QR reader, you get a base64-encoded string like this:" },
      { type: "code", code: "KPHO0k4YlK/5s61BrKNnjG8dcbVjm5WqkNeCv93+8UYEinGOPAL1+Wpq6cy8McTYhpdXUgKvK4qFFcGhM0Yi+ZgrqD8G3UKsoUNwSiKqWXilJTG+1yIE+KEEK7IuoZl7" },
      { type: "text", text: "This is not a URL. It's a base64-encoded ciphertext. When decoded and decrypted, it reveals a comma-separated string with 7 fields:" },
      { type: "code", code: "senderAccount,senderName,amount,reference,date,receiverAccount,receiverName" },
      { type: "text", text: "For example, the QR above decrypts to:" },
      { type: "code", code: "1****4321,ABEBE KEBEDE,1250.5,FT26SAMPLE07,01/10/2026  14:05:00,1000000006171,TIGIST ALEMU" },

      { type: "heading", text: "How the encryption works" },
      { type: "text", text: "BOA uses the CryptoJS library for encryption. CryptoJS is a popular JavaScript encryption library. The encryption parameters are hardcoded in BOA's receipt web app, which is served from cs.bankofabyssinia.com/slip/assets/index-*.js. Here are the exact parameters:" },
      {
        type: "table",
        headers: ["Parameter", "Value", "Purpose"],
        rows: [
          ["Algorithm", "AES-256-CBC", "Symmetric encryption with 256-bit key and CBC mode"],
          ["Password", "ELqVy2g4pGWLUIKSa+1ijwpPy6eDxBFBLBPrJ24v/IA=", "Base64-encoded passphrase for key derivation"],
          ["Salt", "salt", "PBKDF2 salt (static string)"],
          ["IV", "1234567890123456", "16-byte initialization vector (static)"],
          ["Iterations", "10000", "PBKDF2 key derivation iterations"],
          ["Key length", "32 bytes (256 bits)", "Derived key length for AES-256"],
          ["Hash function", "SHA1", "PBKDF2 hash function for key derivation"],
        ],
      },
      { type: "text", text: "The decryption process works in 3 steps:" },
      {
        type: "ordered",
        items: [
          "Base64 decode the QR payload to get the raw ciphertext bytes",
          "Derive the AES key using PBKDF2 with the password, salt, 10000 iterations, SHA1, and 32-byte key length",
          "Decrypt the ciphertext using AES-256-CBC with the derived key and the static IV",
        ],
      },
      { type: "text", text: "The result is a UTF-8 string in CSV format with 7 comma-separated fields." },

      { type: "heading", text: "Why the key is public" },
      { type: "text", text: "BOA's receipt viewer is a client-side web app. When someone shares a receipt link, the recipient opens it in their browser and the JavaScript app decrypts the QR data locally to display the receipt. This means the decryption key must be embedded in the JavaScript that runs in the browser. Anyone who inspects the JS bundle can extract it." },
      { type: "callout", variant: "warning", title: "Security implication", text: "Because the key is public, anyone can create a valid-looking BOA QR payload from scratch. You could encrypt arbitrary transaction data with the same key and produce a QR code that cheki (or BOA's own app) would decrypt as 'verified.' This is a fundamental limitation of BOA's design, not a cheki issue. The same applies to any verification tool that decrypts BOA QR codes." },
      { type: "callout", variant: "danger", title: "Forged QR risk for inter-bank", text: "For normal BOA-to-BOA transfers, you can cross-check the QR data against BOA's JSON API. But for inter-bank transfers (BOA to CBE, Dashen, etc.), the API returns 'Invalid reference number,' so the QR code is the ONLY proof. Since the key is public, a forged QR code cannot be distinguished from a real one. Always verify inter-bank transfers with additional confirmation (bank statement, SMS alert, branch confirmation) for high-value transactions." },

      { type: "heading", text: "Inter-bank vs intra-bank: two verification paths" },
      { type: "text", text: "BOA has two distinct verification paths depending on whether the transfer stays within BOA or goes to another bank:" },
      {
        type: "table",
        headers: ["Transfer type", "API lookup", "QR decryption", "Recommended method"],
        rows: [
          ["BOA to BOA (intra-bank)", "Works (JSON API)", "Works", "API lookup (can cross-check)"],
          ["BOA to CBE/Dashen/other (inter-bank)", "Fails ('Invalid reference number')", "Works", "QR decryption (only option)"],
        ],
      },
      { type: "text", text: "When a customer sends money from BOA to CBE, the transaction reference starts with 'FT' (e.g., FT25SAMPLE06). BOA's online slip API at cs.bankofabyssinia.com does not recognize these references because the transfer left BOA's system. The QR code, however, was generated at the time of transfer and contains all the details." },

      { type: "heading", text: "How cheki handles BOA QR codes" },
      { type: "text", text: "cheki's unified scanner auto-detects BOA QR payloads. When you scan a QR code or upload a receipt image, cheki checks whether the decoded string matches BOA's encrypted format (base64 string with correct AES block alignment). If it does, cheki decrypts it server-side via the /api/verify endpoint and returns the parsed transaction data." },
      {
        type: "steps",
        items: [
          { title: "Scan or upload", text: "Open cheki, tap the camera icon to scan the QR code on the receipt, or upload a screenshot/photo of the receipt. cheki's multi-scale QR detector finds QR codes even in full receipt screenshots." },
          { title: "Auto-detection", text: "cheki checks if the decoded string is a BOA encrypted payload (base64, correct length, AES block-aligned). If yes, it routes to BOA QR decryption. If it's a URL, it routes to URL verification. If it's a CBE reference, it routes to CBE." },
          { title: "Server-side decryption", text: "The encrypted payload is sent to cheki's /api/verify endpoint, which decrypts it server-side using Node.js crypto. This prevents client-side tampering where someone could modify the decryption logic in the browser." },
          { title: "Instant result", text: "Decryption takes ~8ms server-side. The full transaction data (sender, receiver, amount, date, reference) appears in under 500ms including network round-trip." },
        ],
      },

      { type: "callout", variant: "tip", title: "No account number needed for QR", text: "Unlike a typed BOA reference, which needs the last 5 digits of the account on the receipt, QR-based verification needs no additional information. The QR code contains everything. Just scan and verify." },

      { type: "heading", text: "BOA QR vs CBE QR: a comparison" },
      {
        type: "table",
        headers: ["Feature", "BOA QR code", "CBE QR code"],
        rows: [
          ["Encoding", "AES-256-CBC encrypted payload", "Plain URL (mbreciept.cbe.com.et/{id})"],
          ["Contains transaction data", "Yes (encrypted in QR)", "No (data fetched from server)"],
          ["Requires server call", "No (can decrypt locally)", "Yes (must call CBE API)"],
          ["Account number needed", "No", "No (new system) / Yes (old system)"],
          ["Inter-bank support", "Yes (QR is the only option)", "N/A (CBE receipts always work)"],
          ["Forgery risk", "High (key is public, can forge QR)", "Low (server validates ID)"],
          ["Speed", "~500ms (decrypt + network)", "~1-2s (API call + JSON parse)"],
          ["Offline verification", "Possible (decrypt locally)", "Not possible (needs API)"],
        ],
      },

      { type: "heading", text: "Verifying BOA QR codes via API" },
      { type: "text", text: "Send the QR payload in the qrData field. No reference or account number is needed:" },
      { type: "code", lang: "bash", code: 'curl -X POST https://cheki.et/api/verify \\\n  -H "Content-Type: application/json" \\\n  -d \'{"bank":"boa","qrData":"KPHO0k4YlK/5s61BrKNnjG8dcbVjm5WqkNeCv93+8UYEinGOPAL1+Wpq6cy8McTYhpdXUgKvK4qFFcGhM0Yi+ZgrqD8G3UKsoUNwSiKqWXilJTG+1yIE+KEEK7IuoZl7"}\'' },
      { type: "text", text: "Response:" },
      { type: "code", lang: "json", code: '{\n  "verified": true,\n  "bank": "Bank of Abyssinia",\n  "senderName": "ABEBE KEBEDE",\n  "senderAccount": "1****4321",\n  "receiverName": "TIGIST ALEMU",\n  "receiverAccount": "1000000006171",\n  "amount": 1250.5,\n  "currency": "ETB",\n  "date": "01/10/2026  14:05:00",\n  "reference": "FT26SAMPLE07"\n}' },

      { type: "heading", text: "Extracting the key from BOA's web app" },
      { type: "text", text: "The decryption key and parameters are in BOA's receipt viewer JavaScript bundle. Here's where to find them:" },
      { type: "code", code: "# The receipt viewer is at:\n# https://cs.bankofabyssinia.com/slip/{receipt-id}\n#\n# The JavaScript bundle is loaded from:\n# https://cs.bankofabyssinia.com/slip/assets/index-{hash}.js\n#\n# Search the bundle for CryptoJS.AES.decrypt to find:\n#   - The password string\n#   - The salt, IV, iterations, and hash function\n# All are passed as literals to CryptoJS.AES.decrypt()" },
      { type: "callout", variant: "warning", title: "Key may change", text: "If BOA updates their receipt viewer JavaScript, the password or parameters could change. cheki monitors this and updates the parser when needed. If you're self-hosting, check for key rotation after BOA app updates." },
    ],
    faq: [
      { q: "Can someone fake a BOA QR code?", a: "Yes. The AES key is public in BOA's web app JavaScript, so anyone can encrypt arbitrary data and produce a valid-looking QR code. This is a BOA design limitation. For high-value inter-bank transfers where the QR is the only proof, request additional confirmation (bank statement, SMS alert)." },
      { q: "Why doesn't BOA's API work for inter-bank transfers?", a: "When money leaves BOA to another bank (CBE, Dashen, etc.), the transaction reference (FT...) is recorded by the receiving bank, not BOA's online slip system. BOA's API only knows about internal transfers. The QR code was generated at transfer time and contains all the details regardless of destination." },
      { q: "What's the difference between BOA QR and CBE QR?", a: "CBE QR codes encode a URL (mbreciept.cbe.com.et/{id}) that points to server-side data. BOA QR codes encode the transaction data itself, encrypted with AES-256-CBC. CBE's approach is more secure (server validates the ID), while BOA's approach works offline but is forgeable since the key is public." },
      { q: "Does cheki decrypt BOA QR codes client-side or server-side?", a: "Server-side. The /api/verify endpoint performs the decryption using Node.js crypto. This prevents tampering with the decryption logic in the browser. The decrypted data is returned as structured JSON." },
      { q: "What if the BOA key changes?", a: "If BOA rotates the encryption key in their web app, cheki's parser will fail to decrypt new QR codes. The cheki team monitors BOA's JavaScript bundle for changes and updates the key when needed. If you're self-hosting, check src/lib/parsers/boa.ts for the current key." },
    ],
    related: ["cbe-receipt-qr-code", "ethiopian-bank-receipt-formats", "payment-fraud-ethiopia"],
    relatedPages: ["/banks/boa"],
    seo: {
      title: "BOA QR Codes: Encrypted Receipts and How Decryption Works",
      description: "Bank of Abyssinia QR codes use AES-256-CBC encryption. Here's how the encryption works, what's inside the payload, and how cheki decrypts it for instant inter-bank receipt verification.",
      keywords: ["BOA QR code", "Bank of Abyssinia QR", "BOA AES decryption", "BOA receipt encryption", "BOA inter-bank verification", "CryptoJS AES receipt", "BOA QR payload decrypt"],
    },
  },
  {
    slug: "contribute-new-bank",
    title: "How to Add a New Bank to cheki (Community Guide)",
    description:
      `cheki supports ${TOTAL_BANK_COUNT} Ethiopian banks but only ${LIVE_BANK_COUNT} are live. Here's how you can help add the rest. No coding required, just share a receipt. For developers: how to write a parser and submit a PR.`,
    category: "open-source",
    excerpt:
      `${IN_DEVELOPMENT_BANK_COUNT} Ethiopian banks and wallets still need confirmed receipt endpoints. You can help by sharing a receipt, writing a parser, or reporting broken endpoints. Here's the complete community contribution guide.`,
    date: "2026-06-19",
    updated: "2026-10-16",
    readTime: "5 min",
    content: [
      { type: "text", text: `cheki lists ${TOTAL_BANK_COUNT} Ethiopian banks and wallets, but only ${LIVE_BANK_COUNT} are live. The remaining ${IN_DEVELOPMENT_BANK_COUNT} are listed as 'in development' because we haven't confirmed their public receipt endpoints yet. This is where the community comes in.` },

      { type: "callout", variant: "tip", title: "No coding required", text: "The most valuable contribution is a receipt. If you use a bank we don't support yet, share a receipt screenshot or URL and we'll do the technical work." },

      { type: "heading", text: "Option 1: Share a receipt (easiest)" },
      { type: "text", text: "If you have a receipt from a bank marked 'In development' on cheki, here's what we need:" },
      {
        type: "list",
        items: [
          "A screenshot of the full receipt (or the receipt URL if the bank has a share feature)",
          "The QR code on the receipt (if there is one), scan it with any QR reader and send us the decoded text",
          "The transaction reference number",
          "The bank name",
        ],
      },
      { type: "text", text: "Send the link through the private 'Help us add' box on the bank's page on cheki.et. It goes only to the maintainers, is used only to build the parser, and is deleted afterwards. Do not paste receipt links in public GitHub issues; for those, use the bank request form with a redacted pattern. Every endpoint we know is documented on the endpoints reference page (cheki.et/endpoints)." },
      { type: "callout", variant: "warning", title: "Privacy", text: "For the private form, cover full account numbers, phone numbers and names with a solid box. Leave the reference and the QR code visible: that is what the parser is built from. For a public GitHub issue, cover those too (see below)." },
      ...REDACT_BEFORE_SHARING,

      { type: "heading", text: "Option 2: Write a parser (for developers)" },
      { type: "text", text: "If you can code, you can add a bank yourself. cheki's architecture is hexagonal. Each bank is a self-contained parser module. Here's the process:" },
      {
        type: "steps",
        items: [
          { title: "Fork the repo", text: "Go to github.com/1RB/cheki, click Fork, clone your fork locally." },
          { title: "Create a parser file", text: "Create src/lib/parsers/{bankcode}.ts. Extend BaseParser and implement buildUrl() and parse(). Look at telebirr.ts or dashen.ts for examples." },
          { title: "Register the parser", text: "Add your parser to src/lib/parsers/index.ts. It takes one import and one registerParser() call." },
          { title: "Add the bank to banks.ts", text: "Add a bank entry with code, name, endpoint, description, FAQ, and SEO metadata. Set status to 'live' if the endpoint works." },
          { title: "Write tests", text: "Create tests/parsers/{bankcode}.test.ts. Test buildUrl(), parse() with sample data, and edge cases (not found, empty response)." },
          { title: "Submit a PR", text: "Push to your fork and open a pull request. Include the receipt URL format in the PR description so we can verify." },
        ],
      },
      { type: "text", text: "The parser interface is simple:" },
      { type: "code", lang: "typescript", code: "class MyBankParser extends BaseParser {\n  readonly bankId = \"mybank\";\n  readonly bankName = \"My Bank\";\n  readonly responseType = \"html\" as const; // or \"json\" or \"pdf\"\n  readonly requiresAccount = false;\n  readonly requiresPhone = false;\n\n  buildUrl(ref: string, account?: string): string {\n    return `https://mybank.com/receipt/${ref}`;\n  }\n\n  parse(data: string | Buffer, contentType: string): ParsedReceipt {\n    // Parse the HTML/JSON/PDF response\n    // Return { verified: true, senderName, receiverName, amount, ... }\n  }\n}" },

      { type: "heading", text: "Option 3: Report broken endpoints" },
      { type: "text", text: "Banks occasionally change their receipt URL formats. If you notice that a bank that used to work on cheki is now returning errors, open a GitHub issue with:" },
      {
        type: "list",
        items: [
          "The bank name",
          "The error message you see",
          "The reference number you tried (so we can test)",
          "What the receipt looks like in the bank's own app (screenshot if possible)",
        ],
      },
      { type: "text", text: "Because cheki is open source, anyone can submit a fix, not just the original developers. This is the advantage of community-built tools over closed services like check.et and verify.et." },

      { type: "heading", text: "Current coverage status" },
      {
        type: "table",
        headers: ["Status", "Count", "Banks"],
        rows: [
          ["Live", String(LIVE_BANK_COUNT), liveBankList()],
          ["In development", String(IN_DEVELOPMENT_BANK_COUNT), "Every other bank on the banks page, including Zemen, CBE Birr and the eBirr tenants (Nib, Wegagen, Ahadu, KAAFI). Each goes live once a real receipt confirms its parser."],
        ],
      },

      { type: "heading", text: "Why community matters for Ethiopian fintech" },
      { type: "text", text: "Ethiopia has 30+ licensed banks, but most receipt verification services (check.et, verify.et, qbirr, tinaverify) only support 6-10. The long tail of smaller and newer banks gets ignored because it's not profitable enough for paid services." },
      { type: "text", text: "Open source changes this. Every contribution, whether it's a receipt screenshot or a full parser, helps cover a bank that paid services won't bother with. The community can move faster than any single company." },
      { type: "callout", variant: "success", title: "Every receipt counts", text: "One receipt from a bank we don't support is enough to start verifying it for every cheki user. You do not need to write code." },
    ],
    faq: [
      { q: "Do I need to know how to code to contribute?", a: "No. The most valuable contribution is a receipt from a bank we don't support yet. Send us a screenshot or URL and we'll handle the technical work." },
      { q: "Is it safe to share my receipt?", a: "Through the private form, yes, once you cover your full account number, phone number and names with a solid box. We only need the receipt structure, the reference and the QR code. Never share your PIN, password, or OTP." },
      { q: "How long does it take to add a new bank?", a: "If we have a receipt to reverse-engineer, usually within a day. If a developer submits a complete parser with tests, we merge it the same day." },
      { q: "Can I add a bank that no verification service supports?", a: `Yes. That's the whole point. If you find the receipt endpoint, we'll add it. cheki lists ${TOTAL_BANK_COUNT} banks and wallets, including the ones no paid service covers yet, not just the profitable ones.` },
      { q: "What if a bank doesn't have a public receipt endpoint?", a: "Some banks may not have receipt sharing yet. In that case, we list them as 'researching' and wait until they launch a digital receipt system. We don't fake it." },
    ],
    related: ["open-source-ethiopian-fintech", "contribute-translations", "ethiopian-bank-receipt-formats"],
    relatedPages: ["/endpoints"],
    seo: {
      title: "How to Add a New Bank to cheki (Community Guide)",
      description: "Help cheki support all Ethiopian banks. Share a receipt, write a parser, or report broken endpoints. No coding required to contribute.",
      keywords: ["cheki contribute", "add bank to cheki", "ethiopian bank receipt endpoint", "open source ethiopian fintech", "cheki community", "help add banks"],
    },
  },
  {
    slug: "contribute-translations",
    title: "Help translate cheki into your language",
    category: "open-source",
    description: "cheki is built for Ethiopia. Add Amharic, Oromiffa, Tigrinya, or any other language. No coding required: just edit a JSON file.",
    excerpt: "Translate cheki's interface into your language. No coding required. English and Amharic are live; we need Oromiffa, Tigrinya, Somali, and more.",
    readTime: "5 min",
    date: "2026-06-20",
    updated: "2026-10-07",
    content: [
      { type: "text", text: "cheki is open source and free, but it's only useful if people can read it. Right now the interface is in English and Amharic. We want to add Oromiffa, Tigrinya, Somali, and any other language the community needs." },
      { type: "text", text: "You do not need to be a developer to translate cheki. Translations live in a single JSON file per language. If you can edit text, you can translate it." },

      { type: "heading", text: "How translation works" },
      { type: "text", text: "Every piece of user-facing text in cheki has a key. For example, the hero title is stored as 'hero.title'. The English file says 'Verify Ethiopian receipts for free'. The Amharic file says 'የኢትዮጵያ ደረሰኞችን በነፃ ያረጋግጡ'." },
      { type: "text", text: "To add a new language, you copy the English file, translate each value, and submit it. The site will automatically load the new language once the file is merged." },

      { type: "heading", text: "Two ways to contribute" },
      {
        type: "list",
        items: [
          "GitHub: Fork github.com/1RB/cheki, copy src/lib/i18n/translations.ts, add your locale, and open a pull request.",
          "Telegram: Send translated text to @raysterminalbot and we will format it into the codebase for you.",
        ],
      },

      { type: "heading", text: "What to translate first" },
      {
        type: "list",
        items: [
          "Navigation labels (Verify, Banks, Guides, Developers, Compare)",
          "Hero text and the verify form",
          "Bank status labels (Live, In development)",
          "Footer links and legal text",
          "Compare page section headers",
        ],
      },

      { type: "heading", text: "File structure" },
      { type: "text", text: "Translations are in src/lib/i18n/translations.ts. Each locale is a top-level object with the same keys as English. If a key is missing in a new language, the site falls back to English so nothing breaks." },
      { type: "text", text: "We keep all languages in one file so reviewers can see gaps easily. For now, focus on the strings used by the homepage, banks page, and footer. Guide articles and SEO pages stay in English until there is demand for translation." },

      { type: "heading", text: "Quality standards" },
      { type: "text", text: "Use the formal or informal tone that fits your language best. Keep bank names in English unless there is a widely accepted local spelling. Test your translation by running the site locally if you can, or just send us the text and we'll verify it renders correctly." },

      { type: "callout", variant: "success", title: "Start with one screen", text: "You don't have to translate everything. Even translating the hero and navigation helps a lot of users. We can merge partial translations and fill in the rest later." },
    ],
    faq: [
      { q: "Do I need to know how to code?", a: "No. You can translate the text in a message or document and we will add it to the code. If you know GitHub, opening a pull request is even faster." },
      { q: "Can I translate only part of the site?", a: "Yes. The site falls back to English for any missing keys. Partial translations are useful and welcome." },
      { q: "Which languages does cheki need most?", a: "Oromiffa, Tigrinya, Somali, and Sidama are the most requested. Any Ethiopian language is welcome." },
      { q: "Will machine translation be accepted?", a: "We prefer human translation. Machine translation is okay as a starting point if a native speaker reviews it before merge." },
      { q: "Can I translate guide articles too?", a: "Yes, but guide articles are much longer. Start with the interface strings. Once a language has good coverage, we can discuss translating specific guides." },
    ],
    related: ["contribute-new-bank", "open-source-ethiopian-fintech", "free-receipt-verification-no-api-key"],
    seo: {
      title: "Translate cheki into your language",
      description: "Help translate cheki into Amharic, Oromiffa, Tigrinya, Somali, or any Ethiopian language. No coding required. Open source community translation.",
      keywords: ["cheki translation", "translate cheki", "cheki amharic", "cheki oromiffa", "cheki tigrinya", "open source translation"],
    },
  },
];

export function getArticle(slug: string): Article | undefined {
  return articles.find((a) => a.slug === slug);
}

export function getArticlesByCategory(category: Article["category"]): Article[] {
  return articles.filter((a) => a.category === category);
}

export function getRelatedArticles(slug: string, limit = 3): Article[] {
  const article = getArticle(slug);
  if (!article || !article.related) return [];
  return article.related
    .map((s) => getArticle(s))
    .filter((a): a is Article => a !== undefined)
    .slice(0, limit);
}

/** The article's related non-guide pages that resolve to a linkable page. */
export function getRelatedPages(slug: string, limit = 2): InternalPageLink[] {
  const article = getArticle(slug);
  if (!article || !article.relatedPages) return [];
  return article.relatedPages
    .map((href) => internalPageLink(href))
    .filter((l): l is InternalPageLink => l !== undefined)
    .slice(0, limit);
}

// Backward compatibility exports
export type Guide = Article;
export const guides = articles;
export function getGuide(slug: string): Guide | undefined {
  return getArticle(slug);
}
export function getGuidesByCategory(category: Guide["category"]): Guide[] {
  return getArticlesByCategory(category);
}
export function getRelatedGuides(slug: string, limit = 3): Guide[] {
  return getRelatedArticles(slug, limit);
}
