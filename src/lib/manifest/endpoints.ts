/**
 * Endpoint reference data, one entry per manifest bank.
 *
 * banks.json stays the source of truth for the endpoint template, status,
 * response type, geo-blocking and input fields. This file adds what a
 * contributor needs on top (where to find each placeholder, traps, the
 * unknown-reference error shape, gotchas, a dated changelog) plus the probe
 * the daily health check sends. Both the /endpoints page and
 * scripts/health-check.ts read it, and tests/manifest/endpoints.test.ts fails
 * when a manifest bank has no entry here, so the docs cannot drift.
 */
import { getAllBanks } from "./loader";
import type { BankManifestEntry } from "../core/types";

export interface PlaceholderDoc {
  /** Placeholder as written in the template, e.g. "{REFERENCE}". */
  name: string;
  what: string;
  whereToFind: string;
  /** Length and character pattern. */
  format: string;
  traps?: string;
  /** False when the format is not proven against a real receipt. */
  confirmed?: boolean;
}

export interface ProbeExpectation {
  status?: number;
  /** Substring of the Content-Type header. */
  contentType?: string;
  /** Every string must appear in the body. */
  bodyIncludes?: string[];
}

export interface ProbeSpec {
  /** Parser whose buildUrl makes the probe URL (defaults to the bank id). */
  parser?: string;
  ref: string;
  account?: string;
  phone?: string;
  /** Use the manifest headers for this bank (e.g. CBE QR receipts). */
  useManifestHeaders?: boolean;
  expect: ProbeExpectation;
  /** Where and when the shape was observed. */
  observed: string;
}

export interface EndpointDoc {
  id: string;
  /** Display label in the status table and card heading. Empty means the manifest shortName. */
  label: string;
  inputNeeded: string;
  /** The contribute box asks for the full share link first. */
  preferLink?: boolean;
  /** Overrides the manifest response type label when it is not settled. */
  responseTypeLabel?: string;
  placeholders: PlaceholderDoc[];
  redactedExample?: string;
  fieldsParsed: string[];
  unknownRef: string;
  gotchas: string[];
  changelog: { date: string; note: string }[];
  /** Repo-relative paths. */
  parserSource?: string;
  fixture?: string;
  /** Probe for the health check, or why there is none. */
  probe: ProbeSpec | { skip: "no-endpoint" };
}

const EBIRR_FIELDS = ["senderName", "senderAccount", "receiverName", "receiverAccount", "amount", "currency", "date", "reference"];
const NOT_FOUND_PAGE = { status: 200, contentType: "text/html", bodyIncludes: ["Not Found Page"] };

function ebirrTenant(id: string, label: string, tenant: string): EndpointDoc {
  return {
    id,
    label,
    inputNeeded: "Receipt link (tenant/token)",
    preferLink: true,
    placeholders: [
      {
        name: "{token}",
        what: `The ${label} receipt token on the shared eBirr platform (tenant "${tenant}").`,
        whereToFind: "The receipt link in the SMS or the share button in the app. It is the last path segment.",
        format: "Alphanumeric, length not yet confirmed.",
        confirmed: false,
      },
    ],
    redactedExample: `https://receipt.ebirr.com/${tenant}/XXXXXXXXXXXX`,
    fieldsParsed: EBIRR_FIELDS,
    unknownRef: 'HTTP 200 text/html, a short page with "Not Found Page".',
    gotchas: [
      "An unknown token still returns HTTP 200, so the parser must check the page body.",
      `The tenant route exists, but the ${label} receipt layout is not confirmed with a real receipt yet.`,
    ],
    changelog: [],
    parserSource: "src/lib/parsers/ebirr.ts",
    fixture: "tests/parsers/ebirr.test.ts",
    probe: {
      parser: "ebirr",
      ref: `${tenant}/chekiprobe000000`,
      expect: NOT_FOUND_PAGE,
      observed: "Oregon, US, 2026-10-10",
    },
  };
}

function unknownBank(id: string): EndpointDoc {
  return {
    id,
    label: "",
    inputNeeded: "Unknown",
    placeholders: [],
    fieldsParsed: [],
    unknownRef: "Unknown. No public receipt endpoint is known yet.",
    gotchas: ["We have not found a public receipt link for this bank. A shared receipt link or QR code is the fastest way to find one."],
    changelog: [],
    probe: { skip: "no-endpoint" },
  };
}

export const endpointDocs: EndpointDoc[] = [
  {
    id: "cbe",
    label: "CBE",
    inputNeeded: "FT reference + last 8 digits of the receiving account",
    placeholders: [
      {
        name: "{REFERENCE}",
        what: "The CBE FT transaction reference.",
        whereToFind: 'On the receipt as "Reference No. (VAT Invoice No)", and in the CBE SMS.',
        format: '12 characters: "FT" plus 10 letters and digits, e.g. FT26140P01YB.',
      },
      {
        name: "{LAST_8_DIGITS_OF_ACCOUNT}",
        what: "The last 8 digits of the receiving (credit) account.",
        whereToFind: "The receiver's account number on the receipt, or your own account if you received the money.",
        format: "8 digits, appended directly after the reference with no separator.",
        traps: "The payer's account does not work. Only the receiving account matches.",
      },
    ],
    redactedExample: "https://apps.cbe.com.et:100/?id=FT26140P01YBXXXXXXXX",
    fieldsParsed: ["senderName", "senderAccount", "receiverName", "receiverAccount", "amount", "currency", "date", "reference", "branch", "reason"],
    unknownRef: 'HTTP 404 text/html, "You Are Not Allowed to See This Data, Please Check your Link" (no PDF).',
    gotchas: [
      "Runs on port 100 with a certificate that does not verify, so the client skips TLS verification.",
      "Slow. cheki allows 30 seconds for this endpoint.",
      "Newer CBE receipts share a QR link on mbreciept.cbe.com.et, which uses the CBE QR endpoint below.",
    ],
    changelog: [],
    parserSource: "src/lib/parsers/cbe.ts",
    fixture: "tests/parsers/cbe.test.ts",
    probe: {
      ref: "FT00000CHEKI0",
      account: "00000000",
      expect: { status: 404, bodyIncludes: ["You Are Not Allowed to See This Data"] },
      observed: "Oregon, US, 2026-10-10",
    },
  },
  {
    id: "cbe-new",
    label: "CBE (QR receipts)",
    inputNeeded: "Receipt ID from the mbreciept.cbe.com.et link",
    placeholders: [
      {
        name: "{ref}",
        what: "The receipt ID in a CBE QR receipt link.",
        whereToFind: "Scan the QR code on a newer CBE receipt. The link is mbreciept.cbe.com.et/{id}; the ID is the last path segment.",
        format: "Opaque token, length varies.",
        confirmed: false,
      },
    ],
    redactedExample: "https://mbreciept.cbe.com.et/XXXXXXXXXXXX",
    fieldsParsed: ["senderName", "senderAccount", "receiverName", "receiverAccount", "amount", "currency", "date", "reference", "reason"],
    unknownRef: 'HTTP 500 application/problem+json, detail "Security Alert: Invalid or tampered legacy token!".',
    gotchas: [
      "Requires the X-App-ID and X-App-Version headers. Without them the API answers HTTP 400 \"Missing Headers\".",
      "Not a separate bank page. cheki routes mbreciept links here automatically.",
    ],
    changelog: [],
    parserSource: "src/lib/parsers/cbe.ts",
    fixture: "tests/parsers/cbe.test.ts",
    probe: {
      ref: "chekiprobe000",
      useManifestHeaders: true,
      expect: { status: 500, contentType: "json", bodyIncludes: ["Invalid or tampered legacy token"] },
      observed: "Oregon, US, 2026-10-10",
    },
  },
  {
    id: "telebirr",
    label: "Telebirr",
    inputNeeded: "Transaction number",
    placeholders: [
      {
        name: "{REFERENCE}",
        what: "The Telebirr transaction number.",
        whereToFind: "In the Telebirr SMS sent to payer and receiver, and on the in-app receipt.",
        format: "10 characters: a 2 or 3 letter prefix (DET, CHQ, DAB, DEL, ADQ, ...) plus letters and digits, e.g. DET8FJGUJ4.",
      },
    ],
    redactedExample: "https://transactioninfo.ethiotelecom.et/receipt/DETXXXXXXX",
    fieldsParsed: ["senderName", "senderAccount", "receiverName", "receiverAccount", "amount", "currency", "date", "reference", "invoiceNumber", "transactionStatus", "settledAmount", "stampDuty", "discountAmount", "serviceFee", "serviceFeeVat", "totalPaid", "amountInWords", "paymentMode", "paymentChannel", "reason", "bankAccountNumber", "bankAccountName"],
    unknownRef: "Not checked from CI. The endpoint only answers Ethiopian IP addresses.",
    gotchas: ["Geo-blocked: requests from outside Ethiopia time out or are refused. cheki shows the official link as a fallback."],
    changelog: [],
    parserSource: "src/lib/parsers/telebirr.ts",
    fixture: "tests/parsers/telebirr-mpesa.test.ts",
    probe: { ref: "DET0CHEKI0", expect: {}, observed: "not observed (geo-blocked)" },
  },
  {
    id: "boa",
    label: "BOA",
    inputNeeded: "Reference + last 5 digits of the receiving account",
    placeholders: [
      {
        name: "{REFERENCE}",
        what: "The Bank of Abyssinia transaction reference.",
        whereToFind: "On the BOA receipt or slip link (cs.bankofabyssinia.com/slip/?trx=...). Inter-bank transfers use an FT reference.",
        format: "Letters and digits, starting with 2 letters, e.g. FT252003JZPP.",
      },
      {
        name: "{LAST_5_DIGITS}",
        what: "The last 5 digits of the receiving account.",
        whereToFind: "The receiver's account number on the receipt.",
        format: "5 digits, appended directly after the reference.",
      },
    ],
    redactedExample: "https://cs.bankofabyssinia.com/api/onlineSlip/getDetails/?id=FT252003JZPPXXXXX",
    fieldsParsed: ["senderName", "senderAccount", "receiverName", "receiverAccount", "amount", "currency", "date", "reference"],
    unknownRef: 'HTTP 200 application/json with body[0]["Payer\'s Name"] = "Invalid reference number".',
    gotchas: ["A miss still returns HTTP 200, so the parser must read the body."],
    changelog: [],
    parserSource: "src/lib/parsers/boa.ts",
    fixture: "tests/parsers/boa.test.ts",
    probe: {
      ref: "FT00000CHEKI",
      account: "00000",
      expect: { status: 200, contentType: "json", bodyIncludes: ["Invalid reference number"] },
      observed: "Oregon, US, 2026-10-10",
    },
  },
  {
    id: "mpesa",
    label: "M-Pesa",
    inputNeeded: "Transaction number",
    placeholders: [
      {
        name: "{REFERENCE}",
        what: "The M-Pesa Ethiopia transaction number (trxNo).",
        whereToFind: "In the M-Pesa SMS confirmation.",
        format: "Letters and digits, typically 2 letters followed by 6 or more characters.",
        confirmed: false,
      },
    ],
    redactedExample: "https://m-pesabusiness.safaricom.et/api/receipt/getReceipt?trxNo=SEXXXXXXXX",
    fieldsParsed: ["senderName", "receiverName", "amount", "currency", "date", "reference"],
    unknownRef: "Not checked from CI. The endpoint only answers Ethiopian (and some Kenyan) IP addresses.",
    gotchas: ["Geo-blocked: requests from outside Ethiopia time out or are refused."],
    changelog: [],
    parserSource: "src/lib/parsers/mpesa.ts",
    fixture: "tests/parsers/telebirr-mpesa.test.ts",
    probe: { ref: "SE0CHEKI00", expect: {}, observed: "not observed (geo-blocked)" },
  },
  {
    id: "dashen",
    label: "Dashen",
    inputNeeded: "FT Ref",
    placeholders: [
      {
        name: "{REFERENCE}",
        what: "The Dashen FT Ref.",
        whereToFind: 'In the Dashen app it is labelled "FT Ref". On the web receipt it is labelled "Transaction Reference".',
        format: "16 characters, letters and digits, e.g. B22WDTI2619100WH.",
        traps: 'The app also shows a longer "Transaction Ref" or "Transfer Reference" (WDTI... or OBTI...). The endpoint rejects it. Use the FT Ref.',
      },
    ],
    redactedExample: "https://receipts.dashenbanksc.com/receipt/B22WDTIXXXXXXXXX",
    fieldsParsed: ["senderName", "senderAccount", "receiverName", "receiverAccount", "amount", "currency", "date", "reference", "reason"],
    unknownRef: 'HTTP 400 application/json, {"statusCode":400,"message":"Transaction not found"}.',
    gotchas: [
      "The old host receipt.dashensuperapp.com now returns 502 Bad Gateway. Old PDF links on api.dashensuperapp.com are still detected and routed to the new host.",
      "The live endpoint returns an HTML receipt, not a PDF.",
    ],
    changelog: [{ date: "2026-10-10", note: "Moved from receipt.dashensuperapp.com (PDF, now 502) to receipts.dashenbanksc.com (HTML). FT Ref is the only accepted reference." }],
    parserSource: "src/lib/parsers/dashen.ts",
    fixture: "tests/parsers/dashen.test.ts",
    probe: {
      ref: "CHEKIPROBE000000",
      expect: { status: 400, contentType: "json", bodyIncludes: ["Transaction not found"] },
      observed: "Oregon, US, 2026-10-10",
    },
  },
  {
    id: "awash",
    label: "Awash",
    inputNeeded: "Share link from the SMS",
    placeholders: [
      {
        name: "{BASE36_TRANSACTION_ID}",
        what: "The Awash Transaction ID written in base 36.",
        whereToFind: "The first segment after the dash in the share link from the Awash SMS.",
        format: "About 10 characters, digits and capital letters. The decoded ID is 15 digits (YYMMDDHHMM plus a 5 digit sequence).",
      },
      {
        name: "{COUNTER_TOKEN}",
        what: "A server counter issued when the receipt is shared.",
        whereToFind: "The second segment of the share link.",
        format: "About 6 characters, base 36.",
        traps: "It cannot be derived from the Transaction ID, so a bare Transaction ID is not enough. Paste the full link.",
      },
    ],
    redactedExample: "https://awashpay.awashbank.com:8225/-2KDLXXXXXX-4UXXXX",
    fieldsParsed: ["senderName", "senderAccount", "receiverName", "receiverAccount", "amount", "currency", "date", "reference", "branch", "reason", "transactionType"],
    unknownRef: 'HTTP 200 text/html, a short page reading "Receipt not found".',
    gotchas: ["Port 8225 with a certificate that does not verify.", "Sits behind an F5 BIG-IP WAF; aggressive retries can get blocked."],
    changelog: [],
    parserSource: "src/lib/parsers/awash.ts",
    fixture: "tests/fixtures/awash",
    probe: {
      ref: "CHEKIPROBE-000000",
      expect: { status: 200, contentType: "text/html", bodyIncludes: ["Receipt not found"] },
      observed: "Oregon, US, 2026-10-10",
    },
  },
  {
    id: "zemen",
    label: "Zemen",
    inputNeeded: "Full share link (preferred)",
    preferLink: true,
    responseTypeLabel: "PDF (expected)",
    placeholders: [
      {
        name: "{REFERENCE}",
        what: "The token in a Zemen share link, share.zemenbank.com/rt/{token}/pdf.",
        whereToFind: "Use the share button on the Zemen receipt and paste the whole link. cheki reads the token from the path.",
        format: "Unconfirmed. links.et docs describe a 24 character token (an 8 character prefix plus the 16 character reference). Another open-source app builds the URL from the bare reference. Neither is proven.",
        traps: "A bare reference may not work. Paste the full share link until a real receipt settles the format.",
        confirmed: false,
      },
    ],
    redactedExample: "https://share.zemenbank.com/rt/XXXXXXXXXXXXXXXXXXXXXXXX/pdf",
    fieldsParsed: ["senderName", "senderAccount", "receiverName", "receiverAccount", "amount", "currency", "date", "reference", "reason", "transactionStatus"],
    unknownRef: 'HTTP 404 application/json, {"messages":"Transaction not found.","status":"404"}.',
    gotchas: ["The parser labels come from the expected PDF layout and are not tested on a real receipt yet."],
    changelog: [{ date: "2026-10-10", note: "Marked in development until a real receipt confirms the token format and PDF layout." }],
    parserSource: "src/lib/parsers/zemen.ts",
    probe: {
      ref: "CHEKIPROBE000000",
      expect: { status: 404, contentType: "json", bodyIncludes: ["Transaction not found."] },
      observed: "Oregon, US, 2026-10-10",
    },
  },
  {
    id: "cbebirr",
    label: "CBE Birr",
    inputNeeded: "Receipt number + payer phone",
    responseTypeLabel: "PDF or HTML (unconfirmed)",
    placeholders: [
      {
        name: "{REFERENCE}",
        what: "The CBE Birr receipt number (TID).",
        whereToFind: "On the CBE Birr receipt and in the confirmation SMS.",
        format: "10 letters and digits according to another open-source verifier's parser. Unconfirmed here.",
        confirmed: false,
      },
      {
        name: "{PAYER_PHONE}",
        what: "The phone number of the wallet that paid.",
        whereToFind: "Ask the payer, or read it from the SMS.",
        format: "12 digits starting with 2519, e.g. 2519XXXXXXXX.",
        traps: "The receiver's phone does not work.",
      },
    ],
    redactedExample: "https://cbepay1.cbe.com.et/aureceipt?TID=XXXXXXXXXX&PH=2519XXXXXXXX",
    fieldsParsed: ["senderName", "senderAccount", "receiverName", "receiverAccount", "orderId", "transactionStatus", "reference", "date", "amount", "serviceFee", "serviceFeeVat", "totalPaid", "reason", "paymentChannel"],
    unknownRef: 'HTTP 200 text/html: an empty Telerik ReportViewer shell titled "Auto Receipt" with no transaction data.',
    gotchas: [
      "A miss still returns HTTP 200 (the Telerik shell). Only the labels tell a real receipt apart.",
      "Another open-source verifier reads real receipts as a PDF with labels Debit Account, Credit Account, Receiver Name, Order ID, Transaction Status, Reference, Receipt Number, Paid amount, Service charge, VAT, Total Paid Amount, Payment Reason and Payment Channel. cheki accepts PDF or HTML until a real receipt confirms which.",
    ],
    changelog: [
      { date: "2026-10-10", note: "Marked in development until tested on a real receipt." },
      { date: "2026-10-10", note: "Parser reads PDF or HTML using the real receipt labels." },
    ],
    parserSource: "src/lib/parsers/cbebirr.ts",
    fixture: "tests/parsers/cbebirr.test.ts",
    probe: {
      ref: "CHEKIPROBE",
      phone: "251900000000",
      expect: { status: 200, contentType: "text/html", bodyIncludes: ["Auto Receipt", "ReportViewer"] },
      observed: "Oregon, US, 2026-10-10",
    },
  },
  {
    id: "siinqee",
    label: "Siinqee",
    inputNeeded: "Receipt link (tenant/token)",
    placeholders: [
      {
        name: "{token}",
        what: "The Siinqee receipt token on the shared eBirr platform.",
        whereToFind: "The receipt link in the SMS. It is the last path segment.",
        format: "Alphanumeric, length not yet confirmed.",
        confirmed: false,
      },
    ],
    redactedExample: "https://receipt.ebirr.com/siinqee/XXXXXXXXXXXX",
    fieldsParsed: EBIRR_FIELDS,
    unknownRef: 'Expected like other eBirr tenants: HTTP 200 text/html "Not Found Page".',
    gotchas: ['On 2026-10-10 the siinqee route answered HTTP 404 text/plain "Cannot GET /siinqee/...", unlike other eBirr tenants. The tenant name may have changed. A real Siinqee receipt link would settle it.'],
    changelog: [],
    parserSource: "src/lib/parsers/siinqee.ts",
    fixture: "tests/parsers/ebirr.test.ts",
    probe: { ref: "chekiprobe000000", expect: NOT_FOUND_PAGE, observed: "expected; Oregon, US, 2026-10-10 saw 404 Cannot GET" },
  },
  {
    ...ebirrTenant("ebirr", "eBirr", "nib"),
    inputNeeded: "Receipt link or tenant/token",
    placeholders: [
      {
        name: "{tenant}",
        what: "The issuing bank on the shared eBirr platform.",
        whereToFind: "The first path segment of the receipt link.",
        format: "One of nib, wegagen, ahadu, kaafimf, siinqee.",
      },
      {
        name: "{token}",
        what: "The receipt token.",
        whereToFind: "The last path segment of the receipt link.",
        format: "Alphanumeric, length not yet confirmed.",
        confirmed: false,
      },
    ],
    redactedExample: "https://receipt.ebirr.com/nib/XXXXXXXXXXXX",
    gotchas: ["An unknown token still returns HTTP 200, so the parser must check the page body."],
  },
  ebirrTenant("nib", "Nib", "nib"),
  ebirrTenant("wegagen", "Wegagen", "wegagen"),
  ebirrTenant("ahadu", "Ahadu", "ahadu"),
  ebirrTenant("kaafi", "KAAFI", "kaafimf"),
  unknownBank("abay"),
  unknownBank("addis"),
  unknownBank("amhara"),
  unknownBank("berhan"),
  unknownBank("bunna"),
  unknownBank("enat"),
  unknownBank("global"),
  unknownBank("lion"),
  unknownBank("oromia"),
  unknownBank("hibret"),
  unknownBank("zamzam"),
  unknownBank("hijra"),
  unknownBank("shabelle"),
  unknownBank("goh"),
  unknownBank("tsedey"),
  unknownBank("gadaa"),
  unknownBank("rammis"),
];

export const REPO_URL = "https://github.com/1RB/cheki";
export const REPORT_CHANGE_URL = `${REPO_URL}/issues/new?template=bank-request.yml`;

export interface EndpointRow {
  bank: BankManifestEntry;
  doc: EndpointDoc;
}

/** Manifest order, joined with the docs. Banks without docs are dropped (the test catches them). */
export function getEndpointRows(): EndpointRow[] {
  const byId = new Map(endpointDocs.map((d) => [d.id, d]));
  return getAllBanks()
    .flatMap((bank) => {
      const doc = byId.get(bank.id);
      if (!doc) return [];
      return [{ bank, doc: { ...doc, label: doc.label || bank.shortName || bank.name } }];
    });
}

export function getEndpointDoc(id: string): EndpointDoc | undefined {
  return endpointDocs.find((d) => d.id === id);
}

export function isGeoRestricted(bank: BankManifestEntry): boolean {
  return bank.geoBlocked === true;
}
