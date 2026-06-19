/**
 * Programmatically generated SEO pages.
 *
 * These pages are generated from bank data in banks.ts, plus manually
 * written pages for API endpoints, fraud scenarios, and developer topics.
 *
 * Generated categories:
 *   1. Per-bank verification pages (banks without an existing manual page)
 *   2. Per-bank "check payment" pages (all 9 banks)
 *   3. Per-bank fake receipt detection (top 5 banks)
 *   4. Per-bank receipt format reference (top 5 banks)
 *   5. API endpoint documentation pages (4)
 *   6. Fraud scenario breakdown pages (4)
 *   7. Developer-focused pages (3)
 */

import type { SeoPage } from "./seo-pages";
import { banks, type Bank } from "./banks";

// ─── Helpers ──────────────────────────────────────────────────────

const top5Banks = ["cbe", "telebirr", "boa", "mpesa", "dashen"];
const banksWithoutManualPage = ["dashen", "awash", "zemen", "cbebirr", "siinqee"];

function receiptTypeLabel(b: Bank): string {
  if (b.responseType === "pdf") return "PDF document";
  if (b.responseType === "json") return "JSON API response";
  return "HTML page";
}

function accountRequirement(b: Bank): string {
  if (b.requiresAccount) {
    return `the transaction reference number plus the last ${b.accountDigits} digits of the receiving account number`;
  }
  if (b.requiresPhone) {
    return "the transaction reference number plus the payer's phone number (in 2519XXXXXXXXX format)";
  }
  return "only the transaction reference number";
}

// ─── Category 1: Per-bank verification pages ──────────────────────

const bankVerificationPages: SeoPage[] = banks
  .filter((b) => banksWithoutManualPage.includes(b.code))
  .map((b): SeoPage => ({
    slug: `verify-${b.code}-receipt-online`,
    title: `Verify ${b.name} Receipt Online - Free & Instant | cheki`,
    h1: `Verify a ${b.name} Receipt Online`,
    metaDescription: `Check if a ${b.shortName} receipt is real or fake. Free, instant, no signup. ${b.requiresAccount ? `Paste your reference and account number` : `Paste your transaction reference`} to verify any ${b.shortName} payment in seconds.`,
    keywords: [
      `verify ${b.shortName} receipt`,
      `check ${b.shortName} payment`,
      `${b.shortName} receipt verification`,
      `${b.shortName} transaction check`,
      `${b.name.toLowerCase()} receipt online`,
    ],
    intent: "transactional",
    bankCode: b.code,
    faq: [
      {
        q: `How do I verify a ${b.shortName} receipt?`,
        a: b.requiresAccount
          ? `Select ${b.name}, paste your transaction reference number, enter the last ${b.accountDigits} digits of the receiving account, and click Verify. cheki fetches the receipt from ${b.shortName}'s public endpoint and shows you the result in seconds.`
          : b.requiresPhone
          ? `Select ${b.name}, paste your transaction reference number and the payer's phone number (2519XXXXXXXXX format), and click Verify. cheki fetches the receipt from ${b.shortName}'s public endpoint and shows you the result instantly.`
          : `Select ${b.name}, paste your transaction reference number, and click Verify. cheki fetches the receipt from ${b.shortName}'s public endpoint and shows you the result instantly.`,
      },
      {
        q: `Do I need an account number to verify ${b.shortName}?`,
        a: b.requiresAccount
          ? `Yes. ${b.shortName}'s receipt endpoint requires the transaction reference plus the last ${b.accountDigits} digits of the receiving account number. Without the account digits, the endpoint returns no data.`
          : b.requiresPhone
          ? `No account number, but ${b.shortName} requires the payer's phone number (2519XXXXXXXXX format) in addition to the transaction reference. This is a security measure to prevent unauthorized receipt enumeration.`
          : `No. ${b.shortName} only requires the transaction reference number. The receipt is returned as a ${receiptTypeLabel(b)} with payer name, receiver name, amount, and date.`,
      },
      {
        q: b.geoBlocked
          ? `Why does ${b.shortName} verification sometimes fail from outside Ethiopia?`
          : `Is ${b.shortName} receipt verification free?`,
        a: b.geoBlocked
          ? `${b.shortName}'s endpoint (${b.endpoint}) blocks requests from non-Ethiopian IP addresses. If cheki's server can't reach it, we provide a direct link for you to open the receipt yourself. Self-hosting cheki on an Ethiopian IP bypasses this restriction.`
          : `Yes, cheki is completely free with no limits. check.et charges 499 ETB/month after 200 verifications. cheki uses the same public ${b.shortName} endpoint but charges nothing.`,
      },
    ],
    sections: [
      {
        heading: `How ${b.shortName} receipt verification works`,
        body: `${b.name} publishes transaction receipts at a public URL: ${b.endpointFormat}. No authentication is required. cheki fetches this URL, ${b.responseType === "pdf" ? "downloads the PDF, extracts the text" : b.responseType === "json" ? "parses the JSON response" : "parses the HTML receipt"}, and returns structured JSON with sender name, receiver name, amount, date, and reference number.`,
      },
      {
        heading: `What you need to verify a ${b.shortName} receipt`,
        body: `To verify a ${b.shortName} receipt, you need ${accountRequirement(b)}.`,
        bullets: b.requiresAccount
          ? [
              `Transaction reference number (e.g. ${b.referenceExample}), found on the receipt or in the ${b.shortName} app`,
              `Last ${b.accountDigits} digits of the receiving account number, the account that received the payment`,
            ]
          : [
              `Transaction reference number (e.g. ${b.referenceExample}), found on the receipt or in the ${b.shortName} app`,
              `No account number required, ${b.shortName} returns the full receipt with just the reference`,
            ],
      },
      {
        heading: `How to spot a fake ${b.shortName} receipt`,
        body: `Fake ${b.shortName} receipts are a growing problem in Ethiopia. A fake receipt may have a real-looking reference number but will not appear in ${b.shortName}'s system. Always verify through cheki or the official ${b.shortName} app. If cheki returns 'Receipt not found', the receipt is likely fake.`,
        bullets: [
          "Check that the sender name matches who claimed to send the payment",
          "Verify the amount matches what was agreed",
          "Confirm the date is recent (not an old receipt being reused)",
          `Check the reference number format (${b.referenceFormat})`,
        ],
      },
    ],
    cta: { text: `Verify a ${b.shortName} receipt now`, href: `/?bank=${b.code}` },
  }));

// ─── Category 2: Per-bank "check payment" pages ───────────────────

const checkPaymentPages: SeoPage[] = banks.map((b): SeoPage => ({
  slug: `check-${b.code}-payment-online`,
  title: `Check ${b.name} Payment Online - Free | cheki`,
  h1: `Check a ${b.name} Payment Online`,
  metaDescription: `Check if a ${b.shortName} payment went through. Free, instant, no signup. Verify any ${b.shortName} transaction by reference number${b.requiresAccount ? ` and account` : ``}.`,
  keywords: [
    `check ${b.shortName} payment`,
    `${b.shortName} payment status`,
    `${b.shortName} transaction status online`,
    `verify ${b.shortName} transfer`,
    `${b.shortName} payment confirmation`,
  ],
  intent: "transactional",
  bankCode: b.code,
  faq: [
    {
      q: `How do I check if a ${b.shortName} payment was successful?`,
      a: `Select ${b.name} on cheki, enter the transaction reference number${b.requiresAccount ? ` and the last ${b.accountDigits} digits of the receiving account` : ``}, and click Verify. If the payment exists, cheki shows you the sender name, receiver name, amount, and date. If it doesn't exist, the payment was not completed or the receipt is fake.`,
    },
    {
      q: `Can I check a ${b.shortName} payment without the receipt?`,
      a: b.requiresAccount
        ? `You need the transaction reference number and the last ${b.accountDigits} digits of the receiving account. Both are shown on the receipt. Without them, there is no way to look up a ${b.shortName} transaction through public endpoints.`
        : `You need the transaction reference number. This is shown on the receipt and in the ${b.shortName} app's transaction history. Without it, there is no way to look up a ${b.shortName} transaction through public endpoints.`,
    },
    {
      q: `Is checking ${b.shortName} payments free?`,
      a: `Yes. cheki checks ${b.shortName} payments for free with no limits. check.et charges 499 ETB/month after 200 checks for the same data. cheki uses the same public ${b.shortName} endpoint.`,
    },
  ],
  sections: [
    {
      heading: `Checking ${b.shortName} payment status`,
      body: `${b.name} publishes transaction data at ${b.endpointFormat}. When someone sends you a payment via ${b.shortName}, a receipt is generated at this URL. cheki fetches the receipt, parses it, and tells you whether the payment is real, who sent it, and for how much. This takes 2 to 10 seconds.`,
    },
    {
      heading: `What information you need`,
      body: `To check a ${b.shortName} payment, ask the sender for the transaction reference number from their receipt${b.requiresAccount ? ` and make sure you know the last ${b.accountDigits} digits of your receiving account` : ``}. ${b.requiresAccount ? `Both pieces of information are required by the endpoint.` : `That's all you need, no account number required.`}`,
      bullets: [
        `Transaction reference (e.g. ${b.referenceExample})`,
        ...(b.requiresAccount ? [`Last ${b.accountDigits} digits of your account number`] : []),
        ...(b.geoBlocked ? [`If accessing from outside Ethiopia, cheki provides a fallback link`] : []),
      ],
    },
    {
      heading: `Common ${b.shortName} payment verification scenarios`,
      body: `${b.shortName} payment verification is used by merchants, delivery services, and businesses across Ethiopia. Common scenarios include confirming a customer has actually paid before releasing goods, verifying a delivery payment before handing over a package, and reconciling end-of-day bank transfers.`,
      bullets: b.useCases.slice(0, 4),
    },
  ],
  cta: { text: `Check a ${b.shortName} payment now`, href: `/?bank=${b.code}` },
}));

// ─── Category 3: Per-bank fake receipt detection ──────────────────

const fakeReceiptPages: SeoPage[] = banks
  .filter((b) => top5Banks.includes(b.code))
  .map((b): SeoPage => ({
    slug: `fake-${b.code}-receipt-detection`,
    title: `How to Detect a Fake ${b.name} Receipt | cheki`,
    h1: `Detecting Fake ${b.name} Receipts`,
    metaDescription: `Learn how to spot a fake ${b.shortName} receipt. Common fraud techniques, red flags, and how to verify any ${b.shortName} payment instantly for free.`,
    keywords: [
      `fake ${b.shortName} receipt`,
      `detect fake ${b.shortName} payment`,
      `${b.shortName} receipt fraud`,
      `forge ${b.shortName} receipt`,
      `${b.shortName} fake transaction`,
    ],
    intent: "informational",
    bankCode: b.code,
    faq: [
      {
        q: `How do I know if a ${b.shortName} receipt is fake?`,
        a: `The only reliable way is to verify it against ${b.shortName}'s own system. Every ${b.shortName} receipt has a unique reference number. Paste it into cheki and we'll fetch the receipt from ${b.shortName}'s public endpoint. If the receipt doesn't exist, it's fake. If it exists but the amount or sender name doesn't match, someone may be using a real receipt for a different transaction.`,
      },
      {
        q: `Can someone edit a ${b.shortName} screenshot?`,
        a: `Yes. Screenshots can be edited in any photo editing app in seconds. A fraudster can take a genuine ${b.shortName} receipt screenshot, change the amount or reference number, and send it to you. The edited screenshot looks real but the transaction doesn't exist in ${b.shortName}'s system. Never trust screenshots alone.`,
      },
      {
        q: `What should I do if I detect a fake ${b.shortName} receipt?`,
        a: `Do not release goods or services. Ask the sender to complete the payment again. If you suspect intentional fraud, report the incident to ${b.name} and to the Ethiopian police cybercrime unit. Keep the fake receipt as evidence.`,
      },
    ],
    sections: [
      {
        heading: `Common ${b.shortName} receipt fraud techniques`,
        body: `Fraudsters target ${b.shortName} users with several techniques:`,
        bullets: [
          `Edited screenshots: taking a real ${b.shortName} receipt and changing the amount or reference number`,
          b.responseType === "pdf"
            ? `Forged PDFs: creating a PDF that looks like a ${b.shortName} receipt but has a fabricated reference number`
            : `Fabricated ${b.responseType.toUpperCase()} data: creating a fake receipt page that looks like ${b.shortName}'s format`,
          `Old receipts: reusing a genuine receipt from a past transaction and claiming it's new`,
          `Reference number guessing: generating plausible-looking reference numbers that don't exist in ${b.shortName}'s system`,
          `Pressure tactics: rushing you to release goods before you can verify`,
        ],
      },
      {
        heading: `How to verify a ${b.shortName} receipt`,
        body: `The only reliable way to detect a fake ${b.shortName} receipt is to verify it against the bank's own system. ${b.name} publishes receipts at ${b.endpointFormat}. cheki automates this: paste the reference number${b.requiresAccount ? ` and account digits` : ``} and cheki fetches the receipt in seconds. If the receipt doesn't exist in ${b.shortName}'s system, it's fake.`,
      },
      {
        heading: `Red flags specific to ${b.shortName}`,
        body: `Before even verifying, watch for these warning signs:`,
        bullets: [
          `The reference number doesn't match ${b.shortName}'s format (${b.referenceFormat})`,
          "The sender pressures you to release goods immediately",
          "The receipt shows a different amount than what was agreed",
          "The date on the receipt is from days or weeks ago",
          "The receipt is a low-quality screenshot or photo that's hard to read",
          "The sender avoids phone calls and only communicates via text",
        ],
      },
    ],
    cta: { text: `Verify a receipt now`, href: `/?bank=${b.code}` },
  }));

// ─── Category 4: Per-bank receipt format pages ────────────────────

const receiptFormatPages: SeoPage[] = banks
  .filter((b) => top5Banks.includes(b.code))
  .map((b): SeoPage => ({
    slug: `${b.code}-receipt-format-explained`,
    title: `${b.name} Receipt Format Explained - Technical Reference | cheki`,
    h1: `${b.name} Receipt Format`,
    metaDescription: `Complete technical reference for ${b.shortName} receipt format. Endpoint URL, ${b.responseType.toUpperCase()} response structure, field mappings, and parsing details.`,
    keywords: [
      `${b.shortName} receipt format`,
      `${b.shortName} receipt structure`,
      `${b.shortName} endpoint url`,
      `${b.shortName} ${b.responseType} receipt`,
      `${b.shortName} receipt fields`,
    ],
    intent: "informational",
    bankCode: b.code,
    faq: [
      {
        q: `What format does ${b.shortName} use for receipts?`,
        a: `${b.name} publishes receipts as ${receiptTypeLabel(b)}. The endpoint is ${b.endpointFormat}. ${b.responseType === "pdf" ? "The PDF contains payer name, receiver name, accounts, amount, date, reference, and branch." : b.responseType === "json" ? "The JSON response contains structured fields including sender name, receiver name, amount, currency, and date." : "The HTML page contains payer name, receiver name, amount, and date in a bilingual (English/Amharic) format."}`,
      },
      {
        q: `Do I need authentication to access ${b.shortName} receipts?`,
        a: `No. The ${b.shortName} receipt endpoint at ${b.endpoint} is publicly accessible without authentication.${b.geoBlocked ? " However, it is geo-blocked to Ethiopian IP addresses." : ""} This is by design: banks want merchants to be able to verify payments without needing API keys or login credentials.`,
      },
      {
        q: `What fields are in a ${b.shortName} receipt?`,
        a: b.responseType === "pdf"
          ? `The ${b.shortName} PDF receipt contains: ${b.name} header, payer name, payer account, receiver name, receiver account, transferred amount (ETB), payment date and time, reference number, and branch name.`
          : b.responseType === "json"
          ? `The ${b.shortName} JSON response contains: sender name, receiver name, amount, currency, transaction date, and transaction reference${b.requiresAccount ? `, plus account details` : ``}.`
          : `The ${b.shortName} HTML receipt contains: payer name, payer phone number, receiver name, receiver account, amount in Birr, and transaction date/time.`,
      },
    ],
    sections: [
      {
        heading: `${b.shortName} endpoint URL format`,
        body: `The ${b.shortName} receipt endpoint is: ${b.endpointFormat}. ${b.requiresAccount ? `The URL combines the transaction reference and the last ${b.accountDigits} digits of the receiving account into a single id parameter.` : `The URL takes only the transaction reference as a path parameter.`} Example: ${b.referenceExample}.`,
      },
      {
        heading: `${b.responseType.toUpperCase()} response structure`,
        body: b.responseType === "pdf"
          ? `${b.shortName} returns a PDF file. cheki downloads the PDF, extracts text using pdf parsing, and maps the extracted text to structured fields. The PDF contains a standard layout with the bank header, transaction details, and a QR code.`
          : b.responseType === "json"
          ? `${b.shortName} returns a JSON object. The response is structured and can be consumed directly without parsing. cheki passes the JSON through with normalized field names.`
          : `${b.shortName} returns an HTML page styled as a receipt. cheki fetches the HTML and extracts text from the DOM elements. The page is bilingual (English and Amharic).`,
      },
      {
        heading: `Field mappings for ${b.shortName}`,
        body: `cheki normalizes ${b.shortName} receipts into a standard JSON shape regardless of the source format:`,
        bullets: [
          `senderName: the account holder who sent the payment`,
          `receiverName: the account holder who received the payment`,
          `amount: the transferred amount in ETB`,
          `currency: always ETB for domestic transfers`,
          `date: transaction date and time`,
          `reference: the ${b.shortName} transaction reference number`,
          `sourceUrl: the full URL cheki fetched the receipt from`,
        ],
      },
    ],
    cta: { text: `Read the API docs`, href: "/docs" },
  }));

// ─── Category 5: API endpoint pages ───────────────────────────────

const apiEndpointPages: SeoPage[] = [
  {
    slug: "verify-receipt-api-endpoint",
    title: "POST /api/verify - Receipt Verification API | cheki",
    h1: "Verify Receipt API Endpoint",
    metaDescription: "POST /api/verify: verify a single Ethiopian bank receipt. No API key, no auth, no rate limit. Supports CBE, Telebirr, BOA, M-Pesa, and more.",
    keywords: ["receipt verification api", "verify receipt endpoint", "post api verify", "cheki api", "ethiopian receipt api endpoint"],
    intent: "transactional",
    faq: [
      { q: "What does POST /api/verify do?", a: "It verifies a single Ethiopian bank receipt. You send a JSON body with the bank code, reference number, and (for some banks) the account number. The endpoint fetches the receipt from the bank's public URL, parses it, and returns structured JSON with sender name, receiver name, amount, date, and the source URL." },
      { q: "Do I need an API key for /api/verify?", a: "No. cheki's API requires no authentication. No API key, no bearer token, no OAuth. Just POST with a JSON content type and the receipt details." },
      { q: "What's the rate limit?", a: "There is no rate limit. You can call /api/verify as many times as you want. For bulk verification, use POST /api/verify/batch to verify up to 50 receipts in a single request." },
    ],
    sections: [
      {
        heading: "Endpoint specification",
        body: "POST /api/verify: Verifies a single Ethiopian bank receipt. Accepts a JSON body with bank, reference, and optionally accountNumber. Returns a JSON response with the receipt data or an error message.",
      },
      {
        heading: "Request format",
        body: "Send a POST request with Content-Type: application/json. The body must contain the bank code (e.g. 'cbe', 'telebirr', 'boa'), the transaction reference number, and for banks that require it, the account number.",
        bullets: [
          "bank (required): bank code: cbe, telebirr, boa, mpesa, dashen, awash, zemen, cbebirr, siinqee",
          "reference (required): transaction reference number (e.g. FT26140P01YB)",
          "accountNumber (conditional): last 8 digits for CBE, last 5 for BOA, not required for Telebirr/M-Pesa",
        ],
      },
      {
        heading: "Response format",
        body: "The response is a JSON object. On success: verified=true, with senderName, receiverName, amount, currency, date, reference, sourceUrl. On failure: verified=false, with an error message explaining what went wrong (receipt not found, geo-blocked, invalid reference format).",
      },
    ],
    cta: { text: "Read full API docs", href: "/docs" },
  },
  {
    slug: "batch-verification-api",
    title: "POST /api/verify/batch - Batch Receipt Verification | cheki",
    h1: "Batch Verification API",
    metaDescription: "Verify up to 50 Ethiopian bank receipts in a single API call. No API key, no auth. Perfect for end-of-day reconciliation and bulk payment checking.",
    keywords: ["batch receipt verification", "bulk verify receipts", "batch api ethiopia", "verify multiple receipts", "reconciliation api ethiopia"],
    intent: "transactional",
    faq: [
      { q: "How many receipts can I verify at once?", a: "Up to 50 receipts per batch request. Each receipt in the batch is verified in parallel, so the total time is roughly the same as verifying a single receipt." },
      { q: "What happens if one receipt in the batch fails?", a: "Each receipt is verified independently. If one fails (e.g. receipt not found, geo-blocked), the others still succeed. The response includes an array of results with individual success/failure status for each receipt." },
      { q: "Is batch verification free?", a: "Yes. Batch verification is free with no limits, same as single verification. check.et and verify.et do not offer batch verification at all." },
    ],
    sections: [
      {
        heading: "Batch endpoint overview",
        body: "POST /api/verify/batch: Verifies up to 50 Ethiopian bank receipts in a single request. Accepts a JSON body with a 'receipts' array. Each receipt object has the same shape as the single verify endpoint: bank, reference, and optionally accountNumber. Returns an array of results.",
      },
      {
        heading: "Use cases for batch verification",
        body: "Batch verification is designed for businesses that need to verify multiple payments at once:",
        bullets: [
          "End-of-day reconciliation: verify all incoming transfers from the day",
          "E-commerce order processing: verify all pending payment receipts before shipping",
          "Delivery services: batch-verify all COD payments at the end of a route",
          "Accounting integration: sync verified receipts with your accounting software",
        ],
      },
      {
        heading: "Response structure",
        body: "The response is a JSON object with a 'results' array. Each element corresponds to a receipt in the request, in the same order. Each result has the same shape as the single verify response: verified, bank, reference, amount, senderName, receiverName, date, sourceUrl, or an error message.",
      },
    ],
    cta: { text: "Read full API docs", href: "/docs" },
  },
  {
    slug: "bank-listing-api-endpoint",
    title: "GET /api/banks - List Supported Banks | cheki",
    h1: "Bank Listing API",
    metaDescription: "GET /api/banks: list all supported Ethiopian banks and wallets. Returns bank codes, names, endpoint URLs, and verification requirements. Free, no auth.",
    keywords: ["ethiopian bank list api", "supported banks api", "cheki banks endpoint", "bank codes ethiopia", "bank listing api"],
    intent: "transactional",
    faq: [
      { q: "What does GET /api/banks return?", a: "A JSON array of all supported banks and wallets. Each bank object includes: code, name, shortName, type (bank/wallet/mobile), requiresAccount, accountDigits, endpoint, responseType, and status (live/soon)." },
      { q: "How many banks are supported?", a: "cheki currently supports 9 banks and wallets: CBE, Telebirr, Bank of Abyssinia, M-Pesa, Dashen Bank, Awash Bank, Zemen Bank, CBE Birr, and Siinqee Bank. New banks are added as their public endpoints are discovered." },
      { q: "Can I use this to auto-detect which bank a reference belongs to?", a: "Yes. The response includes refPrefixes for each bank (e.g. CBE references start with 'FT'). You can use this to automatically route verification requests to the correct bank." },
    ],
    sections: [
      {
        heading: "Endpoint specification",
        body: "GET /api/banks: Returns a list of all supported banks and wallets. No parameters, no authentication. The response is a JSON array of bank objects with full metadata including endpoint URLs, response types, and verification requirements.",
      },
      {
        heading: "Bank object fields",
        body: "Each bank in the response array contains:",
        bullets: [
          "code: short identifier (cbe, telebirr, boa, mpesa, etc.)",
          "name: full bank name",
          "shortName: abbreviated name for UI display",
          "type: 'bank', 'wallet', or 'mobile'",
          "requiresAccount: whether account number is needed for verification",
          "accountDigits: how many digits of the account are required",
          "endpoint: the bank's receipt endpoint domain",
          "responseType: 'pdf', 'json', or 'html'",
          "status: 'live' or 'soon'",
        ],
      },
      {
        heading: "Auto-detection use case",
        body: "The bank listing includes reference number prefixes for each bank. For example, CBE references start with 'FT', Telebirr references have a different format. Developers can use this metadata to auto-detect which bank a reference number belongs to, then route the verification request accordingly without asking the user to select a bank.",
      },
    ],
    cta: { text: "Read full API docs", href: "/docs" },
  },
  {
    slug: "receipt-health-check-api",
    title: "GET /api/health - Bank Endpoint Health Check | cheki",
    h1: "Bank Endpoint Health Check API",
    metaDescription: "GET /api/health: check the status and latency of all Ethiopian bank receipt endpoints. See which banks are up, down, or geo-blocked. Free, no auth.",
    keywords: ["bank endpoint health", "ethiopian bank status api", "receipt endpoint check", "bank api health", "cheki health check"],
    intent: "transactional",
    faq: [
      { q: "What does GET /api/health return?", a: "A JSON object with the health status of each supported bank endpoint. For each bank, it returns: status (up/down/blocked), latencyMs (response time in milliseconds), and lastChecked timestamp. This tells you which banks are currently reachable from cheki's servers." },
      { q: "Why would a bank endpoint be down?", a: "Bank endpoints can be temporarily down for maintenance, or they can be geo-blocked (Telebirr and M-Pesa block non-Ethiopian IPs). The health check tells you which endpoints are currently accessible so you can handle failures gracefully." },
      { q: "How often is the health check updated?", a: "The health check runs on-demand when you call the endpoint. It tests each bank endpoint in parallel and returns results in under 5 seconds. For continuous monitoring, poll /api/health at regular intervals." },
    ],
    sections: [
      {
        heading: "Health check overview",
        body: "GET /api/health: Tests the connectivity and latency of all supported bank receipt endpoints. For each bank, it makes a lightweight request to the bank's endpoint and reports whether the endpoint is reachable, how fast it responded, and whether it's geo-blocked.",
      },
      {
        heading: "Response structure",
        body: "The response is a JSON object keyed by bank code. Each bank has a status field ('up', 'down', 'blocked'), a latencyMs field (response time in milliseconds), and a lastChecked timestamp. This data is useful for monitoring dashboards and for gracefully handling endpoint failures in your integration.",
      },
      {
        heading: "Integration patterns",
        body: "Use the health check to build resilient integrations:",
        bullets: [
          "Check health before batch verification to skip banks that are down",
          "Display real-time bank status on your dashboard",
          "Set up alerts when a bank endpoint goes down",
          "Automatically fall back to manual verification when a bank is geo-blocked",
        ],
      },
    ],
    cta: { text: "Read full API docs", href: "/docs" },
  },
];

// ─── Category 6: Fraud scenario pages ─────────────────────────────

const fraudScenarioPages: SeoPage[] = [
  {
    slug: "telebirr-sms-spoofing-fraud",
    title: "Telebirr SMS Spoofing Fraud - How It Works & How to Stop It | cheki",
    h1: "Telebirr SMS Spoofing Fraud",
    metaDescription: "How fraudsters spoof Telebirr SMS payment notifications to trick merchants. Learn how SMS spoofing works, how to detect it, and how to protect your business.",
    keywords: ["telebirr sms spoofing", "sms fraud ethiopia", "fake sms payment notification", "telebirr fraud", "sms spoofing detection"],
    intent: "informational",
    bankCode: "telebirr",
    faq: [
      { q: "What is Telebirr SMS spoofing?", a: "SMS spoofing is when a fraudster sends a text message that appears to come from Telebirr's official SMS number, notifying you of a payment that never happened. The message looks identical to a real Telebirr payment notification but no actual transaction occurred." },
      { q: "How can I tell if a Telebirr SMS is fake?", a: "You cannot reliably tell from the SMS alone because the sender ID can be spoofed. The only way to confirm a payment is to verify the transaction reference through cheki or the official Telebirr app. If the reference number doesn't exist in Telebirr's system, the SMS was fake." },
      { q: "Is SMS spoofing common in Ethiopia?", a: "SMS spoofing fraud has been reported in Ethiopia, particularly targeting small merchants and delivery services who rely on SMS notifications to confirm payments. As Telebirr grows, this type of fraud is expected to increase. Always verify through the endpoint, not the SMS." },
    ],
    sections: [
      {
        heading: "How Telebirr SMS spoofing works",
        body: "When you receive a Telebirr payment, Ethio Telecom sends an SMS notification to your phone. Fraudsters exploit this by sending fake SMS messages that appear to come from Telebirr's short code. The fake SMS contains a made-up transaction reference number and amount, making it look like a real payment notification. If you trust the SMS without verifying, you release goods for a payment that never happened.",
      },
      {
        heading: "Why SMS sender IDs can be spoofed",
        body: "SMS sender IDs (the 'from' field) are not cryptographically verified by most telecom networks. Using SMS gateway services or SIM box setups, a fraudster can send messages with any sender ID, including Telebirr's official short code. The message arrives in the same conversation thread as real Telebirr notifications, making it nearly impossible to distinguish from a genuine message.",
        bullets: [
          "Sender IDs are not authenticated by the SS7 protocol",
          "Online SMS gateway services allow custom sender IDs",
          "The fake SMS appears in the same thread as real notifications",
          "Only verifying the reference number against Telebirr's system can confirm the payment",
        ],
      },
      {
        heading: "How to protect your business",
        body: "Never release goods based on an SMS alone. Always verify the transaction reference through cheki before accepting a payment. Train your staff to verify every Telebirr payment, especially during busy hours when it's tempting to skip verification.",
        bullets: [
          "Verify every transaction reference through cheki or the Telebirr app",
          "Do not trust SMS notifications alone, even if they look genuine",
          "Train delivery staff to verify before handing over goods",
          "Set up batch verification at end of day to catch any missed verifications",
          "Report SMS spoofing to Ethio Telecom and the cybercrime unit",
        ],
      },
    ],
    cta: { text: "Verify a Telebirr receipt now", href: "/?bank=telebirr" },
  },
  {
    slug: "edited-screenshot-receipt-fraud",
    title: "Edited Screenshot Receipt Fraud in Ethiopia | cheki",
    h1: "Edited Screenshot Receipt Fraud",
    metaDescription: "How fraudsters edit bank receipt screenshots to scam Ethiopian merchants. Learn how screenshot editing works, how to detect edited receipts, and how to verify any payment.",
    keywords: ["edited screenshot receipt", "fake receipt screenshot", "receipt fraud ethiopia", "edited bank receipt", "screenshot fraud detection"],
    intent: "informational",
    faq: [
      { q: "How easy is it to edit a receipt screenshot?", a: "Extremely easy. Any photo editing app on a phone can change the amount, reference number, or date on a receipt screenshot in under a minute. The edited screenshot looks identical to the original at a glance. This is one of the most common receipt fraud techniques in Ethiopia." },
      { q: "Can I detect an edited screenshot by looking at it?", a: "Sometimes, but not reliably. You might notice inconsistent fonts, misaligned text, or compression artifacts around edited areas. But a skilled editor can make changes that are invisible to the naked eye. The only reliable detection method is to verify the reference number against the bank's system." },
      { q: "Which apps are used to edit receipts?", a: "Common photo editing apps like Photoshop, Snapseed, or even the built-in phone photo editor can be used. Some fraudsters use specialized receipt generator apps that create fake receipts from scratch. None of these produce receipts that will verify against the bank's actual system." },
    ],
    sections: [
      {
        heading: "The screenshot editing problem",
        body: "Receipt screenshots are the most commonly shared payment proof in Ethiopia. Customers send screenshots via Telegram, WhatsApp, or SMS to prove they've made a payment. But screenshots are just images, and images can be edited. A fraudster takes a genuine receipt screenshot, changes the amount from 1,000 ETB to 10,000 ETB, and sends it to a merchant who then releases 10,000 ETB worth of goods for a 1,000 ETB payment.",
      },
      {
        heading: "Common editing techniques",
        body: "Fraudsters use several techniques to edit receipt screenshots:",
        bullets: [
          "Amount editing: changing the transferred amount to a higher value",
          "Reference number swapping: replacing the reference with one from a different, smaller transaction",
          "Date editing: changing an old receipt's date to make it look recent",
          "Name editing: changing the sender name to match the expected buyer",
          "Composite editing: combining elements from multiple real receipts into one fake",
        ],
      },
      {
        heading: "The solution: always verify the reference",
        body: "Screenshot fraud only works because merchants trust images. The fix is simple: always verify the transaction reference number through cheki before releasing goods. cheki fetches the receipt directly from the bank's public endpoint. If the reference number doesn't exist, or if the amount on the receipt doesn't match what the screenshot claims, you'll know immediately. This takes 2-10 seconds and costs nothing.",
      },
    ],
    cta: { text: "Verify a receipt now", href: "/" },
  },
  {
    slug: "old-receipt-reuse-fraud",
    title: "Old Receipt Reuse Fraud - Reusing Past Payments | cheki",
    h1: "Old Receipt Reuse Fraud",
    metaDescription: "How fraudsters reuse old, genuine bank receipts to claim they've made a new payment. Learn how old receipt fraud works and how to verify the transaction date.",
    keywords: ["old receipt fraud", "reused receipt ethiopia", "duplicate receipt fraud", "receipt reuse scam", "old payment receipt fraud"],
    intent: "informational",
    faq: [
      { q: "What is old receipt reuse fraud?", a: "A fraudster takes a genuine receipt from a past transaction (maybe weeks or months old) and presents it as proof of a new payment. The receipt is real and will verify against the bank's system, but the payment happened in the past, not today. The merchant releases goods for a payment that was already used for a previous purchase." },
      { q: "How do I detect an old receipt?", a: "Always check the transaction date when you verify a receipt. cheki returns the date as part of the verification result. If the date is from days, weeks, or months ago, the receipt is being reused. Only accept receipts with today's date." },
      { q: "Can someone reuse a receipt from the same day?", a: "Yes. A fraudster might make a genuine payment to you in the morning, get the receipt, then present the same receipt to a different staff member in the afternoon claiming it's a new payment. This is why you should track which reference numbers you've already accepted." },
    ],
    sections: [
      {
        heading: "How old receipt reuse works",
        body: "This is the hardest fraud to detect because the receipt is genuine. It exists in the bank's system, the amount is correct, and the sender name matches. The only thing wrong is the date. A fraudster made a real payment months ago, kept the receipt, and now presents it to a different merchant or a different staff member as proof of a new payment.",
      },
      {
        heading: "Why this fraud is dangerous",
        body: "Old receipt fraud bypasses naive verification. If you only check whether the receipt exists (verified=true) without checking the date, you'll accept it. This is why cheki always returns the transaction date as part of the result. You should always compare the date on the receipt to today's date.",
        bullets: [
          "The receipt is genuine and will verify against the bank's system",
          "Only the date reveals the fraud",
          "Fraudsters target businesses with high staff turnover or poor record-keeping",
          "The same receipt can be reused multiple times with different staff members",
        ],
      },
      {
        heading: "How to prevent old receipt fraud",
        body: "Always check the transaction date when verifying a receipt. cheki returns the date in the verification result. Implement a policy of only accepting receipts dated today. For high-value transactions, also log the reference number so you can detect if the same receipt is presented twice.",
        bullets: [
          "Check the date field in cheki's verification response",
          "Only accept receipts with today's date",
          "Log accepted reference numbers to detect duplicates",
          "Train staff to check dates, not just verification status",
          "Use the batch API at end of day to re-verify all accepted receipts",
        ],
      },
    ],
    cta: { text: "Verify a receipt now", href: "/" },
  },
  {
    slug: "reference-number-fraud-ethiopia",
    title: "Reference Number Fraud in Ethiopia - Fabricated Transaction IDs | cheki",
    h1: "Reference Number Fraud in Ethiopia",
    metaDescription: "How fraudsters fabricate Ethiopian bank reference numbers that look real but don't exist. Learn the format of CBE FT numbers, Telebirr IDs, and how to detect fakes.",
    keywords: ["reference number fraud", "fake ft number", "fabricated transaction id ethiopia", "cbe reference number fake", "telebirr reference fraud"],
    intent: "informational",
    faq: [
      { q: "Can someone guess a valid CBE FT reference number?", a: "It's very unlikely. CBE FT reference numbers follow a specific format (FT + date + sequence + code) but the sequence and code portions are not sequential. Guessing a valid reference that also matches a specific account number is computationally infeasible. However, fraudsters don't need to guess valid numbers; they just need numbers that look plausible enough to fool someone who doesn't verify." },
      { q: "What does a real CBE FT reference look like?", a: "A CBE FT reference starts with 'FT' followed by 10 alphanumeric characters. The format is roughly FT + YYMMDD + sequence + code. Example: FT26140P01YB. The key point is that fake numbers often have the right format but don't exist in CBE's system." },
      { q: "How do I know if a reference number is real?", a: "You can't tell by looking at it. A fake reference number can have the correct format and look completely genuine. The only way to know is to verify it against the bank's system using cheki. If the bank's endpoint returns no data for that reference, it doesn't exist." },
    ],
    sections: [
      {
        heading: "How reference number fraud works",
        body: "Ethiopian bank reference numbers follow predictable patterns. CBE references start with 'FT', Telebirr references are alphanumeric strings, BOA references have their own format. Fraudsters study these patterns and generate reference numbers that look real but don't correspond to any actual transaction. They then present these fake references to merchants, either verbally, via SMS, or on forged receipts.",
      },
      {
        heading: "Reference number formats by bank",
        body: "Each Ethiopian bank has a distinct reference number format. Knowing these formats helps you spot obviously fake references, but remember that a well-crafted fake will match the format perfectly:",
        bullets: [
          "CBE: FT + 10 alphanumeric chars (e.g. FT26140P01YB)",
          "Telebirr: alphanumeric string (e.g. DET8FJGUJ4)",
          "BOA: transaction reference + account suffix",
          "M-Pesa: transaction number (trxNo)",
          "Dashen: receipt ID at receipt.dashensuperapp.com",
        ],
      },
      {
        heading: "Why format checking isn't enough",
        body: "Checking whether a reference number matches the expected format is a good first step, but it's not sufficient. A fraudster can easily generate a reference that matches the format perfectly. For example, FT + today's date + random alphanumeric characters will pass a format check but won't exist in CBE's system. The only reliable check is to verify the reference against the bank's actual endpoint. cheki does this in 2-10 seconds for free.",
      },
    ],
    cta: { text: "Verify a receipt now", href: "/" },
  },
];

// ─── Category 7: Developer-focused pages ──────────────────────────

const developerPages: SeoPage[] = [
  {
    slug: "receipt-verification-sdk-typescript",
    title: "Ethiopian Receipt Verification TypeScript SDK | cheki",
    h1: "TypeScript SDK for Receipt Verification",
    metaDescription: "Free TypeScript SDK for verifying Ethiopian bank receipts. CBE, Telebirr, BOA, M-Pesa. No API key, no auth. Install with npm and verify receipts in 3 lines of code.",
    keywords: ["typescript receipt sdk", "ethiopian receipt sdk", "cheki typescript", "receipt verification npm", "bank receipt npm package"],
    intent: "transactional",
    faq: [
      { q: "How do I install the cheki TypeScript SDK?", a: "The SDK is included in the cheki monorepo on GitHub. Clone the repo and import the SDK from the /sdk/typescript directory. Alternatively, you can copy the single-file SDK into your project. No npm install needed; it's a lightweight fetch wrapper." },
      { q: "Can I use the SDK in the browser?", a: "Yes. The SDK uses the fetch API and works in both Node.js and the browser. However, browser-based calls to cheki's API are subject to CORS. For production use, we recommend calling the API from your backend." },
      { q: "Does the SDK handle errors?", a: "Yes. The SDK throws typed errors for common scenarios: receipt not found, geo-blocked endpoint, invalid reference format, and network errors. Each error has a code and message that you can use for user-facing error handling." },
    ],
    sections: [
      {
        heading: "SDK overview",
        body: "The cheki TypeScript SDK is a lightweight wrapper around the REST API. It provides typed methods for single verification, batch verification, bank listing, and health checking. The SDK is zero-dependency (uses native fetch) and works in both Node.js and browser environments.",
      },
      {
        heading: "Quick start",
        body: "Import the ChekiAPI class, create an instance with the base URL, and call verify with the bank code, reference, and optional account number. The SDK returns a typed response with all receipt fields. Error handling is done with try/catch.",
      },
      {
        heading: "Available methods",
        body: "The SDK exposes four methods matching the REST API endpoints:",
        bullets: [
          "verify(bank, reference, accountNumber?): verify a single receipt",
          "verifyUrl(url): verify by receipt URL (auto-detects bank)",
          "verifyBatch(receipts): verify up to 50 receipts in parallel",
          "listBanks(): get all supported banks with metadata",
          "healthCheck(): check endpoint status and latency",
        ],
      },
    ],
    cta: { text: "View SDK on GitHub", href: "https://github.com/1RB/cheki" },
  },
  {
    slug: "receipt-verification-python-library",
    title: "Ethiopian Receipt Verification Python Library | cheki",
    h1: "Python Library for Receipt Verification",
    metaDescription: "Free Python library for verifying Ethiopian bank receipts. CBE, Telebirr, BOA, M-Pesa. No API key, no auth. Install with pip and verify receipts in 3 lines of code.",
    keywords: ["python receipt verification", "ethiopian receipt python", "cheki python", "receipt verification pip", "bank receipt python library"],
    intent: "transactional",
    faq: [
      { q: "How do I install the cheki Python library?", a: "Install it with pip install cheki. It uses the requests library for HTTP calls." },
      { q: "Does the Python library support PDF parsing?", a: "Yes. The Python library includes PDF text extraction for CBE receipts using pdfminer.six or unpdf. It handles the full pipeline: fetch the PDF from CBE's endpoint, extract text, parse fields, and return structured data." },
      { q: "Can I use the Python library without the API?", a: "Yes. The Python library can fetch receipts directly from bank endpoints without going through cheki's API. This is useful for self-hosting or for running verification on an Ethiopian server to bypass geo-blocking." },
    ],
    sections: [
      {
        heading: "Python library overview",
        body: "The cheki Python library provides a clean Pythonic interface for verifying Ethiopian bank receipts. It supports direct endpoint access (bypassing the API), PDF parsing for CBE, JSON parsing for BOA and M-Pesa, and HTML parsing for Telebirr.",
      },
      {
        heading: "Quick start",
        body: "Install the library from the cheki monorepo, import the ChekiAPI class, and call verify with the bank code and reference number. The library returns a Python dict with all receipt fields. For direct endpoint access (without the API), use the DirectVerifier class.",
      },
      {
        heading: "Direct verification vs API verification",
        body: "The library supports two modes:",
        bullets: [
          "API mode: calls cheki's REST API (requires internet access to chekiapp.vercel.app)",
          "Direct mode: fetches receipts directly from bank endpoints (bypasses cheki's API)",
          "Direct mode is useful for self-hosting on an Ethiopian IP to bypass geo-blocking",
          "Both modes return the same structured data format",
        ],
      },
    ],
    cta: { text: "View library on GitHub", href: "https://github.com/1RB/cheki/tree/main/python" },
  },
  {
    slug: "receipt-verification-for-business",
    title: "Receipt Verification for Ethiopian Businesses | cheki",
    h1: "Receipt Verification for Your Business",
    metaDescription: "How Ethiopian businesses can verify bank receipts for free. Integration guides for e-commerce, delivery services, retail, and accounting. No API key, no signup, no limits.",
    keywords: ["receipt verification business", "payment verification ethiopia business", "merchant receipt check", "ecommerce receipt verification", "delivery payment verification"],
    intent: "commercial",
    faq: [
      { q: "How much does cheki cost for businesses?", a: "Nothing. cheki is 100% free for businesses of any size. No per-verification fee, no monthly subscription, no API key. You can verify unlimited receipts. check.et charges 499 ETB/month after 200 verifications. cheki has no such limit." },
      { q: "Can I integrate cheki into my POS system?", a: "Yes. cheki provides a REST API and SDKs for TypeScript and Python. You can integrate receipt verification into any POS, e-commerce, or accounting system. The API requires no authentication, so integration takes minutes, not days." },
      { q: "What about batch verification for end-of-day reconciliation?", a: "Use POST /api/verify/batch to verify up to 50 receipts in a single API call. This is designed for end-of-day reconciliation: submit all the day's receipts, get results in seconds, and match them against your orders." },
    ],
    sections: [
      {
        heading: "Why businesses need receipt verification",
        body: "Payment fraud costs Ethiopian businesses millions of birr every year. Fake receipts, edited screenshots, and old receipt reuse are the most common fraud techniques. Retail shops, e-commerce stores, delivery services, and wholesale businesses all need to verify receipts before releasing goods.",
      },
      {
        heading: "Integration options",
        body: "cheki offers multiple integration paths depending on your technical resources:",
        bullets: [
          "Web UI: send staff to chekiapp.vercel.app for manual verification (no integration needed)",
          "REST API: POST /api/verify from your backend for automated verification",
          "Batch API: POST /api/verify/batch for bulk end-of-day reconciliation",
          "TypeScript SDK: import into your Node.js or frontend project",
          "Python library: integrate into Django, Flask, or scripts",
          "Self-hosting: run cheki on your own server with Docker",
        ],
      },
      {
        heading: "Industry-specific use cases",
        body: "Different businesses use cheki in different ways:",
        bullets: [
          "E-commerce: verify each order payment before shipping",
          "Delivery services: verify COD payments at point of delivery",
          "Retail: verify in-store transfers before releasing goods",
          "Wholesale: verify large transfer amounts before dispatching",
          "Accounting: batch-verify daily receipts for reconciliation",
          "Marketplaces: verify peer-to-peer payments between buyers and sellers",
        ],
      },
    ],
    cta: { text: "Start verifying receipts", href: "/" },
  },
];

// ─── Combine all generated pages ──────────────────────────────────

export const generatedSeoPages: SeoPage[] = [
  ...bankVerificationPages,
  ...checkPaymentPages,
  ...fakeReceiptPages,
  ...receiptFormatPages,
  ...apiEndpointPages,
  ...fraudScenarioPages,
  ...developerPages,
];
