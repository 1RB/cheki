/**
 * The extra sections and FAQs on /banks/[code], beyond what the manifest
 * gives every bank page (required information, reference format, the how-to
 * steps, the endpoint, use cases, the API call).
 *
 * The bank page is the one URL for every bank-specific search: "verify a CBE
 * receipt", "check a CBE payment", "fake CBE receipt", "CBE receipt format".
 * The pages that used to compete for those searches (/verify/verify-X-receipt-
 * online, /verify/check-X-payment-online, /verify/fake-X-receipt-detection,
 * /verify/X-receipt-format-explained, /guides/how-to-verify-X-receipt) now
 * 301 here (next.config.ts, src/lib/seo-redirects.ts), and their distinct
 * content lives in this file.
 */
import { formatNeeds, primaryFormat } from "./manifest/formats";
import type { Bank } from "./banks";
import { NO_SIGNUP_SENTENCE, competitorPrices } from "./guides-facts";
import { BANK_HEADING, BANKS_WITH_TOPIC_PAGES } from "./seo-redirects";
import { withArticle } from "./indefinite-article";
import { swiftFaq } from "./swift";

export interface BankFaq {
  q: string;
  a: string;
}

export interface BankSection {
  /** Stable id for the h2, when other pages or redirects link to it. */
  id?: string;
  heading: string;
  body?: string;
  bullets?: string[];
  /** Numbered steps, rendered as an ordered list. */
  steps?: string[];
  /** One internal link under the section. */
  link?: { href: string; text: string };
}

// ─── Helpers ──────────────────────────────────────────────────────

/** What a receipt is served as, for copy ("JSON response", "PDF document inside a JSON response"). */
export function receiptTypeLabel(b: Pick<Bank, "responseType">): string {
  if (b.responseType === "pdf") return "PDF document";
  if (b.responseType === "pdf-in-json") return "PDF document inside a JSON response (base64)";
  if (b.responseType === "json") return "JSON response";
  return "HTML page";
}

/** How the bank's current format is asked for ("receipt ID or receipt link", "FT Ref", "transaction number"). */
function refNoun(b: Bank): string {
  const label = primaryFormat(b)?.inputs[0]?.label;
  if (!label) return "transaction reference number";
  return /^[A-Z][a-z]/.test(label) ? label.charAt(0).toLowerCase() + label.slice(1) : label;
}

/**
 * What a confirmed check shows, for copy. Most banks return both parties;
 * ZamZam's record names only its own account holder (the other side only
 * sometimes), so its copy must not promise a sender and a receiver.
 */
const SHOWN_OVERRIDE: Record<string, string> = {
  zamzam: "the amount, the date and the ZamZam account holder (account number masked)",
};
function whatItShows(b: Bank): string {
  return SHOWN_OVERRIDE[b.code] ?? "the sender name, receiver name, amount, and date";
}

/**
 * The line under "What you need to verify X receipt": where the inputs come
 * from, and whether an account number is needed. It replaces the "What
 * information you need" section the check-payment page brought, which listed
 * the same inputs a second time. Only live banks have a checker to feed.
 */
export function requiredInfoIntro(b: Bank): string | null {
  if (b.status !== "live") return null;
  const primary = primaryFormat(b);
  const needsAccount = primary ? formatNeeds(primary, "account") : Boolean(b.requiresAccount);
  return needsAccount
    ? `Ask the sender for the ${refNoun(b)} and the account digits from their receipt: ${b.shortName}'s receipt record needs both.`
    : `Ask the sender for the ${refNoun(b)} from their receipt. No account number is needed.`;
}

/** The headings the bank page renders itself; extra sections never repeat them. */
export function builtInHeadings(b: Bank): string[] {
  return [
    BANK_HEADING.requiredInfo.text(b.shortName),
    "Reference number format",
    BANK_HEADING.howToVerify.text(b.shortName),
    `How ${b.shortName} receipt verification works`,
    `Who uses ${b.shortName} verification`,
    `Verifying ${b.shortName} via API`,
    ...(b.swift ? [`${b.shortName} SWIFT code`] : []),
  ];
}

// ─── Verify pages written by hand (CBE, Telebirr, BOA, M-Pesa) ────

const VERIFY_BY_HAND: Record<string, { sections: BankSection[]; faq: BankFaq[] }> = {
  cbe: {
    faq: [
      { q: "How do I verify a CBE receipt?", a: "Paste the receipt link from the CBE app (mbreciept.cbe.com.et/...) or its Receipt ID, and click Verify. cheki reads the receipt from CBE's own record and shows the sender, receiver, amount and date in a few seconds." },
      { q: "Do I need the account number to verify CBE?", a: "Not for new receipts: the Receipt ID or receipt link is enough. Only an older receipt that shows just an FT reference needs the last 8 digits of the receiving account, and CBE's older receipt service does not always answer." },
      { q: "Is CBE receipt verification free?", a: `Yes. cheki is free. ${NO_SIGNUP_SENTENCE} ${competitorPrices(["check.et"])} cheki uses the same public CBE endpoint but charges nothing.` },
      { q: "Can I verify CBE receipts in bulk?", a: "Yes. Use the POST /api/verify/batch endpoint to verify up to 20 CBE receipts in a single API call. Perfect for end-of-day reconciliation." },
    ],
    sections: [
      {
        heading: "Older CBE receipts (FT reference)",
        body: "Before the share links, CBE receipts were PDFs at apps.cbe.com.et:100, looked up by the FT reference plus the last 8 digits of the receiving account. cheki still accepts that older format, but most receipts now carry a Receipt ID, and the older host is often unreachable, so ask for the receipt link when you can.",
      },
    ],
  },
  telebirr: {
    faq: [
      { q: "How do I verify a Telebirr receipt?", a: "Select Telebirr, paste your transaction reference number, and click Verify. cheki fetches the receipt from Telebirr's public endpoint and shows you the result instantly." },
      { q: "Why does Telebirr verification sometimes fail?", a: "Telebirr's endpoint (transactioninfo.ethiotelecom.et) blocks requests from non-Ethiopian IP addresses. If cheki's server can't reach it, we provide a direct link for you to open the receipt yourself. Self-hosting cheki on an Ethiopian IP bypasses this restriction." },
      { q: "Do I need an account number for Telebirr?", a: "No. Telebirr only requires the transaction reference number. The receipt is returned as an HTML page with payer name, receiver name, amount, and date." },
      { q: "Is Telebirr receipt verification free?", a: `Yes. cheki verifies Telebirr receipts for free. ${NO_SIGNUP_SENTENCE} check.et uses the same endpoint. ${competitorPrices(["check.et"])}` },
    ],
    sections: [
      {
        // The one place the page explains the block: the page drops its own
        // geo-blocked note under "How Telebirr receipt verification works"
        // when this section is there (hasGeoSection).
        id: BANK_HEADING.geoBlocking.id,
        heading: BANK_HEADING.geoBlocking.text("Telebirr"),
        body: "Telebirr's receipt endpoint (transactioninfo.ethiotelecom.et) only answers Ethiopian IP addresses. When cheki's server cannot reach it, cheki gives you the fallback: a direct link to open the receipt yourself in a browser on an Ethiopian network. For reliable verification, self-host cheki on a server with an Ethiopian IP address.",
      },
    ],
  },
  boa: {
    faq: [
      { q: "How do I verify a Bank of Abyssinia receipt?", a: "Paste the BOA slip link and click Verify; when the link carries the 5 account digits, cheki reads both parts from it. Otherwise, select Bank of Abyssinia, paste the transaction reference number and enter the last 5 digits of the account on the receipt. cheki fetches the receipt from BOA's public API and returns structured JSON." },
      { q: "Do I need an account number for BOA?", a: "Not if your BOA slip link carries the 5 account digits after the reference. Otherwise, yes: BOA needs the transaction reference plus the last 5 digits of the account on the receipt. That is not always the receiving account (a fee receipt with no receiver uses the source account). For inter-bank transfers, you can use the QR code payload instead." },
      { q: "Does BOA use an API or PDF?", a: "Bank of Abyssinia uses a JSON API at cs.bankofabyssinia.com. This is faster than CBE's PDF system and returns structured data directly, making it more reliable for automated verification." },
      { q: "What if BOA's API returns 'Invalid reference number'?", a: "Inter-bank transfers (e.g., FT... references sent to CBE) are not exposed in BOA's API. In that case, scan the QR code on the receipt and paste the payload into cheki. cheki decrypts it with the key embedded in BOA's public receipt web app." },
    ],
    sections: [
      {
        heading: "QR code verification for inter-bank transfers",
        body: "BOA's JSON API does not recognize inter-bank transfer references. However, the QR code on the receipt is an AES-256-CBC encrypted payload that carries the reference and the full receiving account. cheki decrypts it server-side using the key exposed in BOA's receipt web app and confirms the receipt with BOA. If BOA cannot be reached, the result is marked as decoded only, not verified.",
        link: { href: "/guides/boa-qr-code-receipts", text: "BOA QR codes: how the decryption works" },
      },
    ],
  },
  mpesa: {
    faq: [
      { q: "How do I verify an M-Pesa Ethiopia receipt?", a: "Select M-Pesa Ethiopia, paste your transaction number, and click Verify. cheki fetches the receipt from Safaricom's API and returns the result." },
      { q: "Why does M-Pesa verification sometimes fail?", a: "M-Pesa's endpoint (m-pesabusiness.safaricom.et) blocks requests from non-Kenyan/Ethiopian IPs. When our server can't reach it, cheki gives you the receipt link to open on your own phone instead." },
      { q: "Do I need an account number for M-Pesa?", a: "No. M-Pesa only requires the transaction number (trxNo). The API returns the receipt as a PDF (inside a JSON response) with the payer, receiver, amount and date. M-Pesa support is in beta until a real receipt confirms cheki's parser." },
    ],
    sections: [
      {
        id: BANK_HEADING.geoBlocking.id,
        heading: BANK_HEADING.geoBlocking.text("M-Pesa"),
        body: "Like Telebirr, M-Pesa's endpoint restricts access to Ethiopian and Kenyan IP addresses. cheki does not try to get around the block: when the endpoint won't answer, it hands you the receipt link to open yourself. For reliable verification, self-host cheki on an Ethiopian server.",
      },
    ],
  },
};

// ─── Verify pages built from the manifest (banks without a hand-written one) ──

function generatedVerify(b: Bank): { sections: BankSection[]; faq: BankFaq[] } {
  return {
    faq: [
      {
        q: `How do I verify ${withArticle(b.shortName)} receipt?`,
        a: b.requiresAccount
          ? `Select ${b.name}, paste your transaction reference number, enter the last ${b.accountDigits} digits of the account on the receipt, and click Verify. cheki fetches the receipt from ${b.shortName}'s public endpoint and shows you the result in seconds.`
          : b.requiresPhone
          ? `Select ${b.name}, paste your transaction reference number and the payer's phone number (2519XXXXXXXXX format), and click Verify. cheki fetches the receipt from ${b.shortName}'s public endpoint and shows you the result instantly.`
          : `Select ${b.name}, paste your transaction reference number, and click Verify. cheki fetches the receipt from ${b.shortName}'s public endpoint and shows you the result instantly.`,
      },
      {
        q: `Do I need an account number to verify ${b.shortName}?`,
        a: b.requiresAccount
          ? `Yes. ${b.shortName}'s receipt endpoint requires the transaction reference plus the last ${b.accountDigits} digits of the account on the receipt. Without the account digits, the endpoint returns no data.`
          : b.requiresPhone
          ? `No account number, but ${b.shortName} requires the payer's phone number (2519XXXXXXXXX format) in addition to the transaction reference. This is a security measure to prevent unauthorized receipt enumeration.`
          : `No. ${b.shortName} only requires the transaction reference number. The receipt is returned as ${withArticle(receiptTypeLabel(b))} with payer name, receiver name, amount, and date.`,
      },
      {
        q: b.geoBlocked ? `Why does ${b.shortName} verification sometimes fail from outside Ethiopia?` : `Is ${b.shortName} receipt verification free?`,
        a: b.geoBlocked
          ? `${b.shortName}'s endpoint (${b.endpoint}) blocks requests from non-Ethiopian IP addresses. If cheki's server can't reach it, we provide a direct link for you to open the receipt yourself. Self-hosting cheki on an Ethiopian IP bypasses this restriction.`
          : `Yes. cheki is free. ${NO_SIGNUP_SENTENCE} ${competitorPrices(["check.et"])} cheki uses the same public ${b.shortName} endpoint but charges nothing.`,
      },
    ],
    // "What you need" is already on the page (What you need to verify X
    // receipt), so the generated pages bring only their FAQs.
    sections: [],
  };
}

/** Live banks whose verify page was generated (no hand-written page). */
const GENERATED_VERIFY = new Set(["dashen", "awash", "siinqee"]);

// ─── "Check a payment" (every live bank) ──────────────────────────

function checkPayment(b: Bank): { sections: BankSection[]; faq: BankFaq[] } {
  const ref = refNoun(b);
  return {
    faq: [
      {
        q: `How do I check if ${withArticle(b.shortName)} payment was successful?`,
        a: `Select ${b.name} on cheki, enter the ${ref}${b.requiresAccount ? ` and the last ${b.accountDigits} digits of the account on the receipt` : ``}, and click Verify. If the payment exists, cheki shows you ${whatItShows(b)}. If it doesn't exist, the payment was not completed or the receipt is fake.`,
      },
      {
        q: `Can I check ${withArticle(b.shortName)} payment without the receipt?`,
        a: b.requiresAccount
          ? `You need the transaction reference number and the last ${b.accountDigits} digits of the account on the receipt. Both are shown on the receipt. Without them, there is no way to look up ${withArticle(b.shortName)} transaction through public endpoints.`
          : `You need the ${ref}. This is shown on the receipt and in the ${b.shortName} app. Without it, there is no way to look up ${withArticle(b.shortName)} transaction through public endpoints.`,
      },
      {
        q: `Is checking ${b.shortName} payments free?`,
        a: `Yes. cheki checks ${b.shortName} payments for free. ${NO_SIGNUP_SENTENCE} ${competitorPrices(["check.et"])} cheki uses the same public ${b.shortName} endpoint.`,
      },
    ],
    sections: [
      {
        heading: `Checking ${b.shortName} payment status`,
        body: `${b.name} publishes transaction data at ${b.endpointFormat}. When someone sends you a payment via ${b.shortName}, a receipt is generated at this URL. cheki fetches the receipt, parses it, and tells you whether ${b.shortName} has the record and what it shows: ${whatItShows(b)}. This takes 2 to 10 seconds.`,
      },
      // No "What information you need" section: it listed the inputs a second
      // time under "What you need to verify X receipt" (requiredInfoIntro).
      {
        heading: `Common ${b.shortName} payment verification scenarios`,
        // No bullets: they would repeat "Who uses X verification" (bank.useCases) word for word.
        body: `${b.shortName} payment verification is used by merchants, delivery services, and businesses across Ethiopia. Common scenarios include confirming a customer has actually paid before releasing goods, verifying a delivery payment before handing over a package, and reconciling end-of-day bank transfers.`,
      },
    ],
  };
}

// ─── From the bank how-to guides ──────────────────────────────────

const HOWTO_EXTRA: Record<string, { sections: BankSection[]; faq: BankFaq[] }> = {
  cbe: {
    sections: [],
    faq: [
      { q: "Can I verify CBE receipts from outside Ethiopia?", a: "Yes. CBE's receipt service answers from anywhere, so the check works abroad too. Unlike Telebirr and M-Pesa, CBE is not geo-blocked." },
    ],
  },
  telebirr: {
    sections: [
      {
        heading: "Telebirr transaction number prefixes",
        body: "A Telebirr transaction number is 10 letters and digits that start with a 2-3 letter prefix. It is sent by SMS to both the payer and the receiver after each transaction, and it is shown on the in-app receipt.",
        bullets: [
          "DET: person-to-person transfer (the most common)",
          "CHQ: cheque-related transaction",
          "DAB: bank account transfer",
          "DEL: merchant payment",
          "ADQ: other transaction types",
        ],
      },
      {
        heading: "Verify from the Telebirr receipt QR code",
        body: "The receipt in the Telebirr app shows a Payment QR Code. It holds the transaction number and nothing else cheki uses: no amount and no names. Anyone who knows a transaction number can make a valid QR for it, so cheki reads the number out of the QR and checks it with Telebirr; a result is verified only when Telebirr's own receipt page confirms it.",
        steps: [
          "Ask the customer for a screenshot of the Telebirr receipt, or have them show it on their phone.",
          "On cheki, upload or paste the screenshot, scan the QR with the camera, or paste the QR text into the receipt field. cheki reads the transaction number in your browser and selects Telebirr.",
          "cheki checks that number with Telebirr exactly as if you had typed it. Telebirr only answers Ethiopian networks, so you may get an 'Open the Telebirr receipt' link to open on your phone instead.",
        ],
      },
      {
        heading: "Verify a payment in the Telebirr app",
        body: "Telebirr has its own check, which reads Ethio Telecom's records directly and works even when outside services are geo-blocked.",
        steps: [
          "Open the Telebirr app and log in.",
          "Tap Accounts, at the bottom right.",
          "Scroll to the bottom of the list and tap Verify Payment.",
          "Enter the transaction number or scan the QR code from the receipt.",
          "Telebirr shows the payment details from its own system.",
        ],
      },
    ],
    faq: [],
  },
  boa: {
    sections: [],
    faq: [
      { q: "Can I verify inter-bank BOA transfers without the QR code?", a: "No. BOA's JSON API does not recognize inter-bank transfer references, so the QR code is the only way cheki can look these up. Without it, ask the sender for a screenshot of the receipt, or check your bank statement for the incoming transfer." },
    ],
  },
};

// ─── Getting or downloading the receipt (PDF) ─────────────────────
//
// Answers "how do I get / download my receipt", which people search for as
// often as "verify". Only what the banks' own pages and cheki's manifest
// confirm: Telebirr's receipt is an HTML page at transactioninfo.ethiotelecom.et
// (receipt number in every confirmation SMS, ethiotelecom.et/telebirr), CBE's
// is the mbreciept.cbe.com.et link the app shares (src/lib/manifest/endpoints.ts).
// Neither bank documents an in-app PDF button, so the app step is phrased as
// "if it offers one" and the PDF comes from the browser's own Save as PDF.

const RECEIPT_DOWNLOAD: Record<string, { section: (b: Bank) => BankSection; faq: BankFaq[] }> = {
  telebirr: {
    section: (b) => ({
      id: BANK_HEADING.download.id,
      heading: BANK_HEADING.download.text(b.shortName),
      body: "Telebirr's official receipt is a web page, not a PDF file: transactioninfo.ethiotelecom.et/receipt/ followed by the transaction number. A PDF is a copy you save from that page.",
      steps: [
        "Find the transaction number. Telebirr sends it in the confirmation SMS after every transaction, and it is on the transaction in the telebirr app's history.",
        "Open the receipt: tap the link in the SMS, or open transactioninfo.ethiotelecom.et/receipt/ followed by the transaction number in a browser. The page only opens on an Ethiopian network.",
        "To keep a PDF, use the browser's Share or Print option and choose Save as PDF. In the telebirr app, use the transaction's share option if it offers one.",
        "When you send proof of payment, send the transaction number or the link, not only the PDF: a PDF or screenshot can be edited, Telebirr's record cannot.",
      ],
    }),
    faq: [
      { q: "How do I download a Telebirr receipt as a PDF?", a: "Open the receipt page from the SMS link (transactioninfo.ethiotelecom.et/receipt/ followed by the transaction number) on an Ethiopian network, then use the browser's Share or Print option and choose Save as PDF. Telebirr has no separate PDF download site: the web page is the official receipt." },
      { q: "How do I get a Telebirr receipt from a transaction number?", a: "Add the transaction number to the end of transactioninfo.ethiotelecom.et/receipt/ and open it on an Ethiopian network, or paste the number into cheki, which reads that same page. Then check that the receiver and the amount are the ones you expected: anyone who has the number can open the receipt." },
    ],
  },
  cbe: {
    section: (b) => ({
      id: BANK_HEADING.download.id,
      heading: BANK_HEADING.download.text(b.shortName),
      body: "Current CBE receipts are shared as a link: mbreciept.cbe.com.et/ followed by the Receipt ID. The CBE mobile banking app creates it when you share a transaction's receipt, and the QR code on the receipt holds the same link.",
      steps: [
        "In the CBE mobile banking app, open the transaction and share its receipt. The shared link is mbreciept.cbe.com.et/ followed by the Receipt ID.",
        "Open the link in any browser to see the receipt on CBE's own site. It opens from outside Ethiopia too.",
        "To keep a PDF, use the browser's Share or Print option and choose Save as PDF, or the app's download option if it offers one.",
        "When you send proof of payment, send the link or the Receipt ID, not only the PDF: a PDF or screenshot can be edited, CBE's record cannot.",
      ],
    }),
    faq: [
      { q: "How do I download a CBE receipt as a PDF?", a: "Share the transaction's receipt from the CBE mobile banking app to get its link (mbreciept.cbe.com.et/ followed by the Receipt ID), open the link in a browser, and use the browser's Share or Print option to save it as a PDF. The link itself is the receipt CBE keeps; the PDF is your copy." },
      { q: "Can I get a CBE receipt from the FT reference?", a: "Not a current one. The Receipt ID cannot be worked out from an FT reference, so ask the sender to share the receipt link from the CBE app. Older receipts can still be looked up by the FT reference plus the last 8 digits of the receiving account, but CBE's older receipt service often does not answer." },
    ],
  },
};

// ─── Receipt format (the five banks that had a format page) ───────

const RECEIPT_FORMAT: Record<string, { body: (b: Bank) => string; fields: string[]; faq: string }> = {
  cbe: {
    body: () =>
      "Current CBE receipts are JSON. The Receipt ID from the mbreciept.cbe.com.et link or QR code is looked up at mb.cbe.com.et, which answers with structured fields and masked account numbers, so there is no PDF to parse. Older receipts were PDF documents at apps.cbe.com.et:100, found by the FT reference plus the last 8 digits of the receiving account.",
    fields: [
      "Transaction reference (FT number)",
      "Transferred amount in ETB",
      "Payer name and account (masked on current receipts)",
      "Receiver name and account (masked on current receipts)",
      "Payment date and time",
      "Payment details or reason; older PDF receipts also show the branch",
    ],
    faq: "Current CBE receipts are JSON, read by Receipt ID from mb.cbe.com.et with masked account numbers. Older receipts were PDFs at apps.cbe.com.et:100, looked up by FT reference plus the last 8 digits of the receiving account; cheki still accepts that legacy format.",
  },
  telebirr: {
    body: (b) =>
      `Telebirr receipts are HTML pages at ${b.endpointFormat}, in English and Amharic. cheki reads the fields out of the page and returns the same JSON shape as every other bank.`,
    fields: [
      "Payer name",
      "Payer Telebirr number",
      "Credited party name (the receiver)",
      "Credited party account number",
      "Amount in ETB",
      "Transaction date and time",
    ],
    faq: "Telebirr publishes each receipt as a bilingual HTML page at transactioninfo.ethiotelecom.et/receipt/{transaction number}, with the payer, the credited party, the amount and the date. The endpoint only answers Ethiopian networks.",
  },
  boa: {
    body: (b) =>
      `BOA answers with JSON from ${b.endpointFormat}: the reference followed by the last 5 digits of the account on the receipt. The QR code on a BOA receipt is something else: an AES-encrypted copy of the same fields, which anyone holding the public key can produce, so cheki still asks BOA before it calls a receipt verified.`,
    fields: [
      "Source account name (the sender)",
      "Source account",
      "Receiver's name",
      "Receiver's account",
      "Transferred amount and currency",
      "Transaction date",
      "Transaction reference",
    ],
    faq: "BOA returns JSON from its online slip API at cs.bankofabyssinia.com, looked up by the reference plus the last 5 digits of the account on the receipt. The receipt QR code is an AES-encrypted copy of the fields, not a link.",
  },
  mpesa: {
    body: (b) =>
      `M-Pesa Ethiopia answers ${b.endpointFormat} with a small JSON envelope, {responseCode, responseDescription, base64Data}, whose base64Data is the receipt PDF. cheki checks the base64, caps the decoded PDF at 5 MB, extracts its text and maps the labelled fields.${b.beta ? " This shape is inferred from other open-source verifiers and is in beta until a real receipt confirms it." : ""}`,
    fields: [
      "Transaction ID and receipt number",
      "Payer name and number",
      "Receiver name and number",
      "Settled amount",
      "Service fee, VAT and total",
      "Payment date",
    ],
    faq: "M-Pesa Ethiopia returns JSON that carries the receipt as a base64-encoded PDF, looked up by transaction number at m-pesabusiness.safaricom.et. M-Pesa support is in beta until a real receipt confirms the layout.",
  },
  dashen: {
    body: (b) =>
      `Dashen receipts are HTML pages at ${b.endpointFormat}, looked up by the 16-character FT Ref (not the longer Transaction Ref). cheki reads the fields from Dashen's own page and returns the same JSON shape as every other bank.`,
    fields: ["Sender name", "Receiver name", "Amount in ETB", "Transaction date", "FT Ref (shown as Transaction Reference on the web receipt)"],
    faq: "Dashen publishes each receipt as an HTML page at receipts.dashenbanksc.com, looked up by the 16-character FT Ref from the Dashen app.",
  },
};

// ─── Fake receipts ────────────────────────────────────────────────

/** Banks whose page carries the fake-receipt section (they had a fraud page or section before). */
const FAKE_SECTION = new Set<string>([...BANKS_WITH_TOPIC_PAGES, "awash", "siinqee"]);

function fakeReceipt(b: Bank): { section: BankSection; faq: BankFaq[] } {
  const s = b.shortName;
  return {
    section: {
      id: BANK_HEADING.fake.id,
      heading: BANK_HEADING.fake.text(s),
      body: `A fake ${s} receipt is one of three things: a receipt ${s} has no record of (a made-up reference on a forged ${b.responseType === "pdf" || b.responseType === "pdf-in-json" ? "PDF" : "receipt page"}), a real receipt with the amount, name or date edited, or a genuine receipt from an earlier payment. Looking at it is not enough. cheki asks ${b.name}'s own receipt record and calls a receipt verified only when ${s} confirms it; then compare what ${s} shows with what you were told. Before you even check, these are warning signs:`,
      bullets: [
        `The reference does not fit ${s}'s format (see Reference number format above)`,
        `The amount, sender or receiver on the screenshot differs from what ${s}'s record shows: the screenshot was edited`,
        "The receipt is days or weeks old: a genuine receipt being reused for a new payment",
        "The sender pushes you to hand over the goods before you can check, or avoids a phone call",
        "A blurry screenshot or photo that is hard to read",
      ],
      link: { href: "/guides/payment-fraud-ethiopia", text: "How to check if a receipt is fake: every fraud tactic and how to catch it" },
    },
    faq: [
      {
        q: `How do I know if ${withArticle(s)} receipt is fake?`,
        a: `Check it against ${s}'s own record. Paste the ${refNoun(b)} into cheki: if ${s} has no record of it, do not accept it. If the record exists but the amount, sender or date differs from what you were shown, the screenshot was edited or the receipt belongs to another payment.`,
      },
      {
        q: `Can someone edit ${withArticle(s)} receipt screenshot?`,
        a: `Yes, in seconds, with any photo editor. The edited screenshot can look real, but ${s}'s record still shows the original amount, names and date. Never accept a screenshot on its own.`,
      },
      {
        q: `What should I do if ${withArticle(s)} receipt is fake?`,
        a: `Do not release the goods. Ask the sender to complete the payment, keep the fake receipt as evidence, and report intentional fraud to ${b.name} and the Ethiopian police.`,
      },
    ],
  };
}

// ─── Assembly ─────────────────────────────────────────────────────

const normQ = (q: string) => q.toLowerCase().replace(/[^a-z0-9]/g, "");

/**
 * The key two FAQs share when they ask the same thing in other words. The
 * folded pages each asked "is it free?", "do I need an account number?" and
 * "why does it fail?" in their own phrasing ("Does CBE charge for receipt
 * verification?", "Is CBE receipt verification free?", "Is checking CBE
 * payments free?"), so de-duplicating by wording alone left three answers to
 * one question on the page and in the FAQPage JSON-LD. The first one (the
 * manifest's, when it has one) is kept.
 */
export function faqTopic(q: string): string {
  if (/^(?:is|does)\b.*\b(?:free|charge)\b/i.test(q)) return "topic:free";
  if (/^(?:do i need|does .+ (?:verification )?require) (?:an|the) account number\b/i.test(q)) return "topic:account-number";
  if (/^why does .+ verification (?:sometimes )?fail\b/i.test(q)) return "topic:fails";
  return normQ(q);
}

export interface BankPageContent {
  /** Sections after the built-in ones, in page order, never repeating a built-in heading. */
  sections: BankSection[];
  /** Every FAQ on the page, manifest first, one per question (faqTopic): the visible list and the FAQPage JSON-LD. */
  faq: BankFaq[];
}

/** True when the bank's extra sections explain geo-blocking, so the page does not say it twice. */
export function hasGeoSection(content: Pick<BankPageContent, "sections">): boolean {
  return content.sections.some((s) => s.id === BANK_HEADING.geoBlocking.id);
}

export function bankPageContent(b: Bank): BankPageContent {
  // The SWIFT code is reference info every bank page with a confirmed code
  // carries, live or not; it goes last so receipt questions lead.
  const swift: BankFaq[] = b.swift ? [swiftFaq(b.name, b.shortName, b.swift)] : [];
  if (b.status !== "live") return { sections: [], faq: [...b.faq, ...swift] };

  const verify = VERIFY_BY_HAND[b.code] ?? (GENERATED_VERIFY.has(b.code) ? generatedVerify(b) : { sections: [], faq: [] });
  const check = checkPayment(b);
  const howto = HOWTO_EXTRA[b.code] ?? { sections: [], faq: [] };
  const format = RECEIPT_FORMAT[b.code];
  const fake = FAKE_SECTION.has(b.code) ? fakeReceipt(b) : null;
  const download = RECEIPT_DOWNLOAD[b.code];

  const formatSection: BankSection[] = format
    ? [{ id: BANK_HEADING.format.id, heading: BANK_HEADING.format.text(b.shortName), body: format.body(b), bullets: format.fields }]
    : [];
  const formatFaq: BankFaq[] = format ? [{ q: `What format does ${b.shortName} use for receipts?`, a: format.faq }] : [];

  const seen = new Set(builtInHeadings(b).map((h) => h.toLowerCase()));
  const sections = [...howto.sections, ...(download ? [download.section(b)] : []), ...verify.sections, ...check.sections, ...formatSection, ...(fake ? [fake.section] : [])].filter((sec) => {
    const key = sec.heading.toLowerCase();
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });

  const seenQ = new Set<string>();
  const faq = [...b.faq, ...verify.faq, ...howto.faq, ...(download?.faq ?? []), ...check.faq, ...formatFaq, ...(fake?.faq ?? []), ...swift].filter((f) => {
    const key = faqTopic(f.q);
    if (seenQ.has(key)) return false;
    seenQ.add(key);
    return true;
  });

  return { sections, faq };
}
