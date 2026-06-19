/**
 * Programmatic SEO pages - search-intent matching.
 *
 * Each page targets a specific search query that Ethiopian merchants,
 * business owners, and developers actually search for.
 *
 * Categories:
 *   1. "verify [bank] receipt" - per-bank verification guides
 *   2. "check [bank] payment" - payment checking pages
 *   3. "is [bank] receipt real" - fraud prevention pages
 *   4. "free receipt verification ethiopia" - comparison pages
 *   5. "[bank] receipt format" - technical reference pages
 */

export interface SeoPage {
  slug: string;
  title: string;
  h1: string;
  metaDescription: string;
  keywords: string[];
  intent: "informational" | "transactional" | "navigational" | "commercial";
  bankCode?: string;
  faq: { q: string; a: string }[];
  sections: {
    heading: string;
    body: string;
    bullets?: string[];
  }[];
  cta: { text: string; href: string };
}

export const seoPages: SeoPage[] = [
  // ── CBE ──────────────────────────────────────────────────────────
  {
    slug: "verify-cbe-receipt-online",
    title: "Verify CBE Receipt Online - Free & Instant | cheki",
    h1: "Verify a Commercial Bank of Ethiopia Receipt Online",
    metaDescription: "Check if a CBE receipt is real or fake. Free, instant, no signup. Paste your FT reference number and account to verify any CBE payment in seconds.",
    keywords: ["verify cbe receipt", "check cbe payment", "cbe receipt verification", "cbe ft reference check", "commercial bank ethiopia receipt online"],
    intent: "transactional",
    bankCode: "cbe",
    faq: [
      { q: "How do I verify a CBE receipt?", a: "Select Commercial Bank of Ethiopia, paste your FT reference number (e.g. FT26140P01YB), enter the last 8 digits of the receiving account, and click Verify. cheki fetches the receipt from CBE's public endpoint and shows you the result in 2-10 seconds." },
      { q: "Do I need the account number to verify CBE?", a: "Yes. CBE's receipt endpoint requires the FT reference plus the last 8 digits of the receiving account number. Without the account number, the endpoint returns no data." },
      { q: "Is CBE receipt verification free?", a: "Yes, cheki is completely free with no limits. check.et charges 499 ETB/month after 200 verifications. cheki uses the same public CBE endpoint but charges nothing." },
      { q: "Can I verify CBE receipts in bulk?", a: "Yes. Use the POST /api/verify/batch endpoint to verify up to 50 CBE receipts in a single API call. Perfect for end-of-day reconciliation." },
    ],
    sections: [
      {
        heading: "How CBE receipt verification works",
        body: "The Commercial Bank of Ethiopia publishes every transaction receipt at a public URL: https://apps.cbe.com.et:100/?id={FT_REFERENCE}{ACCOUNT_SUFFIX}. No authentication is required. cheki fetches this URL, downloads the PDF, extracts the text, and parses it into structured JSON with sender name, receiver name, amount, date, branch, and reference number.",
      },
      {
        heading: "What you need to verify a CBE receipt",
        body: "To verify a CBE receipt, you need two pieces of information:",
        bullets: [
          "FT reference number (e.g. FT26140P01YB) - found on the receipt or in the CBE mobile app transaction details",
          "Last 8 digits of the receiving account number (e.g. 60536171) - the account that received the payment",
        ],
      },
      {
        heading: "CBE's new QR code receipt system",
        body: "CBE recently launched a new receipt sharing system at mbreciept.cbe.com.et. Receipts shared through this system have short URLs and QR codes instead of FT reference numbers. cheki supports both systems. If you paste a mbreciept.cbe.com.et URL, cheki automatically detects it and uses the new API.",
      },
      {
        heading: "How to spot a fake CBE receipt",
        body: "Fake CBE receipts are a growing problem in Ethiopia. A fake receipt may have a real-looking FT reference number but will not appear in CBE's system. Always verify through cheki or the official CBE app. If cheki returns 'Receipt not found', the receipt is likely fake.",
        bullets: [
          "Check that the sender name matches who claimed to send the payment",
          "Verify the amount matches what was agreed",
          "Confirm the date is recent (not an old receipt being reused)",
          "Check the reference number format (FT + date + sequence + code)",
        ],
      },
    ],
    cta: { text: "Verify a CBE receipt now", href: "/?bank=cbe" },
  },

  // ── Telebirr ─────────────────────────────────────────────────────
  {
    slug: "verify-telebirr-receipt-online",
    title: "Verify Telebirr Receipt Online - Free & Instant | cheki",
    h1: "Verify a Telebirr Receipt Online",
    metaDescription: "Check if a Telebirr receipt is real or fake. Free, instant, no signup. Paste your transaction ID to verify any Telebirr payment in seconds.",
    keywords: ["verify telebirr receipt", "check telebirr payment", "telebirr receipt verification", "telebirr transaction check", "ethio telecom receipt online"],
    intent: "transactional",
    bankCode: "telebirr",
    faq: [
      { q: "How do I verify a Telebirr receipt?", a: "Select Telebirr, paste your transaction reference number, and click Verify. cheki fetches the receipt from Telebirr's public endpoint and shows you the result instantly." },
      { q: "Why does Telebirr verification sometimes fail?", a: "Telebirr's endpoint (transactioninfo.ethiotelecom.et) blocks requests from non-Ethiopian IP addresses. If cheki's server can't reach it, we provide a direct link for you to open the receipt yourself. Self-hosting cheki on an Ethiopian IP bypasses this restriction." },
      { q: "Do I need an account number for Telebirr?", a: "No. Telebirr only requires the transaction reference number. The receipt is returned as an HTML page with payer name, receiver name, amount, and date." },
      { q: "Is Telebirr receipt verification free?", a: "Yes. cheki verifies Telebirr receipts for free with no limits. The same endpoint is used by check.et which charges 499 ETB/month after 200 checks." },
    ],
    sections: [
      {
        heading: "How Telebirr receipt verification works",
        body: "Telebirr (Ethio Telecom's mobile wallet) publishes transaction receipts at https://transactioninfo.ethiotelecom.et/receipt/{REFERENCE}. The page is an HTML receipt showing payer name, receiver name, amount in Birr, and transaction date. cheki fetches this URL and parses the HTML into structured JSON.",
      },
      {
        heading: "Telebirr geo-blocking",
        body: "Telebirr's receipt endpoint blocks requests from IP addresses outside Ethiopia. If you're using cheki from outside Ethiopia, the verification may fail. In that case, cheki provides a direct link to open the receipt in your browser. For reliable verification, self-host cheki on a server with an Ethiopian IP address.",
      },
      {
        heading: "How to spot a fake Telebirr receipt",
        body: "Fake Telebirr receipts often use fabricated transaction IDs that don't exist in Telebirr's system. Always verify the receipt through cheki before accepting a payment. If cheki returns 'Receipt not found', the transaction ID is invalid.",
        bullets: [
          "Verify the transaction ID exists in Telebirr's system",
          "Check that the payer name matches the expected sender",
          "Confirm the amount is correct",
          "Be suspicious of screenshots - they can be edited",
        ],
      },
    ],
    cta: { text: "Verify a Telebirr receipt now", href: "/?bank=telebirr" },
  },

  // ── BOA ──────────────────────────────────────────────────────────
  {
    slug: "verify-boa-receipt-online",
    title: "Verify Bank of Abyssinia Receipt Online - Free | cheki",
    h1: "Verify a Bank of Abyssinia Receipt Online",
    metaDescription: "Check if a BOA receipt is real or fake. Free, instant, no signup. Paste your transaction reference and account, or scan and paste the QR payload for inter-bank transfers.",
    keywords: ["verify boa receipt", "bank of abyssinia receipt check", "boa payment verification", "abyssinia bank receipt online", "boa transaction reference", "boa qr code receipt", "verify boa transfer to cbe"],
    intent: "transactional",
    bankCode: "boa",
    faq: [
      { q: "How do I verify a Bank of Abyssinia receipt?", a: "Select Bank of Abyssinia, paste your transaction reference number, enter the last 5 digits of the receiving account, and click Verify. cheki fetches the receipt from BOA's public API and returns structured JSON." },
      { q: "Do I need an account number for BOA?", a: "For normal API lookup, yes. BOA requires the transaction reference plus the last 5 digits of the receiving account number. For inter-bank transfers, you can use the QR code payload instead." },
      { q: "Does BOA use an API or PDF?", a: "Bank of Abyssinia uses a JSON API at cs.bankofabyssinia.com. This is faster than CBE's PDF system and returns structured data directly, making it more reliable for automated verification." },
      { q: "What if BOA's API returns 'Invalid reference number'?", a: "Inter-bank transfers (e.g., FT... references sent to CBE) are not exposed in BOA's API. In that case, scan the QR code on the receipt and paste the payload into cheki. cheki decrypts it with the key embedded in BOA's public receipt web app." },
    ],
    sections: [
      {
        heading: "How BOA receipt verification works",
        body: "Bank of Abyssinia publishes transaction receipts via a JSON API at https://cs.bankofabyssinia.com/api/onlineSlip/getDetails/?id={REFERENCE}{ACCOUNT_SUFFIX}. The response is a JSON object with structured fields: source account name, receiver name, transferred amount, transaction date, and reference number. No PDF parsing needed.",
      },
      {
        heading: "QR code verification for inter-bank transfers",
        body: "BOA's JSON API does not recognize inter-bank transfer references. However, the QR code on the receipt is an AES-256-CBC encrypted payload that contains the full transaction details. cheki decrypts it server-side using the key exposed in BOA's receipt web app, so you can verify transfers to CBE and other banks even when the API fails. See our BOA QR code deep dive for the full technical breakdown.",
      },
      {
        heading: "What you need to verify a BOA receipt",
        body: "To verify a Bank of Abyssinia receipt, you need one of:",
        bullets: [
          "Transaction reference number + last 5 digits of the receiving account (for same-bank transfers)",
          "QR code payload from the receipt (for inter-bank transfers)",
        ],
      },
    ],
    cta: { text: "Verify a BOA receipt now", href: "/?bank=boa" },
  },

  // ── M-Pesa ───────────────────────────────────────────────────────
  {
    slug: "verify-mpesa-receipt-online",
    title: "Verify M-Pesa Ethiopia Receipt Online - Free | cheki",
    h1: "Verify an M-Pesa Ethiopia Receipt Online",
    metaDescription: "Check if an M-Pesa Ethiopia receipt is real or fake. Free, instant, no signup. Paste your transaction number to verify any M-Pesa payment.",
    keywords: ["verify mpesa receipt ethiopia", "mpesa receipt check", "safaricom ethiopia receipt verification", "mpesa transaction verify", "mpesa receipt online"],
    intent: "transactional",
    bankCode: "mpesa",
    faq: [
      { q: "How do I verify an M-Pesa Ethiopia receipt?", a: "Select M-Pesa Ethiopia, paste your transaction number, and click Verify. cheki fetches the receipt from Safaricom's API and returns the result." },
      { q: "Why does M-Pesa verification sometimes fail?", a: "M-Pesa's endpoint (m-pesabusiness.safaricom.et) blocks requests from non-Kenyan/Ethiopian IPs. cheki attempts to bypass this with direct IP connections, but if it fails, we provide a fallback link." },
      { q: "Do I need an account number for M-Pesa?", a: "No. M-Pesa only requires the transaction number (trxNo). The API returns sender name, receiver name, amount, and currency." },
    ],
    sections: [
      {
        heading: "How M-Pesa receipt verification works",
        body: "M-Pesa Ethiopia (operated by Safaricom) publishes transaction receipts via a JSON API at https://m-pesabusiness.safaricom.et/api/receipt/getReceipt?trxNo={TRANSACTION_ID}. The response includes sender name, receiver name, amount, currency, and transaction date.",
      },
      {
        heading: "M-Pesa geo-blocking",
        body: "Like Telebirr, M-Pesa's endpoint restricts access to Ethiopian and Kenyan IP addresses. cheki uses direct IP connections and X-Forwarded-For headers as a workaround. For reliable verification, self-host cheki on an Ethiopian server.",
      },
    ],
    cta: { text: "Verify an M-Pesa receipt now", href: "/?bank=mpesa" },
  },

  // ── General search intent pages ──────────────────────────────────
  {
    slug: "free-receipt-verification-ethiopia",
    title: "Free Receipt Verification Ethiopia - No API Key, No Signup | cheki",
    h1: "Free Ethiopian Receipt Verification",
    metaDescription: "Verify any Ethiopian bank or mobile wallet receipt for free. CBE, Telebirr, BOA, M-Pesa, Dashen, Awash, and more. No API key, no signup, no limits.",
    keywords: ["free receipt verification ethiopia", "ethiopian receipt check free", "verify payment ethiopia", "receipt verification addis ababa", "bank receipt check ethiopia"],
    intent: "commercial",
    faq: [
      { q: "Is receipt verification really free?", a: "Yes. cheki is 100% free with no limits. No signup, no API key, no credit card. You can verify unlimited receipts. check.et charges 499 ETB/month after 200 verifications. verify.et charges $20-40/month." },
      { q: "Which banks are supported?", a: "cheki supports 10 banks and wallets: CBE, CBE Birr, Telebirr, Bank of Abyssinia, M-Pesa, Dashen Bank, Awash Bank, Zemen Bank, Siinqee Bank, and CBE Birr. All use public endpoints published by the banks themselves." },
      { q: "How is this different from check.et?", a: "check.et charges 499 ETB/month for the same data. cheki uses the exact same bank endpoints but is free and open source. check.et also requires a business account and API key. cheki requires nothing." },
      { q: "Can I use this for my business?", a: "Yes. cheki is MIT licensed. You can use the API, self-host with Docker, or integrate the TypeScript/Python SDK into your existing systems. No restrictions." },
    ],
    sections: [
      {
        heading: "Why receipt verification matters in Ethiopia",
        body: "Payment fraud is a growing problem in Ethiopia. Fake receipts with fabricated reference numbers are used to scam merchants and businesses. With the rise of mobile banking (CBE Birr, Telebirr, M-Pesa), verifying receipts manually is no longer practical. cheki automates the process by fetching receipts directly from bank endpoints.",
      },
      {
        heading: "How free receipt verification works",
        body: "Every Ethiopian bank and mobile wallet publishes transaction receipts at publicly accessible URLs. These URLs require no authentication. This is by design: banks want merchants to be able to verify payments. cheki simply fetches these URLs, parses the response, and returns clean JSON.",
        bullets: [
          "CBE: PDF receipt from apps.cbe.com.et:100",
          "Telebirr: HTML receipt from transactioninfo.ethiotelecom.et",
          "BOA: JSON from cs.bankofabyssinia.com",
          "M-Pesa: JSON from m-pesabusiness.safaricom.et",
          "All endpoints are public and require no authentication",
        ],
      },
      {
        heading: "cheki vs paid alternatives",
        body: "check.et and verify.et charge for access to the same public bank endpoints. check.et costs 499 ETB/month or 4,990 ETB/year after 200 free verifications. verify.et charges $20-40/month. Both require signup and API keys. cheki does the same thing for free, with no signup, and is open source under MIT license.",
      },
    ],
    cta: { text: "Start verifying receipts", href: "/" },
  },

  {
    slug: "how-to-check-fake-receipt-ethiopia",
    title: "How to Check if a Receipt is Fake in Ethiopia - Guide | cheki",
    h1: "How to Check if a Receipt is Fake",
    metaDescription: "Complete guide to detecting fake Ethiopian bank receipts. Learn how fraudsters forge CBE, Telebirr, and M-Pesa receipts and how to verify any payment instantly.",
    keywords: ["fake receipt ethiopia", "how to check fake receipt", "payment fraud ethiopia", "fake cbe receipt", "fake telebirr receipt", "receipt fraud detection"],
    intent: "informational",
    faq: [
      { q: "How common is receipt fraud in Ethiopia?", a: "Receipt fraud is increasingly common as mobile banking grows. Fraudsters create fake screenshots or forged PDFs that look identical to real receipts. The only reliable way to detect them is to verify the receipt directly with the bank's endpoint." },
      { q: "Can screenshots be fake?", a: "Yes. Screenshots can be edited in any photo editing app. A fake screenshot may show a real-looking reference number, amount, and sender name, but the transaction doesn't exist in the bank's system. Always verify through cheki or the bank's official app." },
      { q: "What should I do if a receipt is fake?", a: "Do not release goods or services. Contact the sender and ask them to send the payment again. If you suspect fraud, report it to the bank and to the Ethiopian police cybercrime unit." },
    ],
    sections: [
      {
        heading: "Common receipt fraud techniques",
        body: "Fraudsters in Ethiopia use several techniques to create fake receipts:",
        bullets: [
          "Edited screenshots: taking a real receipt screenshot and changing the amount or reference number",
          "Forged PDFs: creating a PDF that looks like a CBE receipt but has a fake reference number",
          "Old receipts: reusing a genuine receipt from a past transaction",
          "Reference number guessing: generating plausible-looking FT numbers that don't exist",
          "SMS spoofing: sending fake SMS notifications that look like bank confirmations",
        ],
      },
      {
        heading: "How to verify any receipt instantly",
        body: "The only reliable way to check if a receipt is fake is to verify it against the bank's own system. Every Ethiopian bank publishes receipts at public URLs. cheki automates this process: paste the reference number, and cheki fetches the receipt from the bank in seconds. If the receipt doesn't exist in the bank's system, it's fake.",
      },
      {
        heading: "Red flags to watch for",
        body: "Even before verifying, these signs suggest a receipt may be fake:",
        bullets: [
          "The sender pressures you to release goods immediately before verification",
          "The reference number doesn't match the bank's format (CBE starts with FT, Telebirr is alphanumeric)",
          "The receipt shows a different amount than what was agreed",
          "The date on the receipt is from days or weeks ago",
          "The receipt is a low-quality screenshot that's hard to read",
        ],
      },
    ],
    cta: { text: "Verify a receipt now", href: "/" },
  },

  {
    slug: "ethiopian-bank-receipt-formats",
    title: "Ethiopian Bank Receipt Formats: Complete Reference | cheki",
    h1: "Ethiopian Bank Receipt Formats",
    metaDescription: "Complete technical reference for Ethiopian bank receipt formats. CBE PDF, Telebirr HTML, BOA JSON, M-Pesa JSON. Endpoint URLs, response structures, and field mappings.",
    keywords: ["ethiopian bank receipt format", "cbe receipt format", "telebirr receipt format", "boa receipt json", "ethiopian payment receipt structure"],
    intent: "informational",
    faq: [
      { q: "What format does CBE use for receipts?", a: "CBE uses PDF receipts downloaded from apps.cbe.com.et:100. The URL format is: https://apps.cbe.com.et:100/?id={FT_REFERENCE}{ACCOUNT_SUFFIX}. The PDF contains payer name, receiver name, accounts, amount, date, reference, and branch." },
      { q: "What format does Telebirr use?", a: "Telebirr uses HTML receipts from transactioninfo.ethiotelecom.et. The URL format is: https://transactioninfo.ethiotelecom.et/receipt/{REFERENCE}. The HTML page contains payer name, receiver name, amount in Birr, and date." },
      { q: "What format does Bank of Abyssinia use?", a: "BOA uses a JSON API at cs.bankofabyssinia.com. The URL format is: https://cs.bankofabyssinia.com/api/onlineSlip/getDetails/?id={REFERENCE}{ACCOUNT_SUFFIX}. Returns structured JSON with all fields." },
    ],
    sections: [
      {
        heading: "CBE receipt format",
        body: "CBE (Commercial Bank of Ethiopia) publishes receipts as PDF files. The endpoint is https://apps.cbe.com.et:100/?id={FT_REFERENCE}{ACCOUNT_SUFFIX} where FT_REFERENCE is the transaction reference (e.g. FT26140P01YB) and ACCOUNT_SUFFIX is the last 8 digits of the receiving account. The PDF contains: Commercial Bank of Ethiopia header, payer name, payer account, receiver name, receiver account, transferred amount (ETB), payment date and time, reference number (VAT invoice no), branch name, and reason/type of service.",
      },
      {
        heading: "Telebirr receipt format",
        body: "Telebirr (Ethio Telecom) publishes receipts as HTML pages. The endpoint is https://transactioninfo.ethiotelecom.et/receipt/{REFERENCE}. The HTML page contains: telebirr receipt header, payer name, payer telebirr number, credited party name, credited party account number, amount in Birr, and transaction date/time. The page is bilingual (English and Amharic).",
      },
      {
        heading: "Bank of Abyssinia receipt format",
        body: "BOA publishes receipts as JSON via a REST API. The endpoint is https://cs.bankofabyssinia.com/api/onlineSlip/getDetails/?id={REFERENCE}{ACCOUNT_SUFFIX}. The JSON response contains a body array with: Source Account Name, Source Account, Receiver's Name, Receiver's Account, Transferred Amount, currency, Transaction Date, and Transaction Reference.",
      },
      {
        heading: "M-Pesa receipt format",
        body: "M-Pesa Ethiopia (Safaricom) publishes receipts as JSON. The endpoint is https://m-pesabusiness.safaricom.et/api/receipt/getReceipt?trxNo={TRANSACTION_ID}. The JSON response contains: senderName, receiverName, amount, currency, transactionDate, and transactionId.",
      },
    ],
    cta: { text: "Try the API", href: "/docs" },
  },

  {
    slug: "cheki-vs-check-et-vs-verify-et",
    title: "cheki vs check.et vs verify.et vs qbirr vs tinaverify | cheki",
    h1: "cheki vs the competition",
    metaDescription: "Detailed comparison of Ethiopia's six receipt verification services. Price, features, banks, API, open source. cheki is free, the rest charge 500-8,000 ETB/month.",
    keywords: ["cheki vs check.et", "check.et alternative", "verify.et alternative", "qbirr alternative", "tinaverify comparison", "free receipt verification ethiopia", "best receipt verification service"],
    intent: "commercial",
    faq: [
      { q: "Is cheki really free?", a: "Yes. cheki is 100% free, open source (MIT), and has no limits. check.et charges 499 ETB/month after 200 verifications. verify.et charges $20-40/month. qbirr charges 500-8,000 ETB/month. tinaverify charges 3K-8K ETB per 90 days." },
      { q: "Do they all use the same data?", a: "Yes. All six services (cheki, check.et, verify.et, qbirr, tinaverify, tally) verify receipts by fetching the same public bank endpoints. The data is identical. The difference is pricing, features, and transparency." },
      { q: "Can I self-host check.et, verify.et, qbirr, or tinaverify?", a: "No. All of them are closed-source. cheki is the only one that is open source and includes Docker support for self-hosting on your own infrastructure." },
      { q: "What about qbirr and tinaverify?", a: "qbirr is a developer-first API launched June 2026 with 7 banks and an Ethiopian relay for geo-blocked banks. tinaverify is a mobile-first product with published iOS and Android apps focused on the cashier workflow. Both charge for the same public data that cheki provides for free." },
    ],
    sections: [
      {
        heading: "The core difference",
        body: "All six services do the same thing: they fetch receipts from public bank endpoints and return the data. The difference is that cheki is free and open source, while the others charge you for the same data.",
      },
      {
        heading: "Pricing at a glance",
        body: "",
        bullets: [
          "cheki: free forever, unlimited verifications",
          "check.et: 499 ETB/mo (200 free one-time)",
          "verify.et: $20-40/mo USD (200 free one-time)",
          "qbirr: 500-8,000 ETB/mo (50 free/month)",
          "tinaverify: 3K-8K ETB per 90 days (credit-based, no free tier)",
          "tally: pricing not public",
        ],
      },
      {
        heading: "What only cheki offers",
        body: "",
        bullets: [
          "Open source (MIT license)",
          "Self-hosting with Docker",
          "No signup, no API key",
          "Batch verification (50 at once)",
          "BOA QR code AES decryption",
          "Receipt source URL shown to user",
        ],
      },
    ],
    cta: { text: "Full comparison table", href: "/compare" },
  },

  {
    slug: "ethiopian-receipt-api-free",
    title: "Free Ethiopian Receipt API - No Auth, No Limits | cheki",
    h1: "Free Ethiopian Receipt Verification API",
    metaDescription: "Free REST API for verifying Ethiopian bank receipts. No API key, no signup, no rate limit. CBE, Telebirr, BOA, M-Pesa. TypeScript SDK and Python library included.",
    keywords: ["ethiopian receipt api", "free receipt api ethiopia", "cbe api", "telebirr api", "bank verification api ethiopia", "receipt verification rest api"],
    intent: "transactional",
    faq: [
      { q: "Do I need an API key?", a: "No. cheki's API requires no authentication. Just POST to /api/verify with the bank code, reference, and account number." },
      { q: "Is there a rate limit?", a: "No. cheki has no rate limits. You can verify as many receipts as you want. For batch verification, use POST /api/verify/batch to verify up to 50 receipts at once." },
      { q: "Is there a TypeScript SDK?", a: "Yes. cheki includes a TypeScript SDK that you can import and use in any Node.js or browser project. There's also a Python library and a CLI tool." },
    ],
    sections: [
      {
        heading: "API overview",
        body: "cheki provides a free REST API for verifying Ethiopian bank receipts. No API key, no signup, no rate limit. The API supports single verification, batch verification (up to 50 at once), bank listing, and health checking.",
      },
      {
        heading: "Quick start",
        body: "POST to https://cheki-pi.vercel.app/api/verify with a JSON body containing the bank code, reference number, and (for CBE/BOA) the account number. The response includes sender name, receiver name, amount, date, and the source URL from the bank.",
      },
      {
        heading: "Available endpoints",
        body: "",
        bullets: [
          "POST /api/verify - verify a single receipt",
          "POST /api/verify/batch - verify up to 50 receipts in parallel",
          "GET /api/banks - list all supported banks",
          "GET /api/health - check endpoint health and latency",
          "GET /api/receipt - download the original receipt file",
        ],
      },
    ],
    cta: { text: "Read the API docs", href: "/docs" },
  },
];

export function getSeoPage(slug: string): SeoPage | undefined {
  return allSeoPages.find((p) => p.slug === slug);
}

export function getRelatedSeoPages(slug: string, limit = 3): SeoPage[] {
  const current = getSeoPage(slug);
  if (!current) return allSeoPages.slice(0, limit);
  // Return pages with the same bankCode or same intent, excluding current
  return allSeoPages
    .filter((p) => p.slug !== slug)
    .sort((a, b) => {
      const aScore = (a.bankCode === current.bankCode ? 2 : 0) + (a.intent === current.intent ? 1 : 0);
      const bScore = (b.bankCode === current.bankCode ? 2 : 0) + (b.intent === current.intent ? 1 : 0);
      return bScore - aScore;
    })
    .slice(0, limit);
}

// Import and combine generated pages
import { generatedSeoPages } from "./seo-pages-generated";

export const allSeoPages: SeoPage[] = [...seoPages, ...generatedSeoPages];
