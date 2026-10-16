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
  /** The whole body (trimmed) must be exactly this, e.g. ZamZam's "null" for an unknown id. */
  bodyIs?: string;
}

export interface ProbeSpec {
  /** Parser whose buildUrl makes the probe URL (defaults to the bank id). */
  parser?: string;
  ref: string;
  account?: string;
  phone?: string;
  /** Use the manifest headers for this bank (e.g. CBE QR receipts). */
  useManifestHeaders?: boolean;
  /**
   * Send the parser's own request headers (ZamZam: its public Basic
   * credential, which is kept in the parser, not in banks.json).
   */
  useParserHeaders?: boolean;
  expect: ProbeExpectation;
  /** Where and when the shape was observed. */
  observed: string;
}

export interface LegacyFormatDoc {
  /** Manifest format id. */
  formatId: string;
  placeholders: PlaceholderDoc[];
  redactedExample?: string;
  unknownRef: string;
  /** Probed by the health check as its own row (id "<bank>:<formatId>"); never fails the run. */
  probe?: ProbeSpec;
}

export interface EndpointDoc {
  id: string;
  /** Display label on /status rows and /endpoints panels. Empty means the manifest shortName. */
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
  /** Status notes. Endpoint moves and format switches live in the manifest's endpointHistory. */
  changelog: { date: string; note: string }[];
  /** Another manifest id this entry is a parser alias of (no card of its own on /endpoints). */
  aliasOf?: string;
  /** Docs and health probes for the bank's older formats (manifest formats with status legacy). */
  legacy?: LegacyFormatDoc[];
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
    inputNeeded: "Receipt ID or mbreciept.cbe.com.et link (older receipts: FT reference + last 8 digits of the receiving account)",
    preferLink: true,
    placeholders: [
      {
        name: "{RECEIPT_ID}",
        what: "The CBE Receipt ID: the last part of the receipt link the CBE app shares.",
        whereToFind: "Share the receipt from the CBE app, or scan its QR code. The link is mbreciept.cbe.com.et/{Receipt ID}. cheki reads it through CBE's JSON API at mb.cbe.com.et.",
        format: "Opaque token, letters and digits: fHCx... on v1 receipts, v2-... on newer ones. Length varies (about 18 to 24 characters).",
        traps: "It is not the FT reference. An FT reference sent to this API answers \"Invalid or tampered legacy token\".",
      },
    ],
    redactedExample: "https://mbreciept.cbe.com.et/fHCxXXXXXXXXXXXXXX",
    fieldsParsed: ["senderName", "senderAccount", "receiverName", "receiverAccount", "amount", "currency", "date", "reference", "reason"],
    unknownRef: 'HTTP 500 application/problem+json, detail "Security Alert: Invalid or tampered legacy token!".',
    gotchas: [
      "The JSON API needs the CBE web app's X-App-ID and X-App-Version headers (and cheki also sends its Origin and Referer). Without them it answers HTTP 400 \"Missing Headers\".",
      "Account numbers come back masked (1****1234).",
      "A Receipt ID can't be derived from an FT reference, so an older receipt with only an FT reference needs the legacy format below.",
    ],
    changelog: [],
    legacy: [
      {
        formatId: "cbe-ft-pdf",
        placeholders: [
          {
            name: "{REFERENCE}",
            what: "The CBE FT transaction reference.",
            whereToFind: 'On older receipts as "Reference No. (VAT Invoice No)", and in the CBE SMS.',
            format: '12 characters: "FT" plus 10 letters and digits, e.g. FT26SAMPLE01.',
          },
          {
            name: "{LAST_8_DIGITS_OF_ACCOUNT}",
            what: "The last 8 digits of the receiving (credit) account.",
            whereToFind: "The receiver's account number on the receipt, or your own account if you received the money.",
            format: "8 digits, appended directly after the reference with no separator.",
            traps: "The payer's account does not work. Only the receiving account matches.",
          },
        ],
        redactedExample: "https://apps.cbe.com.et:100/?id=FT26SAMPLE01XXXXXXXX",
        unknownRef: 'HTTP 404 text/html, "You Are Not Allowed to See This Data, Please Check your Link" (seen 2026-10-10; the host is often unreachable).',
        probe: {
          parser: "cbe",
          ref: "FT00000CHEKI0",
          account: "00000000",
          expect: { status: 404, bodyIncludes: ["You Are Not Allowed to See This Data"] },
          observed: "Oregon, US, 2026-10-10; unreachable from cheki's egress 2026-10-11",
        },
      },
    ],
    parserSource: "src/lib/parsers/cbe.ts",
    fixture: "tests/parsers/cbe.test.ts",
    // No parser here: the probe follows CBE's primary (current) format, cbe-new.
    probe: {
      ref: "chekiprobe000",
      useManifestHeaders: true,
      expect: { status: 500, contentType: "json", bodyIncludes: ["Invalid or tampered legacy token"] },
      observed: "Oregon, US, 2026-10-10 (same endpoint as the cbe-new probe)",
    },
  },
  {
    id: "cbe-new",
    label: "CBE (Receipt ID alias)",
    aliasOf: "cbe",
    inputNeeded: "Receipt ID from the mbreciept.cbe.com.et link",
    placeholders: [
      {
        name: "{ref}",
        what: "The CBE Receipt ID. bank=cbe-new is an older alias; bank=cbe picks this format automatically.",
        whereToFind: "The last path segment of a mbreciept.cbe.com.et link.",
        format: "Opaque token, length varies.",
      },
    ],
    redactedExample: "https://mbreciept.cbe.com.et/XXXXXXXXXXXX",
    fieldsParsed: ["senderName", "senderAccount", "receiverName", "receiverAccount", "amount", "currency", "date", "reference", "reason"],
    unknownRef: 'HTTP 500 application/problem+json, detail "Security Alert: Invalid or tampered legacy token!".',
    gotchas: ["Same endpoint as CBE's current format. Documented on the CBE card."],
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
    inputNeeded: "Transaction number, or the Payment QR Code on the receipt",
    placeholders: [
      {
        name: "{REFERENCE}",
        what: "The Telebirr transaction number.",
        whereToFind: "In the Telebirr SMS sent to payer and receiver, and on the in-app receipt. The receipt's Payment QR Code holds it too: scan or upload the QR and cheki reads the number out of it.",
        format: "10 characters: a 2 or 3 letter prefix (DET, CHQ, DAB, DJA, DEL, ADQ, ...) plus letters and digits, e.g. DET0SAMPLE.",
      },
    ],
    redactedExample: "https://transactioninfo.ethiotelecom.et/receipt/DETXXXXXXX",
    fieldsParsed: ["senderName", "senderAccount", "receiverName", "receiverAccount", "amount", "currency", "date", "reference", "invoiceNumber", "transactionStatus", "settledAmount", "stampDuty", "discountAmount", "serviceFee", "serviceFeeVat", "totalPaid", "amountInWords", "paymentMode", "paymentChannel", "reason", "bankAccountNumber", "bankAccountName"],
    unknownRef: "Not checked from CI. The endpoint only answers Ethiopian IP addresses.",
    gotchas: [
      "Geo-blocked: requests from outside Ethiopia time out or are refused. cheki shows the official link as a fallback.",
      "The receipt's Payment QR Code is base64 of a hex string holding TLV data: tag 81 contains tag 00, the transaction number in ASCII; tag 63 is a CRC-16/CCITT-FALSE over the characters before it, case-sensitive. It holds nothing else cheki uses (no amount, no names), so cheki only takes the transaction number from it and checks that like a typed one. A QR is never proof of payment. Decoder: src/lib/qr/telebirr.ts, write-up: docs/telebirr-qr.md.",
    ],
    changelog: [],
    parserSource: "src/lib/parsers/telebirr.ts",
    fixture: "tests/parsers/telebirr-mpesa.test.ts",
    probe: { ref: "DET0CHEKI0", expect: {}, observed: "not observed (geo-blocked)" },
  },
  {
    id: "boa",
    label: "BOA",
    inputNeeded: "BOA slip link, or reference + last 5 digits of the account on the receipt",
    placeholders: [
      {
        name: "{REFERENCE}",
        what: "The Bank of Abyssinia transaction reference.",
        whereToFind: "On the BOA receipt, or at the start of the slip link's trx value (cs.bankofabyssinia.com/slip/?trx=FT25SAMPLE0612345 → FT25SAMPLE06).",
        format: "Letters and digits, starting with 2 letters, e.g. FT25SAMPLE06.",
      },
      {
        name: "{LAST_5_DIGITS}",
        what: "The last 5 digits of an account on the receipt, which BOA looks the receipt up by. Not always the receiver's: a fee receipt with no receiver uses the source account.",
        whereToFind: "The last 5 characters of the slip link's trx value (FT25SAMPLE0612345 → 12345), or the account on the receipt.",
        format: "5 digits, appended directly after the reference.",
      },
    ],
    redactedExample: "https://cs.bankofabyssinia.com/api/onlineSlip/getDetails/?id=FT25SAMPLE06XXXXX",
    fieldsParsed: ["senderName", "senderAccount", "receiverName", "receiverAccount", "amount", "currency", "date", "reference", "transactionType", "amountInWords", "serviceFee", "totalPaid", "reason"],
    unknownRef: 'HTTP 200 application/json with body[0]["Payer\'s Name"] = "Invalid reference number".',
    gotchas: [
      "A miss still returns HTTP 200, so the parser must read the body.",
      "Fee and charge receipts (e.g. Transaction Type \"Account Transfer MB Maintenance\") have no Receiver's Name or Receiver's Account; receiver fields stay empty.",
      "Slip links put the 5 account digits straight after the reference (trx=FT25SAMPLE0612345); cheki splits them off.",
      "\"VAT (15%)\" is not mapped: on the fee receipt observed it was 15% of the Transferred Amount, not of the Service Charge, so it does not fit serviceFeeVat. totalPaid includes it.",
    ],
    changelog: [
      { date: "2026-10-12", note: "Slip links (trx=) are split into the reference and the 5 account digits; receipts without a receiver, and the service charge, total including VAT and payment reference rows, are read." },
    ],
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
    responseTypeLabel: "JSON envelope with the receipt as a base64 PDF (inferred, beta)",
    placeholders: [
      {
        name: "{REFERENCE}",
        what: "The M-Pesa Ethiopia transaction ID (trxNo), printed on the receipt as TRANSACTION ID.",
        whereToFind: "In the M-Pesa SMS confirmation and on the receipt.",
        format: "Letters and digits, usually 10 characters (Safaricom style, e.g. UAB1CD2EF3).",
        confirmed: false,
      },
    ],
    redactedExample: "https://m-pesabusiness.safaricom.et/api/receipt/getReceipt?trxNo=UXXXXXXXXX",
    fieldsParsed: [
      "reference",
      "senderName",
      "senderAccount",
      "receiverName",
      "receiverAccount",
      "amount",
      "settledAmount",
      "serviceFee",
      "serviceFeeVat",
      "totalPaid",
      "date",
      "transactionType",
      "paymentChannel",
    ],
    unknownRef:
      'Not checked from CI (geo-blocked). Other verifiers treat any responseCode other than "0", or a missing base64Data, as no receipt; the exact error code and wording are not known.',
    gotchas: [
      "Geo-blocked: requests from outside Ethiopia time out or are refused.",
      'The answer is JSON, but the receipt itself is a PDF in base64Data. cheki checks the base64, caps the decoded PDF at 5 MB, and reads the PDF text (TRANSACTION ID, SENDER or PAYER NAME, RECEIPT NO / PAYMENT DATE / SETTLED AMOUNT, TOTAL, ...).',
      "Beta: the envelope and the PDF labels come from other open-source verifiers' source code. cheki's tests use a synthetic receipt; no real receipt has been checked yet.",
      "Other verifiers send a Referer of https://m-pesabusiness.safaricom.et/; one notes the endpoint requires it. cheki sends it too.",
    ],
    changelog: [{ date: "2026-10-11", note: "Parser reads the base64 PDF envelope instead of flat JSON fields. Labelled beta until a real receipt verifies." }],
    parserSource: "src/lib/parsers/mpesa.ts",
    fixture: "tests/parsers/mpesa.test.ts",
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
        format: "16 characters, letters and digits, e.g. B22WDTI00SAMPLE1.",
        traps: 'The app also shows a longer "Transaction Ref" or "Transfer Reference" (WDTI... or OBTI...). The endpoint rejects it. Use the FT Ref.',
      },
    ],
    redactedExample: "https://receipts.dashenbanksc.com/receipt/B22WDTIXXXXXXXXX",
    fieldsParsed: ["senderName", "senderAccount", "receiverName", "receiverAccount", "amount", "currency", "date", "reference", "reason"],
    unknownRef: 'HTTP 400 application/json, {"statusCode":400,"message":"Transaction not found"}.',
    gotchas: [
      "The old host receipt.dashensuperapp.com now returns 502 Bad Gateway. Old PDF links on api.dashensuperapp.com are still detected and routed to the new host.",
      "The live endpoint returns an HTML receipt, not a PDF. GET /api/receipt redirects to it rather than serving the bank's HTML from cheki.",
    ],
    changelog: [],
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
        format: "Unconfirmed. Another verifier's docs describe a 24 character token (an 8 character prefix plus the 16 character reference). Another open-source app builds the URL from the bare reference. Neither is proven.",
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
  {
    id: "zamzam",
    label: "ZamZam",
    inputNeeded: "Receipt link (receipt.zamzambank.com.et/receipt/{id}) or the numeric receipt id",
    preferLink: true,
    placeholders: [
      {
        name: "{RECEIPT_ID}",
        what: "The numeric id of the ZamZam receipt, the last part of the receipt link.",
        whereToFind: "The receipt link shared from the ZamZam app: https://receipt.zamzambank.com.et/receipt/{id}.",
        format: "Digits only (8 digits on the receipts seen so far). cheki accepts up to 12.",
        traps: "Not the transaction reference printed on the receipt (letters and digits). Only the number from the link works.",
      },
    ],
    redactedExample: "https://receipt.zamzambank.com.et/receipt/XXXXXXXX",
    fieldsParsed: ["senderName", "senderAccount", "receiverName", "receiverAccount", "amount", "currency", "date", "reference", "transactionType"],
    unknownRef: "HTTP 200 application/json with the body null.",
    gotchas: [
      "The receipt page is a React app; the data comes from receipt-backend.zamzambank.com.et/api/v1/invoice/{id}, which answers HTTP 401 without an HTTP Basic credential. That credential is hardcoded in ZamZam's public receipt web app, so cheki sends it (kept in the parser, never in a response).",
      "An unknown id still returns HTTP 200, with the body null.",
      "The record names the ZamZam account holder (name, acc_NUM) and a debit/credit flag (drcr) from that account's side. cheki infers the holder is the sender on D and the receiver on C; other_NAME, when filled, is the other side. ZamZam does not document this.",
      "acc_NUM is the full account number. cheki masks it (first digit and last 4) before it reaches any output or the cache.",
      "dt carries a date only (time 00:00:00); other_NAME and parameter can be the literal string \"NULL\". vat is not mapped (it may be VAT on a fee, not on the amount).",
      "Ids are sequential. cheki checks one id or link at a time, never a range, under the usual per-IP rate limits.",
    ],
    changelog: [
      { date: "2026-10-12", note: "Live (beta): receipts are read from ZamZam's JSON endpoint. Confirmed with one real receipt." },
    ],
    parserSource: "src/lib/parsers/zamzam.ts",
    fixture: "tests/parsers/zamzam.test.ts",
    probe: {
      ref: "999999999999",
      useParserHeaders: true,
      // Exactly "null": a real record also contains null values, so a substring check would not tell them apart.
      expect: { status: 200, contentType: "json", bodyIs: "null" },
      observed: "cheki, 2026-10-12",
    },
  },
  unknownBank("hijra"),
  unknownBank("shabelle"),
  unknownBank("goh"),
  unknownBank("tsedey"),
  unknownBank("gadaa"),
  unknownBank("rammis"),
];

export const REPO_URL = "https://github.com/1RB/cheki";
export const REPORT_CHANGE_URL = `${REPO_URL}/issues/new?template=bank-request.yml`;
/**
 * The one place cheki credits the third-party provider list that most
 * "inferred" formats come from: a single line in the /endpoints intro.
 * Evidence strings say "another verifier" instead of repeating the name
 * (tests/content/credits.test.ts).
 */
export const THIRD_PARTY_PROVIDER_LIST = "https://links.et/docs/providers";

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

/** Manifest endpointHistory plus the doc's status notes, newest first. */
export function changelogFor(row: EndpointRow): { date: string; note: string }[] {
  const fromManifest = (row.bank.endpointHistory ?? []).map((h) => ({ date: h.date, note: h.change }));
  return [...fromManifest, ...row.doc.changelog].sort((a, b) => b.date.localeCompare(a.date));
}

export function getEndpointDoc(id: string): EndpointDoc | undefined {
  return endpointDocs.find((d) => d.id === id);
}

export function isGeoRestricted(bank: BankManifestEntry): boolean {
  return bank.geoBlocked === true;
}
