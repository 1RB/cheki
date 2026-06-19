// Block-based content system for guides and blog posts
// Supports rich formatting: text, lists, code, callouts, tables, quotes, steps

export type ContentBlock =
  | { type: "heading"; text: string }
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
  date: string;
  readTime: string;
  content: ContentBlock[];
  seo: {
    title: string;
    description: string;
    keywords: string[];
  };
  faq?: { q: string; a: string }[];
  related?: string[];
}

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
    readTime: "4 min",
    content: [
      { type: "text", text: "Commercial Bank of Ethiopia recently launched a new receipt sharing system. When you complete a transfer in the CBE mobile app, you can now share a short link like https://mbreciept.cbe.com.et/fHCxyV4mg5pRIwEkJO. The recipient opens this link and sees the full receipt in their browser, no app required." },
      { type: "text", text: "This is a significant upgrade from the old system, which required the FT reference number and the last 8 digits of the receiving account to construct a receipt URL. The new system uses a single short ID and returns clean JSON data instead of a PDF." },

      { type: "heading", text: "What the QR code contains" },
      { type: "text", text: "The QR code on a CBE receipt encodes a URL in this format:" },
      { type: "code", code: "https://mbreciept.cbe.com.et/{SHORT_ID}" },
      { type: "text", text: "The short ID is a random string like fHCxyV4mg5pRIwEkJO. It maps to a single transaction on CBE's backend. When you scan the QR code, you get this URL, which you can paste into cheki's URL input mode to verify instantly." },

      { type: "callout", variant: "tip", title: "Try it now", text: "Open chekiapp.vercel.app, switch to the 'Receipt URL' tab, and paste any mbreciept.cbe.com.et link. cheki calls CBE's JSON API and returns the full transaction data in under 2 seconds." },

      { type: "heading", text: "The API behind the receipts" },
      { type: "text", text: "The mbreciept.cbe.com.et page is a Nuxt.js single-page app. When it loads, it calls a JSON API at a different domain:" },
      { type: "code", lang: "http", code: "GET https://Mb.cbe.com.et/api/v1/transactions/public/transaction-detail/{SHORT_ID}\n\nHeaders:\n  X-App-ID: d1292e42-7400-49de-a2d3-9731caa4c819\n  X-App-Version: 0a01980b-9859-1369-8198-59f403820000" },
      { type: "text", text: "The response is structured JSON with all the transaction details:" },
      { type: "code", lang: "json", code: '{\n  "id": "FT2614977L8S",\n  "transactionType": "ACNX",\n  "debitAccountNo": "1********8348",\n  "creditAccountNo": "1********6171",\n  "amountCredited": "1300.00",\n  "creditCurrency": "ETB",\n  "dateTimes": ["2026-05-29T08:30:00Z"],\n  "debitAccountHolder": "Raeed Ansar Yusuf",\n  "creditAccountHolder": "Sami Adil Zekaria",\n  "paymentDetails": ["football 1mo and extratime"]\n}' },
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

      { type: "callout", variant: "info", title: "Backward compatible", text: "cheki supports both the old and new CBE systems. The old endpoint (apps.cbe.com.et:100) still works for receipts that use the FT reference + account format. The new endpoint (mbreciept.cbe.com.et) is used automatically when you paste a URL." },

      { type: "heading", text: "How to scan a CBE QR code with cheki" },
      {
        type: "steps",
        items: [
          { title: "Open chekiapp.vercel.app on your phone", text: "The QR scanner uses your phone's camera, so mobile works best." },
          { title: "Tap the camera icon", text: "It's in the top-right of the verify form, next to the QR icon. Allow camera access when prompted." },
          { title: "Point at the QR code", text: "Hold your phone over the QR code on the receipt. A scan box overlay shows where to aim." },
          { title: "Automatic verification", text: "Once the QR code is detected, the URL is extracted and verification happens automatically. The result appears in under 2 seconds." },
        ],
      },

      { type: "heading", text: "Privacy and security" },
      { type: "text", text: "The new CBE receipt system masks account numbers in the API response. Instead of showing the full account number, it returns a masked version like 1********8348. This is better for privacy than the old PDF system, which included full account numbers in the document text." },
      { type: "text", text: "The short ID in the URL is random and not guessable, which prevents receipt enumeration. You can only access a receipt if someone shares the link with you." },
      { type: "callout", variant: "warning", title: "X-App-ID headers", text: "The new CBE API requires hardcoded X-App-ID and X-App-Version headers. These are embedded in the mbreciept.cbe.com.et JavaScript bundle. If CBE rotates these headers, cheki will need to update them. The old PDF endpoint has no such requirement." },
    ],
    faq: [
      { q: "Can I still use the old CBE receipt system with FT reference and account number?", a: "Yes. cheki supports both systems. Select CBE from the bank dropdown and enter the FT reference + account digits to use the old PDF endpoint. Or paste a mbreciept.cbe.com.et URL to use the new JSON API." },
      { q: "Do I need the CBE app to scan QR codes?", a: "No. cheki has a built-in QR scanner that uses your phone's camera. Open chekiapp.vercel.app, tap the camera icon, and point at the QR code on the receipt." },
      { q: "What if the CBE receipt link doesn't work?", a: "The mbreciept.cbe.com.et service may occasionally be down. If the link returns a 502 or timeout, try again later. You can also use the old system with the FT reference and account number as a fallback." },
    ],
    related: ["free-receipt-verification-no-api-key", "ethiopian-bank-receipt-formats", "payment-fraud-ethiopia"],
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
      "Stop paying check.et 499 ETB/month. Verify CBE, Telebirr, BOA, and M-Pesa receipts for free with no signup, no API key, and no limits. Here's how.",
    category: "comparison",
    excerpt:
      "check.et charges 499 ETB/month after 200 free verifications. verify.et charges $20+/month. Both use the same public bank endpoints cheki uses for free. Here's the complete guide to free verification.",
    date: "2026-06-18",
    readTime: "5 min",
    content: [
      { type: "text", text: "If you're an Ethiopian business owner, you've probably heard of check.et or verify.et. They verify bank receipts so you can confirm payments before releasing goods. The problem? They charge you for data that is already free." },
      { type: "callout", variant: "warning", title: "The reality", text: "check.et and verify.et verify receipts by hitting the exact same public bank URLs that anyone can access for free. They add a pricing layer on top of public data. cheki removes that layer." },

      { type: "heading", text: "What check.et, verify.et, qbirr, tinaverify, and tally actually do" },
      { type: "text", text: "Every Ethiopian bank publishes transaction receipts at public URLs. These URLs require no authentication. Here are the actual endpoints:" },
      {
        type: "table",
        headers: ["Bank", "Public endpoint", "Format", "Cost"],
        rows: [
          ["CBE (new)", "Mb.cbe.com.et/api/v1/transactions/public/transaction-detail/{id}", "JSON", "Free"],
          ["CBE (old)", "apps.cbe.com.et:100/?id={ref}{account}", "PDF", "Free"],
          ["Telebirr", "transactioninfo.ethiotelecom.et/receipt/{ref}", "HTML", "Free"],
          ["BOA", "cs.bankofabyssinia.com/api/onlineSlip/getDetails/?id={ref}{acct}", "JSON", "Free"],
          ["Dashen", "receipt.dashensuperapp.com/receipt/{ref}", "PDF", "Free"],
          ["M-Pesa", "m-pesabusiness.safaricom.et/api/receipt/getReceipt?trxNo={ref}", "JSON", "Free"],
        ],
      },
      { type: "text", text: "check.et, verify.et, qbirr, tinaverify, and tally all fetch these URLs, parse the response, and return structured data. That's exactly what cheki does, except cheki is free and open source." },

      { type: "heading", text: "Pricing comparison" },
      {
        type: "table",
        headers: ["Service", "Free tier", "Paid plan", "Per verification cost"],
        rows: [
          ["cheki", "Unlimited", "N/A (always free)", "0 ETB"],
          ["check.et", "200 (one-time, not monthly)", "499 ETB/month or 4,990/year", "~2.5 ETB per verification at 200/mo"],
          ["verify.et", "200 (one-time)", "$20-40/month", "~$0.10-0.20 per verification"],
          ["qbirr", "50/month", "500-8,000 ETB/month", "0.50-0.84 ETB per verification"],
          ["tinaverify", "None", "3K-8K ETB per 90 days (credit-based)", "0.84-0.91 ETB per verification"],
          ["tally", "Unknown (not public)", "Unknown", "Unknown"],
        ],
      },
      { type: "callout", variant: "info", title: "Important detail", text: "check.et's 200 free verifications are a one-time allowance, not monthly. Once you use them, you must upgrade. cheki has no such limit. Ever." },

      { type: "heading", text: "How to verify receipts for free with cheki" },
      {
        type: "steps",
        items: [
          { title: "Go to chekiapp.vercel.app", text: "No signup, no login, no account creation. Just open the page and start verifying." },
          { title: "Paste your receipt reference or URL", text: "Type an FT reference for CBE, a transaction ID for Telebirr, or paste a full receipt URL. cheki auto-detects the bank." },
          { title: "Click Verify", text: "cheki fetches the receipt from the bank's public endpoint and shows you the result in 1-3 seconds." },
          { title: "Review the data", text: "You'll see the sender name, receiver name, amount, date, and source URL. Copy the JSON if you need it for your records." },
        ],
      },

      { type: "heading", text: "Using the free API" },
      { type: "text", text: "If you're a developer, cheki provides a free REST API with no authentication:" },
      { type: "code", lang: "bash", code: 'curl -X POST https://chekiapp.vercel.app/api/verify \\\n  -H "Content-Type: application/json" \\\n  -d \'{"bank":"cbe","reference":"FT26140P01YB","accountNumber":"1000560536171"}\'' },
      { type: "text", text: "No API key header. No Bearer token. No rate limit. Just POST and get JSON back." },
      { type: "text", text: "Compare this to check.et, which requires a business account, an API key generation step, and Authorization headers:" },
      { type: "code", lang: "bash", code: '# check.et requires all this:\nexport CHECK_ET_API_KEY=chk_xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx\n\ncurl -X POST https://api.check.et/api/v1/verify \\\n  -H "Authorization: Bearer $CHECK_ET_API_KEY" \\\n  -H "Content-Type: application/json" \\\n  -d \'{"bank":"cbe","transaction_number":"FT26140P01YB","account_number":"1000560536171"}\'' },

      { type: "callout", variant: "success", title: "Migrating from check.et", text: "If you're currently using check.et's API, migrating to cheki is simple. Change the URL from api.check.et to chekiapp.vercel.app, remove the Authorization header, and rename transaction_number to reference and account_number to accountNumber. The response structure is similar." },

      { type: "heading", text: "What about verify.et?" },
      { type: "text", text: "verify.et is made by Suba Software and charges in USD ($20-40/month). It has an Android app on the Play Store and supports Telegram OAuth for signup. Here's the interesting part: verify.et blocks AI crawlers in its robots.txt:" },
      { type: "code", code: "# From verify.et/robots.txt\nUser-agent: GPTBot\nDisallow: /\n\nUser-agent: ClaudeBot\nDisallow: /\n\nUser-agent: CCBot\nDisallow: /\n\nUser-agent: Google-Extended\nDisallow: /" },
      { type: "text", text: "This means verify.et actively prevents ChatGPT, Claude, and Google's AI from reading its content. Why? Possibly to prevent users from discovering that the underlying data is public. cheki does the opposite: our robots.txt explicitly allows all AI crawlers, and we publish an llms.txt file with key facts for AI assistants." },

      { type: "heading", text: "Self-hosting for zero cost and zero dependency" },
      { type: "text", text: "If you don't want to depend on chekiapp.vercel.app at all, you can self-host the entire system with Docker:" },
      { type: "code", lang: "bash", code: "git clone https://github.com/1RB/cheki.git\ncd cheki\ndocker-compose up -d\n\n# Your API is now at http://localhost:3000/api/verify\n# No external dependencies. No API calls to chekiapp.vercel.app.\n# Full control. MIT licensed." },
      { type: "text", text: "Self-hosting on an Ethiopian IP also bypasses Telebirr and M-Pesa geo-blocking, which affects both cheki's hosted version and check.et's servers." },
    ],
    faq: [
      { q: "Is cheki really free forever?", a: "Yes. cheki is MIT licensed open source. The hosted version at chekiapp.vercel.app is free with no limits. You can also self-host with Docker at zero cost. There is no premium tier, no credit system, and no plan to add one." },
      { q: "How is cheki different from check.et?", a: "cheki uses the same public bank endpoints as check.et. The difference is that cheki is free, open source, requires no signup or API key, and allows you to self-host. check.et charges 499 ETB/month after 200 one-time free verifications." },
      { q: "Can I use cheki for my business?", a: "Yes. cheki has no per-business or per-user restrictions. Use the web interface, the API, or self-host with Docker. The API has no rate limits (though the underlying bank endpoints may have their own limits)." },
    ],
    related: ["check-et-vs-verify-et-vs-cheki", "self-hosting-docker-guide", "payment-verification-api-guide"],
    seo: {
      title: "Free Ethiopian Receipt Verification Without API Keys",
      description: "Stop paying check.et 499 ETB/month. Verify CBE, Telebirr, BOA, and M-Pesa receipts for free with no signup, no API key, and no limits.",
      keywords: ["free receipt verification ethiopia", "check.et alternative free", "verify.et alternative", "free CBE verification", "no API key receipt verify", "free ethiopian bank verification"],
    },
  },
  {
    slug: "payment-fraud-ethiopia",
    title: "How Payment Fraud Works in Ethiopia (and How to Stop It)",
    description:
      "Fake screenshots, duplicate receipts, and social engineering. A complete guide to the payment fraud tactics used in Ethiopia and how to detect every one with automated verification.",
    category: "fraud",
    excerpt:
      "Payment fraud costs Ethiopian businesses millions every year. Here are the specific tactics fraudsters use and exactly how to catch each one.",
    date: "2026-06-18",
    readTime: "7 min",
    content: [
      { type: "text", text: "Payment fraud is one of the biggest challenges for Ethiopian businesses. Unlike countries with card payments and automatic merchant confirmation, most Ethiopian transactions happen through bank transfers and mobile money. Merchants must manually verify each payment before releasing goods. This creates opportunities for fraud." },

      { type: "heading", text: "The 5 most common fraud tactics in Ethiopia" },

      { type: "heading", text: "1. Edited screenshots" },
      { type: "text", text: "The most basic and most common tactic. The fraudster takes a real receipt screenshot and edits the amount or date using a photo editing app. They change 1,000 ETB to 10,000 ETB, or modify the date to make an old payment look recent." },
      { type: "callout", variant: "danger", title: "Why it works", text: "The human eye cannot reliably detect well-edited screenshots, especially on small phone screens under pressure at a busy counter. Staff often glance at the screenshot, see the right amount, and release goods." },
      { type: "text", text: "Detection: Verify the transaction reference against the bank's official system. If the amount on the official receipt doesn't match what the screenshot shows, it's fake. cheki does this automatically." },

      { type: "heading", text: "2. Duplicate receipts" },
      { type: "text", text: "The fraudster makes a genuine payment and receives a real receipt. A week later, they return and present the same receipt for a new purchase. The receipt is legitimate, but it was for a previous transaction." },
      { type: "callout", variant: "warning", title: "Hard to detect manually", text: "The receipt is real. The reference number checks out. The amount matches. Without tracking which receipts have been used, staff have no way to know it's a duplicate." },
      { type: "text", text: "Detection: Store every verified transaction reference in your system. Before accepting a payment, check if the reference has already been used. cheki's API returns the transaction date, so you can also reject receipts older than a set time window." },

      { type: "heading", text: "3. Wrong account screenshots" },
      { type: "text", text: "The fraudster sends a screenshot of a transfer to a different account. The screenshot shows a real transfer for the right amount, but the money went to someone else's account, not yours." },
      { type: "text", text: "Detection: Verify the receiver name and account on the official receipt. cheki returns the receiver name and account number, which you can compare against your own." },

      { type: "heading", text: "4. Fabricated receipts" },
      { type: "text", text: "Some fraudsters create completely fake receipts that mimic the design of the real banking app. These are harder to make but can fool staff who don't know exactly what the real receipt looks like." },
      { type: "text", text: "Detection: Verify the transaction reference. If the reference doesn't exist on the bank's system, the receipt is fake. The bank endpoint will return a 404 or error." },

      { type: "heading", text: "5. Social engineering" },
      { type: "text", text: "The fraudster creates urgency. They claim they're in a hurry, the transfer is processing, or they'll lose a flight. They pressure staff into releasing goods before verification is complete." },
      { type: "text", text: "Detection: Never release goods under time pressure. If a customer is genuinely in a hurry, verify the payment first and release goods after. A real payment can be verified in 1-3 seconds with cheki." },

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
        ],
      },

      { type: "heading", text: "Automating fraud prevention" },
      { type: "text", text: "Manual verification is unreliable because it depends on human judgment under pressure. The solution is to automate verification so every transaction is checked, every time, with no exceptions." },
      { type: "text", text: "With cheki's API, you can integrate verification into your POS system, e-commerce checkout, or delivery app. Here's a simple integration pattern:" },
      { type: "code", lang: "javascript", code: "// Before releasing goods, verify the payment\nconst response = await fetch('https://chekiapp.vercel.app/api/verify', {\n  method: 'POST',\n  headers: { 'Content-Type': 'application/json' },\n  body: JSON.stringify({\n    bank: 'cbe',\n    reference: customerReference,\n    accountNumber: myAccountNumber\n  })\n});\n\nconst result = await response.json();\n\n// Check 1: Does the receipt exist?\nif (!result.verified) return reject('Receipt not found');\n\n// Check 2: Does the amount match?\nif (result.amount !== expectedAmount) return reject('Amount mismatch');\n\n// Check 3: Is the receiver our account?\nif (result.receiverAccount !== myAccount) return reject('Wrong account');\n\n// Check 4: Is this a duplicate?\nif (await isDuplicate(result.reference)) return reject('Duplicate receipt');\n\n// Check 5: Is the payment recent?\nif (isOlderThan(result.date, 1, 'hour')) return reject('Stale payment');\n\n// All checks passed\nreturn approve();" },
      { type: "callout", variant: "tip", title: "Use batch verification for reconciliation", text: "At the end of each day, use cheki's batch endpoint to verify all receipts at once. POST to /api/verify/batch with up to 50 receipts. This catches any fraud that slipped through during the day." },
    ],
    faq: [
      { q: "How common is payment fraud in Ethiopia?", a: "While exact statistics are not publicly available, payment fraud is widely reported across Ethiopian retail, delivery, and e-commerce. Fake screenshots are the most common tactic, followed by duplicate receipts." },
      { q: "Can cheki detect all types of fraud?", a: "cheki detects edited screenshots, fabricated receipts, and wrong-account transfers by verifying against the bank's official system. Duplicate detection requires you to store verified references in your own database. cheki provides the data; you implement the duplicate check." },
      { q: "Is automated verification better than manual checking?", a: "Yes. Manual checking is slow, error-prone, and depends on human judgment under pressure. Automated verification with cheki completes in 1-3 seconds and eliminates human error. Every transaction should be verified, not just suspicious ones." },
    ],
    related: ["cbe-receipt-qr-code", "free-receipt-verification-no-api-key", "self-hosting-docker-guide"],
    seo: {
      title: "How Payment Fraud Works in Ethiopia and How to Stop It",
      description: "Fake screenshots, duplicate receipts, and social engineering. A complete guide to Ethiopian payment fraud tactics and how to detect each one with automated verification.",
      keywords: ["payment fraud ethiopia", "fake receipt ethiopia", "telebirr fraud", "CBE fake screenshot", "ethiopian payment scam", "duplicate receipt fraud"],
    },
  },
  {
    slug: "ethiopian-bank-receipt-formats",
    title: "Ethiopian Bank Receipt Formats: A Complete Reference",
    description:
      "Every Ethiopian bank receipt reference format, endpoint URL, and response type in one place. CBE, Telebirr, BOA, M-Pesa, Dashen, Awash, Zemen, CBE Birr, Siinqee.",
    category: "technical",
    excerpt:
      "The definitive reference for Ethiopian bank receipt formats. Reference patterns, endpoint URLs, required fields, and response types for all 9 banks and wallets.",
    date: "2026-06-18",
    readTime: "6 min",
    content: [
      { type: "text", text: "This is a complete technical reference for every Ethiopian bank and mobile wallet receipt system. If you're building a verification system, integrating payments, or just want to understand how Ethiopian bank receipts work, this is your reference." },

      { type: "callout", variant: "info", title: "All endpoints are public", text: "Every endpoint listed here is publicly accessible without authentication. The data is free. cheki, check.et, and verify.et all use these same endpoints." },

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
      { type: "heading", text: "Old system (apps.cbe.com.et)" },
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
      { type: "text", text: "Reference format: FT followed by 10 alphanumeric characters. Example: FT26140P01YB" },
      { type: "code", code: "# Old CBE URL construction\nFT_REFERENCE = 'FT26140P01YB'\nACCOUNT = '1000560536171'\nLAST_8 = ACCOUNT[-8:]  # '60536171'\nURL = f'https://apps.cbe.com.et:100/?id={FT_REFERENCE}{LAST_8}'\n# https://apps.cbe.com.et:100/?id=FT26140P01YB60536171" },

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
      { type: "code", code: "# Telebirr URL construction\nREFERENCE = 'DET8FJGUJ4'\nURL = f'https://transactioninfo.ethiotelecom.et/receipt/{REFERENCE}'" },
      { type: "callout", variant: "warning", title: "Geo-blocking", text: "Telebirr's endpoint blocks all non-Ethiopian IP addresses at the network level. Cloud servers (AWS, Vercel, Cloudflare) cannot reach it. Self-host cheki on an Ethiopian server or use the fallback URL feature." },

      { type: "heading", text: "Bank of Abyssinia (BOA)" },
      {
        type: "table",
        headers: ["Field", "Value"],
        rows: [
          ["URL format", "https://cs.bankofabyssinia.com/api/onlineSlip/getDetails/?id={REFERENCE}{LAST_5_DIGITS}"],
          ["QR format", "AES-256-CBC encrypted CSV (decrypts to source, amount, reference, date, receiver)"],
          ["Response format", "JSON"],
          ["Input needed", "Transaction reference + last 5 digits of receiving account, OR the QR payload"],
          ["Account number required", "Yes (last 5 digits), skipped if QR payload is provided"],
          ["Geo-blocked", "No"],
        ],
      },
      { type: "text", text: "Reference format: Alphanumeric, typically starts with 2 letters. Example: AB12345678 or FT26167ZVPCJ" },
      { type: "callout", variant: "tip", title: "QR verification works for inter-bank transfers", text: "BOA's online slip API does not recognize inter-bank transfer references (e.g., FT... sent to CBE). However, the QR code on the receipt is an AES-256-CBC encrypted payload that contains the full transaction details. cheki decrypts it server-side with the key exposed in BOA's receipt web app, so QR-based verification works even when the JSON API returns 'Invalid reference number'. See our BOA QR code breakdown for encryption parameters and security analysis." },
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
          ["URL format", "https://receipt.dashensuperapp.com/receipt/{REFERENCE}"],
          ["Response format", "PDF"],
          ["Input needed", "Transaction reference only"],
          ["Account number required", "No"],
          ["Geo-blocked", "No"],
        ],
      },
      { type: "text", text: "Reference format: Alphanumeric Dashen transaction reference. Use the Transaction Reference, not the Transfer Reference. Works for both within-Dashen and Other Bank Transfer (inter-bank) receipts." },

      { type: "heading", text: "Awash Bank" },
      {
        type: "table",
        headers: ["Field", "Value"],
        rows: [
          ["URL format", "https://awashpay.awashbank.com:8225/-{REFERENCE}"],
          ["Response format", "HTML"],
          ["Input needed", "Transaction reference only"],
          ["Account number required", "No"],
          ["Geo-blocked", "No"],
        ],
      },

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
          ["URL format", "https://apps.cbebirr.com.et/receipt/{REFERENCE}?phone={PAYER_PHONE}"],
          ["Response format", "HTML"],
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

      { type: "heading", text: "Other Ethiopian banks (researching)" },
      { type: "text", text: "The following 18 banks are licensed in Ethiopia but do not yet have confirmed public receipt verification endpoints. cheki lists them as 'in development' and is actively researching their receipt systems:" },
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
          ["ZamZam Bank", "2021", "-", "Researching (Islamic)"],
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
          ["receipt.ebirr.com/{tenant}/{token}", "eBirr"],
          ["tenant/token (nib/, wegagen/, ahadu/, kaafimf/)", "eBirr"],
        ],
      },
      { type: "callout", variant: "info", title: "URL auto-detection", text: "cheki also detects the bank from pasted URLs. If you paste a mbreciept.cbe.com.et link, it knows it's CBE. If you paste a transactioninfo.ethiotelecom.et link, it knows it's Telebirr. No manual bank selection needed." },
    ],
    faq: [
      { q: "Are these bank endpoints official APIs?", a: "These are public endpoints that the banks use for their own receipt sharing systems. They are not documented official APIs, but they are publicly accessible without authentication. cheki, check.et, and verify.et all use these same endpoints." },
      { q: "Can the banks change or remove these endpoints?", a: "Yes. If a bank changes their endpoint, cheki needs to update its parser. Because cheki is open source, anyone can submit a fix. This is an advantage over closed services like check.et." },
      { q: "Which banks require an account number?", a: "CBE (old system) requires the last 8 digits of the receiving account. BOA requires the last 5 digits. All other banks only need the transaction reference. The new CBE system (mbreciept) does not require an account number." },
    ],
    related: ["cbe-receipt-qr-code", "self-hosting-docker-guide", "payment-verification-api-guide"],
    seo: {
      title: "Ethiopian Bank Receipt Formats: Complete Reference",
      description: "Every Ethiopian bank receipt reference format, endpoint URL, and response type. CBE, Telebirr, BOA, M-Pesa, Dashen, Awash, Zemen, CBE Birr, Siinqee.",
      keywords: ["ethiopian bank receipt format", "CBE FT reference", "telebirr transaction ID format", "BOA receipt endpoint", "ethiopian bank API", "receipt verification reference pattern"],
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
    readTime: "5 min",
    content: [
      { type: "text", text: "Self-hosting cheki gives you three advantages over the hosted version: full control over your data, no dependency on chekiapp.vercel.app, and the ability to bypass Telebirr and M-Pesa geo-blocking by running on an Ethiopian IP address." },

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
          ["/api/verify/batch", "POST", "Verify up to 50 receipts at once"],
          ["/api/banks", "GET", "List supported banks and status"],
          ["/api/health", "GET", "Check API and per-bank endpoint health"],
          ["/api/receipt", "GET", "Download raw receipt file from bank"],
        ],
      },

      { type: "heading", text: "Bypassing Telebirr and M-Pesa geo-blocks" },
      { type: "text", text: "Telebirr (transactioninfo.ethiotelecom.et) and M-Pesa (m-pesabusiness.safaricom.et) block all non-Ethiopian IP addresses at the TCP level. This means cloud servers on AWS, Vercel, Cloudflare, and most international hosting providers cannot reach these endpoints." },
      { type: "text", text: "If you self-host cheki on a server with an Ethiopian IP address, Telebirr and M-Pesa verification will work without any workarounds. This is the cleanest solution." },
      { type: "callout", variant: "tip", title: "Ethiopian hosting options", text: "Ethio Telecom and various local ISPs offer fixed IP addresses. A small VPS or dedicated server in Ethiopia can run cheki for a few hundred birr per month, with unlimited verification." },

      { type: "heading", text: "X-Forwarded-For bypass (non-Ethiopian servers)" },
      { type: "text", text: "If you can't host in Ethiopia but have a server with a non-blocked IP (some residential or less-known hosting ranges work), you can try the X-Forwarded-For header bypass:" },
      { type: "code", lang: "bash", code: "# cheki already sends these headers for geo-blocked banks:\n# X-Forwarded-For: 197.156.96.83 (Ethiopian IP)\n# X-Real-IP: 197.156.96.83\n\n# This works with some proxies and residential connections\n# but NOT with cloud datacenter IPs (AWS, GCP, Azure, Vercel)" },
      { type: "callout", variant: "warning", title: "Not reliable on cloud", text: "Ethiopian banks actively block cloud provider IP ranges. The X-Forwarded-For header is ignored when the TCP connection itself is blocked. This bypass only works from IPs that aren't already blocked." },

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
    seo: {
      title: "Self-Hosting cheki with Docker: Complete Guide",
      description: "Run your own free Ethiopian receipt verification API with Docker. Bypass geo-blocks, keep data in-house, and customize for your needs.",
      keywords: ["self-host receipt verification", "docker ethiopian bank", "cheki self-hosting", "telebirr geo-block bypass", "free verification API docker"],
    },
  },
  {
    slug: "check-et-vs-verify-et-vs-cheki",
    title: "Ethiopian Receipt Verification Services: The Full Comparison",
    description:
      "Evidence-based comparison of Ethiopia's six receipt verification services: cheki, check.et, verify.et, qbirr, tinaverify, and tally. Pricing, features, data sources, and what's behind the paywall.",
    category: "comparison",
    excerpt:
      "Six services, all using the same public bank endpoints. One is free and open source, the rest charge 500-8,000 ETB/month. Here's the evidence.",
    date: "2026-06-19",
    readTime: "8 min",
    content: [
      { type: "text", text: "There are six receipt verification services operating in Ethiopia: cheki, check.et, verify.et, qbirr, tinaverify, and tally. This article compares all six based on publicly available evidence, not marketing claims." },

      { type: "callout", variant: "info", title: "Full disclosure", text: "cheki is the open source project we built. This comparison is based on public information from each service's website, API docs, sitemap, robots.txt, and GitHub repositories. Verify everything yourself." },

      { type: "heading", text: "The core fact" },
      { type: "quote", text: "All six services verify receipts by fetching the same public bank endpoints. The data is identical. The difference is the business model wrapped around it." },
      { type: "text", text: "Every Ethiopian bank publishes receipts at public URLs that require no authentication. These endpoints are documented in cheki's source code and can be verified by anyone. All six services use these same endpoints." },

      { type: "heading", text: "Pricing comparison" },
      {
        type: "table",
        headers: ["Service", "Price", "Free tier", "Per-verify cost"],
        rows: [
          ["cheki", "Free forever", "Unlimited", "0 ETB"],
          ["check.et", "499 ETB/mo or 4,990/yr", "200 (one-time)", "~2.5 ETB at 200/mo"],
          ["verify.et", "$20-40/mo USD", "200 (one-time)", "~$0.10-0.20"],
          ["qbirr", "500-8,000 ETB/mo", "50/mo", "0.50-0.84 ETB"],
          ["tinaverify", "3K-8K ETB per 90 days", "None", "0.84-0.91 ETB"],
          ["tally", "Unknown (not public)", "Unknown", "Unknown"],
        ],
      },
      { type: "callout", variant: "warning", title: "check.et's free tier is one-time", text: "check.et's 200 free verifications are a one-time allowance, not monthly. Once you use them, you must upgrade. cheki has no such limit, ever." },

      { type: "heading", text: "Platform comparison" },
      {
        type: "table",
        headers: ["Feature", "cheki", "check.et", "verify.et", "qbirr", "tinaverify", "tally"],
        rows: [
          ["Banks supported", "9", "9", "10", "7", "6", "4"],
          ["Banks live", "4", "9", "9", "7", "6", "4"],
          ["REST API", "Yes (free)", "Yes (paid)", "Yes (paid)", "Yes (paid)", "No", "No"],
          ["QR scanning", "Yes", "Yes", "Yes", "No", "Yes (camera)", "No"],
          ["BOA QR decryption", "Yes", "No", "No", "No", "No", "No"],
          ["Batch verification", "Yes (50)", "No", "No", "No", "No", "No"],
          ["Mobile app", "PWA", "PWA", "Android", "No", "iOS+Android", "Unreleased"],
          ["Geo-block bypass", "No", "No", "No", "Yes (relay)", "No", "Yes (ET IP)"],
          ["Duplicate detection", "No", "Per-branch", "History", "Per-merchant", "Audit trail", "No"],
          ["Amount tolerance", "No", "No", "No", "Yes (configurable)", "No", "No"],
        ],
      },

      { type: "heading", text: "Transparency comparison" },
      {
        type: "table",
        headers: ["Feature", "cheki", "check.et", "verify.et", "qbirr", "tinaverify", "tally"],
        rows: [
          ["Open source", "Yes (MIT)", "No", "No", "No", "No", "No"],
          ["Self-hosting", "Yes (Docker)", "No", "No", "No", "No", "No"],
          ["Source URL shown", "Yes", "Hidden", "Hidden", "No", "No", "No"],
          ["AI crawler access", "Allowed", "Allowed", "Blocked", "Allowed", "Allowed", "N/A"],
          ["Python library", "Yes", "No", "No", "Advertised (unpublished)", "No", "No"],
          ["TypeScript SDK", "Yes", "No", "Yes", "Advertised (unpublished)", "No", "No"],
        ],
      },
      { type: "callout", variant: "warning", title: "qbirr's SDKs are vaporware", text: "qbirr advertises Node.js, Python, PHP, and Go SDKs plus a WordPress plugin. As of launch (June 2026), none of them exist on npm, PyPI, Packagist, GitHub, or the WordPress plugin repository. The GitHub user 'qbirr' belongs to an unrelated Indonesian developer. Only the REST API works." },

      { type: "heading", text: "check.et: the details" },
      { type: "text", text: "check.et is built with Next.js and deployed on Vercel. It has a well-designed UI with bilingual support (English and Amharic), bank-specific guide pages, and a developer portal. The pricing model is:" },
      { type: "list", items: [
        "Free: 200 verifications (one-time, not monthly), then you must upgrade",
        "Pro Monthly: 499 ETB/month",
        "Pro Yearly: 4,990 ETB/year (save 2 months)",
      ]},
      { type: "text", text: "check.et supports 9 banks and wallets: CBE, Telebirr, Dashen, Awash, BOA, Zemen, CBE Birr, M-Pesa, and Siinqee. It has a REST API that requires a business account and API key." },
      { type: "text", text: "Strengths: polished UI, bilingual, good SEO content (15+ guide pages), developer documentation, employee management features." },
      { type: "text", text: "Weaknesses: charges for public data, 200 free verifications are one-time not monthly, API requires business account signup, no self-hosting, no open source." },

      { type: "heading", text: "verify.et: the details" },
      { type: "text", text: "verify.et is built by Suba Software. It uses Cloudflare and has an Android app on the Play Store. Signup is Telegram-only (OAuth via Telegram bot)." },
      { type: "text", text: "verify.et supports 10 banks: CBE, Telebirr, Dashen, BOA, CBE Birr, Awash, M-Pesa, Siinqee, Kaafi Ebirr, and Zemen. It has a blog with categories for payment verification, bank guides, wallet guides, fraud prevention, API integration, merchant operations, and finance basics." },
      { type: "callout", variant: "warning", title: "verify.et blocks AI crawlers", text: "verify.et's robots.txt explicitly blocks GPTBot, ClaudeBot, CCBot, Google-Extended, Applebot-Extended, Bytespider, meta-externalagent, and Amazonbot. This prevents ChatGPT, Claude, Google AI Overview, and other AI tools from reading verify.et's content. The stated reason is EU copyright directive compliance, but the practical effect is that users can't ask AI assistants about verify.et." },
      { type: "text", text: "Strengths: Android app, blog content, status pages per bank, published TypeScript SDK." },
      { type: "text", text: "Weaknesses: charges in USD, requires Telegram signup, blocks AI crawlers, no open source, no self-hosting, no batch verification, no Python library." },

      { type: "heading", text: "qbirr: the details" },
      { type: "text", text: "qbirr is the newest entrant, launched June 2026. It is a developer-first API platform built with NestJS on a Contabo VPS in France. The API is at verify.qbirr.com/api/v1/verify with X-API-Key authentication." },
      { type: "text", text: "qbirr supports 7 providers: CBE, Telebirr, Awash, Dashen, M-Pesa, BOA, and eBirr (COOPay, KAAFI, Nib, Wegagen, Ahadu). All 7 are live." },
      { type: "text", text: "Pricing: 50 free verifications/month, then Starter (1K for 500 ETB/mo), Pro (10K for 2,000 ETB/mo), or Scale (100K for 8,000 ETB/mo with dedicated relay and 99.9% SLA)." },
      { type: "text", text: "Strengths: clean API design, Ethiopian relay for Telebirr/M-Pesa geo-block bypass, configurable amount tolerance, per-merchant duplicate ref locking, Scale plan with SLA." },
      { type: "text", text: "Weaknesses: brand new with no track record, SDKs advertised but unpublished, no web UI for verification, no mobile app, no QR scanning, fewer banks than check.et/verify.et, English only." },

      { type: "heading", text: "tinaverify: the details" },
      { type: "text", text: "tinaverify is a mobile-first product focused on the cashier workflow. It has published apps on both Google Play (com.tina.verify) and the App Store (id6764829142). Built with Next.js (App Router, Turbopack)." },
      { type: "text", text: "tinaverify supports 6 banks: CBE, CBE Birr, Awash, Dashen, BOA, and Telebirr. All 6 are live." },
      { type: "text", text: "Pricing is credit-based with 90-day validity: Starter (3,000 ETB for 3,300 credits) or Business (8,000 ETB for 9,500 credits). Custom credits at 1.50 ETB each, minimum 500." },
      { type: "text", text: "Strengths: published iOS and Android apps, cashier workflow (scan, verify, audit trail), multi-branch support, searchable audit history by cashier/branch/amount/reference, daily sales tracking." },
      { type: "text", text: "Weaknesses: no REST API, credit-based pricing with expiry (90 days), no open source, no self-hosting, no batch verification, fewer banks than check.et/verify.et." },

      { type: "heading", text: "tally: the details" },
      { type: "text", text: "tally is a Telegram bot-based service by Sabi LLC (sabi.works), a tech talent marketplace. The website is a static marketing page with no web app, dashboard, login, API, or docs. Every CTA links to the Telegram bot (@TallyETBot)." },
      { type: "text", text: "tally supports 4 banks: CBE, Telebirr, BOA, and Awash. The website claims direct bank verification, but their Terms section 3 explicitly states they use 'publicly accessible verification endpoints and APIs provided by financial institutions.'" },
      { type: "text", text: "Pricing is not public. The footer 'Pricing' link is a dead anchor. Terms have no billing section." },
      { type: "text", text: "Strengths: Telegram bot delivery (low friction for Telegram-heavy market), Ethiopian-hosted (Ethio Telecom IP), workspace codes for staff." },
      { type: "text", text: "Weaknesses: only 4 banks, no web app, no API, no docs, mobile app claimed but store links are dead, SSL certificate expired April 2026 (unrenewed for 2+ months), no pricing transparency, made by a dev shop not a dedicated fintech." },

      { type: "heading", text: "cheki: the details" },
      { type: "text", text: "cheki is MIT licensed open source built with Next.js. It requires no signup, no API key, and has no limits. The hosted version is at chekiapp.vercel.app, and the full source code is on GitHub." },
      { type: "text", text: "cheki supports 31 banks with 9 live (CBE, Telebirr, BOA, M-Pesa, Dashen, Zemen, CBE Birr, Siinqee, eBirr) and 22 in development. eBirr alone covers 4 additional banks through a single integration (Nib International, Wegagen, Ahadu, KAAFI Microfinance). It supports both the old and new CBE receipt systems, BOA QR code decryption, and unified QR scanning with multi-scale auto-detection." },
      { type: "text", text: "Strengths: free, open source, no signup, self-hosting, batch verification, Python library, TypeScript SDK, Docker, QR code scanning with BOA AES decryption, URL auto-detection, allows AI crawlers, shows receipt source URLs." },
      { type: "text", text: "Weaknesses: no mobile app (web only, but PWA-installable), no employee management, no dashboard for businesses, no duplicate detection built-in, no geo-block bypass relay, fewer live banks than check.et/verify.et/qbirr/tinaverify." },

      { type: "heading", text: "The data source question" },
      { type: "text", text: "Some users ask whether check.et, verify.et, qbirr, tinaverify, or tally have access to private bank APIs that cheki doesn't. The answer is no. All six services use the same public endpoints. Here's the evidence:" },
      { type: "list", items: [
        "cheki's source code shows the exact endpoints it uses (public on GitHub)",
        "check.et's API response includes verification_method: 'official' but the data fields match the public endpoint responses exactly",
        "verify.et's data fields match the public endpoint responses exactly",
        "qbirr's FAQ explicitly states: 'We fetch the same public receipt pages and APIs that the banks themselves expose to customers'",
        "tally's Terms section 3 explicitly states they use 'publicly accessible verification endpoints and APIs provided by financial institutions'",
        "The bank endpoints require no authentication, so there's no private API to access",
        "CBE's new receipt system (mbreciept) uses hardcoded app headers, not authentication, and these are extractable from the public JavaScript",
      ]},
      { type: "callout", variant: "tip", title: "Verify it yourself", text: "Open a CBE receipt link in your browser. You'll see the receipt without logging in. That's the same data all six services return. The endpoints are public by design." },
    ],
    faq: [
      { q: "Does check.et have access to private bank APIs?", a: "No. check.et uses the same public bank endpoints as cheki. The endpoints require no authentication. The data fields in check.et's API response match the public endpoint responses exactly." },
      { q: "Why does verify.et block AI crawlers?", a: "verify.et's robots.txt blocks GPTBot, ClaudeBot, CCBot, Google-Extended, and other AI crawlers, citing EU copyright directive compliance. The practical effect is that AI assistants cannot read verify.et's content, which may prevent users from discovering that the underlying data is public." },
      { q: "Is qbirr's API better than cheki's?", a: "qbirr has a cleaner developer API with rate limits, usage tracking, and configurable amount tolerance. However, it requires an API key, charges money, and has fewer banks. cheki's API is free, requires no key, and supports batch verification. qbirr's main advantage is the Ethiopian relay for geo-blocked banks (Telebirr, M-Pesa)." },
      { q: "Should I use tinaverify instead of cheki?", a: "If you need a mobile app for cashiers at a physical counter, tinaverify is a good choice with published iOS and Android apps. If you need a free API, web UI, or self-hosting, cheki is better. tinaverify charges 3,000-8,000 ETB per 90 days with credit expiry." },
      { q: "Is cheki's data as accurate as check.et's?", a: "Yes. All six services fetch from the same bank endpoints. The data is identical. cheki shows you the source URL so you can verify where the data came from." },
      { q: "What about tally?", a: "tally is a Telegram bot with 4 banks, no API, no web app, expired SSL, and no public pricing. It's the smallest player in the market. If you use Telegram for business, it might work for basic needs, but it lacks the features and transparency of the other services." },
    ],
    related: ["free-receipt-verification-no-api-key", "payment-fraud-ethiopia", "ethiopian-bank-receipt-formats"],
    seo: {
      title: "Ethiopian Receipt Verification Services: The Full Comparison",
      description: "Evidence-based comparison of Ethiopia's six receipt verification services: cheki, check.et, verify.et, qbirr, tinaverify, and tally. Pricing, features, data sources.",
      keywords: ["check.et vs verify.et", "check.et alternative", "verify.et alternative", "qbirr alternative", "tinaverify comparison", "free check.et", "cheki comparison", "ethiopian receipt verification comparison", "tally.com.et"],
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
    readTime: "8 min",
    content: [
      { type: "text", text: "This guide walks through integrating cheki's free REST API into a real application. No API key, no signup, no rate limits. We'll cover single verification, batch verification, error handling, and fraud prevention patterns." },

      { type: "heading", text: "API overview" },
      {
        type: "table",
        headers: ["Endpoint", "Method", "Purpose"],
        rows: [
          ["/api/verify", "POST", "Verify a single receipt"],
          ["/api/verify/batch", "POST", "Verify up to 50 receipts at once"],
          ["/api/banks", "GET", "List supported banks and status"],
          ["/api/health", "GET", "Check API and per-bank endpoint latency"],
        ],
      },
      { type: "text", text: "Base URL: https://chekiapp.vercel.app/api" },
      { type: "callout", variant: "success", title: "No authentication", text: "cheki's API requires no API key, no Bearer token, and no signup. Just POST and get JSON. This is different from check.et which requires a business account and Authorization header." },

      { type: "heading", text: "Single verification" },
      { type: "text", text: "The most common use case: verify one receipt at a time." },
      { type: "code", lang: "bash", code: 'curl -X POST https://chekiapp.vercel.app/api/verify \\\n  -H "Content-Type: application/json" \\\n  -d \'{\n    "bank": "cbe",\n    "reference": "FT26140P01YB",\n    "accountNumber": "1000560536171"\n  }\'' },
      { type: "text", text: "Response:" },
      { type: "code", lang: "json", code: '{\n  "success": true,\n  "verified": true,\n  "bank": "Commercial Bank of Ethiopia",\n  "reference": "FT26140P01YB",\n  "amount": 20000,\n  "currency": "ETB",\n  "senderName": "Mr Mohammed Abdulwasi Reshid",\n  "senderAccount": "1****1685",\n  "receiverName": "SAMI ADIL ZEKARIA",\n  "receiverAccount": "1000560536171",\n  "date": "5/20/2026 7:29:00 PM",\n  "sourceUrl": "https://apps.cbe.com.et:100/?id=FT26140P01YB60536171"\n}' },

      { type: "heading", text: "URL-based verification" },
      { type: "text", text: "If you have a receipt URL (e.g. from a QR code or shared link), you can skip the bank field. cheki auto-detects the bank from the URL:" },
      { type: "code", lang: "bash", code: 'curl -X POST https://chekiapp.vercel.app/api/verify \\\n  -H "Content-Type: application/json" \\\n  -d \'{\n    "reference": "https://mbreciept.cbe.com.et/fHCxyV4mg5pRIwEkJO"\n  }\'' },

      { type: "heading", text: "Batch verification" },
      { type: "text", text: "For end-of-day reconciliation, verify up to 50 receipts in a single request:" },
      { type: "code", lang: "bash", code: 'curl -X POST https://chekiapp.vercel.app/api/verify/batch \\\n  -H "Content-Type: application/json" \\\n  -d \'{\n    "receipts": [\n      {"bank": "cbe", "reference": "FT26140P01YB", "accountNumber": "1000560536171"},\n      {"bank": "telebirr", "reference": "DET8FJGUJ4"},\n      {"bank": "boa", "reference": "AB12345678", "accountNumber": "12345"}\n    ]\n  }\'' },

      { type: "heading", text: "JavaScript integration" },
      { type: "code", lang: "javascript", code: "class ChekiAPI {\n  constructor(baseUrl = 'https://chekiapp.vercel.app') {\n    this.baseUrl = baseUrl;\n  }\n\n  async verify(bank, reference, accountNumber) {\n    const res = await fetch(`${this.baseUrl}/api/verify`, {\n      method: 'POST',\n      headers: { 'Content-Type': 'application/json' },\n      body: JSON.stringify({ bank, reference, accountNumber })\n    });\n    return res.json();\n  }\n\n  async verifyUrl(url) {\n    const res = await fetch(`${this.baseUrl}/api/verify`, {\n      method: 'POST',\n      headers: { 'Content-Type': 'application/json' },\n      body: JSON.stringify({ reference: url })\n    });\n    return res.json();\n  }\n\n  async batchVerify(receipts) {\n    const res = await fetch(`${this.baseUrl}/api/verify/batch`, {\n      method: 'POST',\n      headers: { 'Content-Type': 'application/json' },\n      body: JSON.stringify({ receipts })\n    });\n    return res.json();\n  }\n}\n\n// Usage\nconst cheki = new ChekiAPI();\nconst result = await cheki.verify('cbe', 'FT26140P01YB', '1000560536171');\nif (result.verified && result.amount === expectedAmount) {\n  console.log('Payment confirmed:', result.amount, result.currency);\n}" },

      { type: "heading", text: "Python integration" },
      { type: "code", lang: "python", code: "import requests\n\nclass ChekiAPI:\n    def __init__(self, base_url='https://chekiapp.vercel.app'):\n        self.base_url = base_url\n\n    def verify(self, bank, reference, account_number=None):\n        payload = {'bank': bank, 'reference': reference}\n        if account_number:\n            payload['accountNumber'] = account_number\n        r = requests.post(f'{self.base_url}/api/verify', json=payload)\n        return r.json()\n\n    def verify_url(self, url):\n        r = requests.post(f'{self.base_url}/api/verify',\n                         json={'reference': url})\n        return r.json()\n\n# Usage\ncheki = ChekiAPI()\nresult = cheki.verify('cbe', 'FT26140P01YB', '1000560536171')\nif result.get('verified') and result.get('amount') == expected_amount:\n    print(f'Payment confirmed: {result[\"amount\"]} {result[\"currency\"]}')" },

      { type: "heading", text: "Error handling" },
      { type: "text", text: "The API returns structured errors. Handle these cases:" },
      {
        type: "table",
        headers: ["HTTP Status", "Error", "Action"],
        rows: [
          ["200", "success: true, verified: true", "Payment confirmed"],
          ["200", "success: false, fallbackUrl present", "Geo-blocked, redirect user to fallbackUrl"],
          ["404", "Receipt not found", "Reference is invalid or fake"],
          ["400", "Missing fields", "Check request body"],
          ["502", "Bank endpoint unreachable", "Bank server is down, retry later"],
        ],
      },

      { type: "heading", text: "Fraud prevention checklist" },
      { type: "text", text: "Before releasing goods or services, run these checks:" },
      {
        type: "steps",
        items: [
          { title: "Verify existence", text: "Check result.verified is true. If false, the receipt doesn't exist on the bank system." },
          { title: "Check amount", text: "Compare result.amount with the expected payment amount. Reject if different." },
          { title: "Check receiver", text: "Compare result.receiverAccount with your account number. Reject if different." },
          { title: "Check freshness", text: "Parse result.date and reject if the payment is older than your acceptable window (e.g. 1 hour)." },
          { title: "Check duplicates", text: "Store result.reference in your database. Before accepting, check if it already exists." },
        ],
      },
      { type: "code", lang: "javascript", code: "async function verifyPayment(customerRef, expectedAmount, myAccount) {\n  const result = await cheki.verify('cbe', customerRef, myAccount);\n\n  if (!result.success || !result.verified)\n    return { ok: false, reason: 'Receipt not found' };\n\n  if (result.amount !== expectedAmount)\n    return { ok: false, reason: `Amount mismatch: ${result.amount} vs ${expectedAmount}` };\n\n  if (result.receiverAccount && !result.receiverAccount.endsWith(myAccount.slice(-5)))\n    return { ok: false, reason: 'Wrong receiving account' };\n\n  const paymentDate = new Date(result.date);\n  const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000);\n  if (paymentDate < oneHourAgo)\n    return { ok: false, reason: 'Payment is too old' };\n\n  if (await isDuplicate(result.reference))\n    return { ok: false, reason: 'Duplicate receipt' };\n\n  return { ok: true, data: result };\n}" },

      { type: "callout", variant: "tip", title: "Self-host for production", text: "For production use, self-host cheki with Docker. This gives you full control, eliminates dependency on chekiapp.vercel.app, and allows you to add authentication, rate limiting, and logging." },
    ],
    faq: [
      { q: "Is the API really free with no limits?", a: "Yes. cheki's API has no rate limits and no authentication. However, the underlying bank endpoints may have their own rate limits. If you make too many requests too quickly, the bank may temporarily block your IP." },
      { q: "What happens when a bank is geo-blocked?", a: "For Telebirr and M-Pesa, if cheki's server cannot reach the bank, the API returns success: false with a fallbackUrl field. You can redirect the user's browser to this URL, which works because the user's Ethiopian IP is not blocked." },
      { q: "Can I use the API commercially?", a: "Yes. cheki is MIT licensed. Use it in commercial products, SaaS, internal tools, or anything else. No attribution required (though appreciated)." },
    ],
    related: ["free-receipt-verification-no-api-key", "self-hosting-docker-guide", "ethiopian-bank-receipt-formats"],
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
      "Ethiopian fintech is dominated by paid services wrapping public data. Open source changes the equation. Here's why community-built tools like cheki matter.",
    date: "2026-06-18",
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
        "Anyone can self-host with Docker, eliminating dependency on chekiapp.vercel.app",
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
      { type: "text", text: "verify.et blocks all AI crawlers in its robots.txt. This means AI assistants can't read verify.et's content. When someone asks ChatGPT about verify.et, the AI has no information. This is anti-user and anti-transparency." },
      { type: "text", text: "cheki does the opposite. Our robots.txt explicitly allows GPTBot, ClaudeBot, CCBot, Google-Extended, PerplexityBot, and all other AI crawlers. We also publish an llms.txt file with key facts that AI assistants can reference directly." },
      { type: "callout", variant: "tip", title: "llms.txt", text: "cheki publishes a /llms.txt file with structured facts about the service, supported banks, API endpoints, and key data. This is a new standard for making websites AI-readable. Visit https://chekiapp.vercel.app/llms.txt to see it." },

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
    related: ["free-receipt-verification-no-api-key", "check-et-vs-verify-et-vs-cheki", "self-hosting-docker-guide"],
    seo: {
      title: "Open Source Ethiopian Fintech: Why It Matters",
      description: "Why open source matters for Ethiopian financial technology, how cheki fits in, and why community-built tools are better than paywalled services wrapping public data.",
      keywords: ["open source ethiopian fintech", "free ethiopian payment tools", "cheki open source", "ethiopian bank verification open source", "MIT license ethiopia"],
    },
  },
  {
    slug: "how-to-verify-cbe-receipt",
    title: "How to Verify a CBE Receipt (Step by Step)",
    description: "Complete guide to verifying Commercial Bank of Ethiopia receipts. Both the new mbreciept QR system and the old FT reference + account method. Free with cheki.",
    category: "bank",
    bankCode: "cbe",
    excerpt: "Two ways to verify CBE receipts: the new QR/URL system and the classic FT reference + account method. Both are free with cheki.",
    date: "2026-06-18",
    readTime: "4 min",
    content: [
      { type: "text", text: "CBE (Commercial Bank of Ethiopia) is the largest bank in Ethiopia and the most common settlement rail for businesses. There are two ways to verify a CBE receipt, and cheki supports both for free." },

      { type: "heading", text: "Method 1: New CBE receipt system (QR code or URL)" },
      { type: "text", text: "CBE's new receipt sharing system generates a short URL like https://mbreciept.cbe.com.et/fHCxyV4mg5pRIwEkJO. This URL is also encoded as a QR code on the receipt. This is the easiest method because it requires only one piece of information." },
      {
        type: "steps",
        items: [
          { title: "Get the receipt link or QR code", text: "Ask the customer to share the receipt link from their CBE app, or scan the QR code on the printed receipt." },
          { title: "Paste the URL in cheki", text: "Open chekiapp.vercel.app, switch to the 'Receipt URL' tab, and paste the mbreciept.cbe.com.et link. Or scan the QR code directly with cheki's camera scanner." },
          { title: "Click Verify", text: "cheki calls CBE's JSON API and returns the transaction data in under 2 seconds. You'll see the FT reference, amount, sender, receiver, and date." },
        ],
      },
      { type: "callout", variant: "tip", title: "Easiest method", text: "The new system doesn't require an account number. Just paste the link or scan the QR code. The API returns masked account numbers for privacy." },

      { type: "heading", text: "Method 2: Classic CBE receipt (FT reference + account)" },
      { type: "text", text: "If you don't have the receipt link, you can verify using the FT reference number and your receiving account number. This uses CBE's older PDF endpoint." },
      {
        type: "steps",
        items: [
          { title: "Get the FT reference number", text: "Ask the customer for the FT reference from their receipt. It starts with 'FT' followed by 10 characters, e.g. FT26140P01YB." },
          { title: "Get your account number", text: "You need the last 8 digits of your receiving CBE account. For example, if your account is 1000560536171, the last 8 digits are 60536171." },
          { title: "Enter both in cheki", text: "Select CBE from the bank dropdown, enter the FT reference, and enter the account digits. cheki constructs the URL and fetches the PDF receipt." },
          { title: "Review the result", text: "cheki parses the PDF and returns the sender name, receiver name, amount, date, and branch." },
        ],
      },

      { type: "heading", text: "What information do you need?" },
      {
        type: "table",
        headers: ["Method", "Required info", "Example"],
        rows: [
          ["New (URL/QR)", "Receipt link or QR scan", "https://mbreciept.cbe.com.et/fHCxyV4mg5pRIwEkJO"],
          ["Classic (FT ref)", "FT reference + last 8 digits of account", "FT26140P01YB + 60536171"],
        ],
      },

      { type: "heading", text: "What the receipt contains" },
      { type: "text", text: "A verified CBE receipt includes:" },
      { type: "list", items: [
        "Transaction reference (FT number)",
        "Transferred amount in ETB",
        "Payer (sender) name and account",
        "Receiver name and account",
        "Payment date and time",
        "Branch name",
        "Reason / type of service",
      ]},

      { type: "heading", text: "Verifying CBE receipts via API" },
      { type: "code", lang: "bash", code: '# New system (URL):\ncurl -X POST https://chekiapp.vercel.app/api/verify \\\n  -H "Content-Type: application/json" \\\n  -d \'{"reference":"https://mbreciept.cbe.com.et/fHCxyV4mg5pRIwEkJO"}\'\n\n# Classic system (FT ref + account):\ncurl -X POST https://chekiapp.vercel.app/api/verify \\\n  -H "Content-Type: application/json" \\\n  -d \'{"bank":"cbe","reference":"FT26140P01YB","accountNumber":"1000560536171"}\'' },

      { type: "callout", variant: "info", title: "Both methods are free", text: "Both the new QR/URL system and the classic FT reference method are free with cheki. check.et charges 499 ETB/month for the same data after 200 free verifications." },
    ],
    faq: [
      { q: "Do I need the account number for the new CBE system?", a: "No. The new mbreciept system only requires the short URL or QR code. The account number is only needed for the classic FT reference method." },
      { q: "Can I verify CBE receipts from outside Ethiopia?", a: "Yes. Both CBE endpoints (apps.cbe.com.et and Mb.cbe.com.et) are accessible globally. Unlike Telebirr and M-Pesa, CBE is not geo-blocked." },
      { q: "How fast is CBE verification?", a: "The new system (JSON API) typically takes 0.5-2 seconds. The classic system (PDF parsing) takes 1-3 seconds. Both are fast enough for real-time counter verification." },
    ],
    related: ["cbe-receipt-qr-code", "how-to-verify-telebirr-receipt", "free-receipt-verification-no-api-key"],
    seo: {
      title: "How to Verify a CBE Receipt Step by Step",
      description: "Complete guide to verifying Commercial Bank of Ethiopia receipts. Both the new QR/URL system and the classic FT reference method. Free with cheki.",
      keywords: ["verify CBE receipt", "how to verify CBE transaction", "CBE FT reference verify", "CBE receipt check", "verify Commercial Bank of Ethiopia", "CBE receipt QR code"],
    },
  },
  {
    slug: "how-to-verify-telebirr-receipt",
    title: "How to Verify a Telebirr Receipt (Step by Step)",
    description: "Complete guide to verifying Telebirr (Ethio Telecom) transactions. Reference number format, geo-blocking workarounds, and free verification with cheki.",
    category: "bank",
    bankCode: "telebirr",
    excerpt: "Telebirr is Ethiopia's most used mobile wallet. Here's how to verify any Telebirr transaction for free, including what to do about geo-blocking.",
    date: "2026-06-18",
    readTime: "4 min",
    content: [
      { type: "text", text: "Telebirr is Ethio Telecom's mobile money service and the most widely used digital wallet in Ethiopia. Verifying Telebirr receipts is simpler than CBE because you only need the transaction reference number, no account number required." },

      { type: "heading", text: "What you need" },
      { type: "list", items: [
        "Transaction reference number (required), e.g. DET8FJGUJ4 or CHQ0FJ403O",
        "That's it. No account number needed.",
      ]},

      { type: "heading", text: "Telebirr reference number format" },
      { type: "text", text: "Telebirr transaction references start with a 2-3 letter prefix followed by 6-8 alphanumeric characters. The reference is sent via SMS to both the payer and receiver after each transaction." },
      {
        type: "table",
        headers: ["Prefix", "Transaction type"],
        rows: [
          ["DET", "Person-to-person transfer (most common)"],
          ["CHQ", "Cheque-related transaction"],
          ["DAB", "Bank account transfer"],
          ["DEL", "Merchant payment"],
          ["ADQ", "Other transaction types"],
        ],
      },

      { type: "heading", text: "Step-by-step verification" },
      {
        type: "steps",
        items: [
          { title: "Get the transaction reference", text: "Ask the customer for the reference number from their Telebirr SMS or app. It starts with a 2-3 letter prefix like DET, CHQ, or DAB." },
          { title: "Enter it in cheki", text: "Open chekiapp.vercel.app, select Telebirr from the bank dropdown (or just paste the reference, cheki auto-detects Telebirr from the prefix)." },
          { title: "Click Verify", text: "cheki fetches the receipt from Telebirr's public endpoint at transactioninfo.ethiotelecom.et/receipt/{REFERENCE}" },
          { title: "Review the result", text: "You'll see the payer name, receiver name, amount, and transaction date." },
        ],
      },

      { type: "heading", text: "Geo-blocking and how to handle it" },
      { type: "callout", variant: "warning", title: "Telebirr blocks non-Ethiopian IPs", text: "Telebirr's receipt endpoint blocks all requests from IP addresses outside Ethiopia. If cheki's hosted server can't reach Telebirr, you'll get a fallback URL to open the receipt directly in your browser." },
      { type: "text", text: "If you're in Ethiopia, verification works smoothly. If you're outside Ethiopia:" },
      { type: "list", items: [
        "Use the 'Receipt URL' tab and paste the full Telebirr receipt URL. Your browser will fetch it directly using your Ethiopian IP if you're on an Ethiopian network.",
        "Self-host cheki with Docker on an Ethiopian server for reliable server-side verification.",
        "Use the Python library from a machine with an Ethiopian IP address.",
      ]},

      { type: "heading", text: "Verifying via API" },
      { type: "code", lang: "bash", code: 'curl -X POST https://chekiapp.vercel.app/api/verify \\\n  -H "Content-Type: application/json" \\\n  -d \'{"bank":"telebirr","reference":"DET8FJGUJ4"}\'' },
      { type: "text", text: "If the server is geo-blocked, the response includes a fallbackUrl field:" },
      { type: "code", lang: "json", code: '{\n  "success": false,\n  "error": "Our server can\'t reach this bank...",\n  "fallbackUrl": "https://transactioninfo.ethiotelecom.et/receipt/DET8FJGUJ4"\n}' },

      { type: "heading", text: "What the receipt contains" },
      { type: "list", items: [
        "Payer name",
        "Payer Telebirr number",
        "Credited party name (receiver)",
        "Credited party account number",
        "Amount in ETB",
        "Transaction date and time",
      ]},
    ],
    faq: [
      { q: "Do I need an account number for Telebirr verification?", a: "No. Telebirr only requires the transaction reference number. This makes it simpler than CBE or BOA verification." },
      { q: "Why does Telebirr verification fail from outside Ethiopia?", a: "Telebirr's receipt endpoint blocks non-Ethiopian IPs at the network level. Use the fallback URL, self-host on an Ethiopian server, or use the Python library from an Ethiopian network." },
      { q: "Is Telebirr receipt verification free?", a: "Yes. The Telebirr receipt URL is public and free. check.et charges 499 ETB/month for accessing this same endpoint. cheki does it for free." },
    ],
    related: ["how-to-verify-cbe-receipt", "payment-fraud-ethiopia", "ethiopian-bank-receipt-formats"],
    seo: {
      title: "How to Verify a Telebirr Receipt Step by Step",
      description: "Complete guide to verifying Telebirr transactions. Reference number format, geo-blocking workarounds, and free verification with cheki.",
      keywords: ["verify telebirr receipt", "how to verify telebirr transaction", "telebirr reference number", "telebirr transaction ID", "ethio telecom receipt verify"],
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
      "BOA's receipt QR codes are AES-256-CBC encrypted payloads using CryptoJS format. The key is public in BOA's web app. Here's the full technical breakdown of how decryption works and why it matters for inter-bank transfers.",
    date: "2026-06-19",
    readTime: "6 min",
    content: [
      { type: "text", text: "Bank of Abyssinia takes a different approach to receipt QR codes than CBE. Instead of encoding a URL that points to a server-side receipt, BOA encrypts the full transaction data directly into the QR code. This means the QR code itself IS the receipt, not just a link to one." },

      { type: "callout", variant: "info", title: "Two approaches, same goal", text: "CBE's QR codes encode a short URL (mbreciept.cbe.com.et/{id}) that redirects to server-side data. BOA's QR codes encode the transaction data itself, encrypted with AES-256-CBC. Both work, but they have different security trade-offs." },

      { type: "heading", text: "What the QR code contains" },
      { type: "text", text: "When you scan a BOA receipt QR code with a standard QR reader, you get a base64-encoded string like this:" },
      { type: "code", code: "3cHRaxVjn/pySpNXEHQE61JOQ2poZRMwnDHwMiX7YO9UVtJZT/ndmwHEzWkJoloEf4dIQIzJf5zmvbBo5qHTdm/23nc6NRzTSfxEjIHa7Ju4Ti+xydrVn8qF+9/OPAF5LIfMEvxFqZ6wlKMvSN/jrQ==" },
      { type: "text", text: "This is not a URL. It's a base64-encoded ciphertext. When decoded and decrypted, it reveals a comma-separated string with 7 fields:" },
      { type: "code", code: "senderAccount,senderName,amount,reference,date,receiverAccount,receiverName" },
      { type: "text", text: "For example, a real decrypted payload looks like:" },
      { type: "code", code: "1000370251685,EYOUEL ARAGAW HAILE,1107.59,FT252003JZPP,19/07/2025,1000370251685,MOHAMMED ABDULWASI RESHID" },

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
      { type: "text", text: "When a customer sends money from BOA to CBE, the transaction reference starts with 'FT' (e.g., FT252003JZPP). BOA's online slip API at cs.bankofabyssinia.com does not recognize these references because the transfer left BOA's system. The QR code, however, was generated at the time of transfer and contains all the details." },

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

      { type: "callout", variant: "tip", title: "No account number needed for QR", text: "Unlike BOA's JSON API which requires the last 5 digits of the receiving account, QR-based verification needs no additional information. The QR code contains everything. Just scan and verify." },

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
      { type: "code", lang: "bash", code: 'curl -X POST https://chekiapp.vercel.app/api/verify \\\n  -H "Content-Type: application/json" \\\n  -d \'{"bank":"boa","qrData":"3cHRaxVjn/pySpNXEHQE61JOQ2poZRMwnDHwMiX7YO9UVtJZT/ndmwHEzWkJoloEf4dIQIzJf5zmvbBo5qHTdm/23nc6NRzTSfxEjIHa7Ju4Ti+xydrVn8qF+9/OPAF5LIfMEvxFqZ6wlKMvSN/jrQ=="}\'' },
      { type: "text", text: "Response:" },
      { type: "code", lang: "json", code: '{\n  "verified": true,\n  "bank": "Bank of Abyssinia",\n  "senderName": "EYOUEL ARAGAW HAILE",\n  "senderAccount": "1000370251685",\n  "receiverName": "MOHAMMED ABDULWASI RESHID",\n  "receiverAccount": "1000370251685",\n  "amount": 1107.59,\n  "currency": "ETB",\n  "date": "19/07/2025",\n  "reference": "FT252003JZPP"\n}' },

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
    related: ["how-to-verify-boa-receipt", "cbe-receipt-qr-code", "ethiopian-bank-receipt-formats"],
    seo: {
      title: "BOA QR Codes: Encrypted Receipts and How Decryption Works",
      description: "Bank of Abyssinia QR codes use AES-256-CBC encryption. Here's how the encryption works, what's inside the payload, and how cheki decrypts it for instant inter-bank receipt verification.",
      keywords: ["BOA QR code", "Bank of Abyssinia QR", "BOA AES decryption", "BOA receipt encryption", "BOA inter-bank verification", "CryptoJS AES receipt", "BOA QR payload decrypt"],
    },
  },
  {
    slug: "how-to-verify-boa-receipt",
    title: "How to Verify a Bank of Abyssinia (BOA) Receipt",
    description: "Verify Bank of Abyssinia transactions for free with cheki. No Selenium needed, just the reference number and last 5 digits of your account. QR codes supported for inter-bank transfers.",
    category: "bank",
    bankCode: "boa",
    excerpt: "BOA verification is simple with cheki's direct JSON API. No Selenium, no headless browser, just the reference and last 5 digits of your account. QR codes for inter-bank transfers.",
    date: "2026-06-18",
    readTime: "3 min",
    content: [
      { type: "text", text: "Bank of Abyssinia (BOA) is one of Ethiopia's largest private banks. BOA publishes receipt data as JSON via a public API endpoint. cheki uses this API directly, without requiring Selenium or a headless browser like some other libraries." },

      { type: "heading", text: "What you need" },
      { type: "list", items: [
        "Transaction reference number (required for API lookup), alphanumeric, typically starts with 2 letters",
        "Last 5 digits of your receiving BOA account number (required for API lookup)",
        "QR code payload (alternative for inter-bank transfers), the encrypted string shown when scanning the QR code",
      ]},

      { type: "heading", text: "Step-by-step verification" },
      {
        type: "steps",
        items: [
          { title: "Get the transaction reference", text: "Ask the customer for the reference number from their BOA receipt." },
          { title: "Get your account's last 5 digits", text: "You need the last 5 digits of your receiving BOA account. For example, if your account is 1234567890, the last 5 digits are 67890." },
          { title: "Enter both in cheki", text: "Select BOA from the bank dropdown, enter the reference, and enter the account digits." },
          { title: "Click Verify", text: "cheki calls BOA's JSON API and returns structured payment data in 1-2 seconds." },
          { title: "For inter-bank transfers, use the QR code", text: "If BOA's API returns 'Invalid reference number' (common for transfers sent to CBE or other banks), scan the QR code on the receipt. cheki auto-detects BOA QR payloads, decrypts them server-side with AES-256-CBC, and returns the full transaction details. No account number needed. See our BOA QR code breakdown for the full technical details." },
        ],
      },

      { type: "callout", variant: "tip", title: "No Selenium required", text: "Unlike the ethiobank_receipts Python library which requires Chrome WebDriver for BOA, cheki uses BOA's JSON API directly. This works in serverless environments without browser dependencies." },
      { type: "callout", variant: "tip", title: "QR codes work for inter-bank transfers", text: "BOA's online slip API does not recognize inter-bank transfer references (e.g., FT... sent to CBE). The QR code on the receipt is an AES-256-CBC encrypted payload containing the full transaction details. cheki decrypts it server-side, so QR-based verification works even when the API lookup fails. Read the BOA QR code breakdown for encryption details." },

      { type: "heading", text: "Verifying via API" },
      { type: "text", text: "Use the reference and account digits for normal BOA-to-BOA transfers:" },
      { type: "code", lang: "bash", code: 'curl -X POST https://chekiapp.vercel.app/api/verify \\\n  -H "Content-Type: application/json" \\\n  -d \'{"bank":"boa","reference":"AB12345678","accountNumber":"67890"}\'' },
      { type: "text", text: "For inter-bank transfers, pass the QR code payload instead (reference is optional):" },
      { type: "code", lang: "bash", code: 'curl -X POST https://chekiapp.vercel.app/api/verify \\\n  -H "Content-Type: application/json" \\\n  -d \'{"bank":"boa","qrData":"3cHRaxVjn/pySp..."}\'' },

      { type: "heading", text: "What the receipt contains" },
      { type: "list", items: [
        "Source account name (sender)",
        "Source account number",
        "Receiver's name",
        "Receiver's account",
        "Transferred amount in ETB",
        "Transaction date",
        "Transaction reference",
      ]},

      { type: "heading", text: "Two verification methods" },
      {
        type: "table",
        headers: ["Method", "When to use", "Needs account digits", "Speed"],
        rows: [
          ["JSON API (reference + account)", "BOA-to-BOA transfers", "Yes (last 5)", "~1-2s"],
          ["QR code decryption", "Inter-bank transfers (BOA to CBE/Dashen/etc.)", "No", "~500ms"],
        ],
      },
      { type: "text", text: "For a full technical breakdown of how BOA QR codes work (AES-256-CBC encryption, CryptoJS format, key derivation, security implications), see our BOA QR code breakdown." },
    ],
    faq: [
      { q: "Does BOA verification require Selenium?", a: "No. cheki uses BOA's JSON API directly at cs.bankofabyssinia.com. This is faster and works in serverless environments without Chrome WebDriver." },
      { q: "Why does BOA need the last 5 digits?", a: "BOA's API endpoint combines the transaction reference with the last 5 digits of the receiving account to form the full ID. This prevents unauthorized receipt enumeration." },
      { q: "What if BOA's API returns 'Invalid reference number'?", a: "This happens for inter-bank transfers (e.g., FT... references sent to CBE). In that case, scan the QR code on the receipt and send the payload in the qrData field. cheki decrypts it with AES-256-CBC using the key embedded in BOA's receipt app. See the BOA QR code breakdown for details." },
      { q: "Is QR-based verification secure?", a: "The key is hardcoded in BOA's public receipt web app, which means anyone can decrypt QR codes (and forge them). For high-value inter-bank transfers, request additional confirmation. See our BOA QR code breakdown for the full security analysis." },
      { q: "Can I verify inter-bank BOA transfers without the QR code?", a: "No. BOA's JSON API does not recognize inter-bank transfer references. The QR code is the only way to verify these transactions. If you don't have the QR code, ask the sender for a screenshot of the receipt or check your bank statement for the incoming transfer." },
    ],
    related: ["boa-qr-code-receipts", "how-to-verify-cbe-receipt", "how-to-verify-telebirr-receipt", "ethiopian-bank-receipt-formats"],
    seo: {
      title: "How to Verify a Bank of Abyssinia (BOA) Receipt",
      description: "Verify Bank of Abyssinia transactions for free with cheki. No Selenium needed, just the reference number and last 5 digits of your account. QR codes supported for inter-bank transfers.",
      keywords: ["verify BOA receipt", "Bank of Abyssinia verify", "BOA transaction check", "verify Abyssinia bank receipt", "BOA online slip", "BOA QR verification"],
    },
  },
  {
    slug: "contribute-new-bank",
    title: "How to Add a New Bank to cheki (Community Guide)",
    description:
      "cheki supports 31 Ethiopian banks but only 9 are live. Here's how you can help add the rest. No coding required, just share a receipt. For developers: how to write a parser and submit a PR.",
    category: "open-source",
    excerpt:
      "18 Ethiopian banks still need receipt endpoints. You can help by sharing a receipt, writing a parser, or reporting broken endpoints. Here's the complete community contribution guide.",
    date: "2026-06-19",
    readTime: "5 min",
    content: [
      { type: "text", text: "cheki lists 31 Ethiopian banks and wallets, but only 9 are live. The remaining 22 are listed as 'in development' because we haven't confirmed their public receipt endpoints yet. This is where the community comes in." },

      { type: "callout", variant: "tip", title: "No coding required", text: "The most valuable contribution is a receipt. If you use a bank we don't support yet, share a receipt screenshot or URL and we'll do the technical work." },

      { type: "heading", text: "Option 1: Share a receipt (easiest)" },
      { type: "text", text: "If you have a receipt from a bank marked 'Soon' on cheki, here's what we need:" },
      {
        type: "list",
        items: [
          "A screenshot of the full receipt (or the receipt URL if the bank has a share feature)",
          "The QR code on the receipt (if there is one), scan it with any QR reader and send us the decoded text",
          "The transaction reference number",
          "The bank name",
        ],
      },
      { type: "text", text: "Send it via GitHub (open an issue with the 'new-bank' label) or via Telegram. We'll reverse-engineer the endpoint and add the bank to cheki, usually within a day." },
      { type: "callout", variant: "warning", title: "Privacy", text: "Redact or blur sensitive information like full account numbers before sharing. We only need the receipt structure, the reference number, and the QR code payload, not your full account details." },

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
          ["Live", "9", "CBE, Telebirr, BOA, M-Pesa, Dashen, Zemen, CBE Birr, Siinqee, eBirr"],
          ["Via eBirr (ready)", "4", "Nib International, Wegagen, Ahadu, KAAFI"],
          ["Researching", "18", "Abay, Addis, Amhara, Berhan, Bunna, Enat, Global, Lion, Oromia Int'l, Hibret, ZamZam, Hijra, Shabelle, Goh Betoch, Tsedey, Gadaa, Rammis, DBE"],
        ],
      },

      { type: "heading", text: "Why community matters for Ethiopian fintech" },
      { type: "text", text: "Ethiopia has 30+ licensed banks, but most receipt verification services (check.et, verify.et, qbirr, tinaverify) only support 6-10. The long tail of smaller and newer banks gets ignored because it's not profitable enough for paid services." },
      { type: "text", text: "Open source changes this. Every contribution, whether it's a receipt screenshot or a full parser, helps cover a bank that paid services won't bother with. The community can move faster than any single company." },
      { type: "callout", variant: "success", title: "Every receipt counts", text: "Even one receipt from a bank we don't support can unlock verification for every cheki user. You don't need to write code to make a difference." },
    ],
    faq: [
      { q: "Do I need to know how to code to contribute?", a: "No. The most valuable contribution is a receipt from a bank we don't support yet. Send us a screenshot or URL and we'll handle the technical work." },
      { q: "Is it safe to share my receipt?", a: "Redact or blur your full account number before sharing. We only need the receipt structure, reference number, and QR code payload. Never share your PIN, password, or OTP." },
      { q: "How long does it take to add a new bank?", a: "If we have a receipt to reverse-engineer, usually within a day. If a developer submits a complete parser with tests, we merge it the same day." },
      { q: "Can I add a bank that no verification service supports?", a: "Yes. That's the whole point. If you find the receipt endpoint, we'll add it. cheki is the only verification tool that lists all 31 Ethiopian banks, not just the profitable ones." },
      { q: "What if a bank doesn't have a public receipt endpoint?", a: "Some banks may not have receipt sharing yet. In that case, we list them as 'researching' and wait until they launch a digital receipt system. We don't fake it." },
    ],
    related: ["open-source-ethiopian-fintech", "ethiopian-bank-receipt-formats", "self-hosting-docker-guide"],
    seo: {
      title: "How to Add a New Bank to cheki (Community Guide)",
      description: "Help cheki support all Ethiopian banks. Share a receipt, write a parser, or report broken endpoints. No coding required to contribute.",
      keywords: ["cheki contribute", "add bank to cheki", "ethiopian bank receipt endpoint", "open source ethiopian fintech", "cheki community", "help add banks"],
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
