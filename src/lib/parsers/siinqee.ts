/**
 * Siinqee Bank parsers.
 *
 * Current format (SiinqeeParser, bank host):
 *   Receipt link: https://receipts.siinqeebank.com:871/generate/{REF}
 *   {REF} is the transaction reference the SMS prints after "Ref:", so a
 *   typed reference and the link are the same lookup key. Seen on real
 *   receipts (2026-10-31; the examples here are made up): 16 characters,
 *     3 capitals/digits   branch-like prefix, e.g. "12B"
 *     4 letters/digits    channel or teller code, e.g. "004k" or "IIPS"
 *                         (incoming instant payment). It can hold a
 *                         lowercase letter, so the reference is
 *                         case-sensitive and is never uppercased.
 *     5 digits            YYDDD, the year and day of the year (26295 is
 *                         2026, day 295: 22 October)
 *     4 digits            sequence
 *   The receipt page is an HTML page (a text reader showed one); another
 *   verifier reports PDFs. Both are read: a body that starts with %PDF goes
 *   through PDF text extraction, anything else has its tags stripped. Fields
 *   are then taken from the text by their labels (a label's value is the text
 *   up to the next known label), so the markup does not matter.
 *   Another verifier reports that each receipt link opens about five times in
 *   total, so a check makes one request and never retries (maxAttempts 1),
 *   and the API caches a confirmed receipt.
 *   What Siinqee answers for an unknown reference has not been observed. Any
 *   page without "Transaction is successful!" and the exact reference
 *   requested is "not confirmed", never "fake".
 *
 * Legacy format (SiinqeeEbirrParser, eBirr route):
 *   https://receipt.ebirr.com/siinqee/{token}, parsed like any eBirr
 *   receipt. The route answered 404 "Cannot GET" from 2026-10-10 on; the
 *   format is kept so an old link still verifies if it ever answers again.
 *
 * Never returned or kept in `raw`: the "Customer Information" block
 * (customer name, phone, TIN, region, branch) and the bank's address block.
 * Accounts arrive masked by Siinqee (100*******001); anything that does not
 * look like that mask is masked again here.
 */
import { BaseParser } from "./base";
import { EBirrParser } from "./ebirr";
import type { ParsedReceipt } from "../core/types";
import { removeScriptsAndStyles, TAG_RE } from "../core/html";
import { parseMoney } from "../core/money";
import { parseEbirrReference, buildEbirrUrl, type Checked } from "../security/reference";

/** Siinqee Bank's receipt host, with its port (part of the allowlisted host). */
export const SIINQEE_RECEIPT_HOST = "receipts.siinqeebank.com:871";

/** A Siinqee transaction reference: 3 capitals/digits, 4 letters/digits, 9 digits (YYDDD + sequence). */
export const SIINQEE_REF_RE = /^[0-9A-Z]{3}[0-9A-Za-z]{4}\d{9}$/;

const SIINQEE_REF_HELP =
  "That is not a Siinqee Bank reference. Paste the receipt link (receipts.siinqeebank.com:871/generate/...) or the 16-character reference after \"Ref:\" in the SMS, exactly as printed (letter case matters).";

/** The success line every receipt seen carries. */
const SUCCESS_RE = /transaction\s+is\s+successful/i;

/**
 * Every label on the receipt, including the blocks cheki never returns: a
 * value runs up to the next known label, so the customer block can't bleed
 * into a field. Matched case-sensitively (labels are Title Case, values are
 * mostly capitals), longest first at each position.
 */
const LABELS = [
  // Transaction details (returned)
  "Reference No",
  "Payer Account",
  "Payer Name",
  "Transaction Date",
  "Currency",
  "Transaction Description",
  "Receiver Account",
  "Receiver Name",
  "Transferred Amount",
  "Charge Amount",
  "VAT Amount",
  "Disaster Fund",
  "Total Amount",
  "Amount in Words",
  "Amount",
  // Headings and the blocks that are never returned
  "Transaction Details",
  "Customer Information",
  "Company Address & Other Information",
  "Customer Name",
  "Customer Phone",
  "VAT Registration No",
  "Address Line",
  "Address",
  "Region",
  "City",
  "TIN",
  "Branch",
  "Phone",
  "Email",
  "Website",
] as const;

type Label = (typeof LABELS)[number];

const escape = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
/**
 * One alternation, longest label first so "Total Amount" wins over "Amount".
 * Not preceded by a lowercase letter (so "Amount" never matches inside a
 * word), but no boundary after: PDF text can run a label into its value.
 */
const LABEL_RE = new RegExp(
  `(?<![a-z])(${[...LABELS].sort((a, b) => b.length - a.length).map(escape).join("|")})`,
  "g"
);

/** A real receipt is a few KB of text; everything here is linear, and capped. */
const MAX_TEXT = 50_000;

/** "-", "null", "N/A" and blanks are missing values on Siinqee's receipt. */
function value(v: string | undefined): string | undefined {
  if (v === undefined) return undefined;
  const s = v.replace(/^[\s:]+/, "").replace(/\s+/g, " ").trim();
  if (!s || /^(?:-+|null|n\/?a)$/i.test(s)) return undefined;
  return s;
}

/** HTML to text: block and cell boundaries become line breaks, tags go, entities are decoded. */
export function siinqeeHtmlToText(html: string): string {
  return removeScriptsAndStyles(html.slice(0, 512 * 1024))
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/(?:td|th|tr|div|p|li|h\d|span|label|dt|dd|section|table)>/gi, "\n")
    .replace(TAG_RE, " ")
    .replace(/&nbsp;/gi, " ")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/&quot;/gi, '"')
    .replace(/&#0?39;|&apos;/gi, "'")
    .replace(/&amp;/gi, "&")
    .replace(/[ \t\r]+/g, " ")
    .replace(/\n[ \t]*\n+/g, "\n")
    .trim();
}

/** Label → raw value (text up to the next known label). The first non-empty value of a label wins. */
export function siinqeeFields(text: string): Partial<Record<Label, string>> {
  const flat = text.slice(0, MAX_TEXT);
  const hits: { label: Label; start: number; end: number }[] = [];
  LABEL_RE.lastIndex = 0;
  for (let m = LABEL_RE.exec(flat); m; m = LABEL_RE.exec(flat)) {
    hits.push({ label: m[1] as Label, start: m.index, end: m.index + m[0].length });
  }
  const out: Partial<Record<Label, string>> = {};
  for (let i = 0; i < hits.length; i++) {
    const h = hits[i];
    if (out[h.label] !== undefined) continue;
    const raw = flat.slice(h.end, i + 1 < hits.length ? hits[i + 1].start : flat.length);
    const v = value(raw);
    if (v !== undefined) out[h.label] = v;
  }
  return out;
}

/**
 * An account number as it may be shown. Siinqee's own mask (digits, one run
 * of stars, digits, at most 4 visible either side: "100*******001") is
 * kept. Anything else keeps its first character and last 4.
 */
export function maskSiinqeeAccount(v: string | undefined): string | undefined {
  const s = value(v)?.replace(/\s+/g, "");
  if (!s) return undefined;
  if (/^\d{0,4}\*+\d{0,4}$/.test(s)) return s;
  if (s.length <= 5) return "*".repeat(s.length);
  return `${s[0]}${"*".repeat(s.length - 5)}${s.slice(-4)}`;
}

/** "31/10/2026" → "2026-10-31". Anything else is returned as Siinqee wrote it. */
function isoDate(v: string | undefined): string | undefined {
  const s = value(v);
  if (!s) return undefined;
  const m = /^(\d{1,2})\/(\d{1,2})\/(\d{4})\b/.exec(s);
  if (!m) return s.slice(0, 40);
  const [d, mo, y] = [Number(m[1]), Number(m[2]), m[3]];
  if (d < 1 || d > 31 || mo < 1 || mo > 12) return s.slice(0, 40);
  return `${y}-${String(mo).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
}

/**
 * Words that start the customer or company block, in any casing. A
 * description never runs into them: Transaction Description is free text,
 * and if a layout puts the customer block (or a label in other casing that
 * the label list misses) after it, the value would carry phone, TIN or
 * branch into the result.
 */
const NOT_DESCRIPTION_RE = /\b(?:customer|company address|address|region|city|vat registration|phone|tin|branch|email|website|payer|receiver|amount|charge|total|disaster|currency|reference|transaction date)\b/i;
/** Siinqee's narratives are short; anything longer is not a safe narrative. */
const MAX_DESCRIPTION = 80;

/**
 * The transaction description, cut at the first word that belongs to another
 * block. Omitted when nothing is left, or when it is still longer than a
 * narrative can be (its end could not be found safely).
 */
export function boundedDescription(v: string | undefined): string | undefined {
  const s = value(v);
  if (!s) return undefined;
  const cut = NOT_DESCRIPTION_RE.exec(s);
  const head = value(cut ? s.slice(0, cut.index) : s);
  if (!head || head.length > MAX_DESCRIPTION) return undefined;
  return head;
}

/** A positive amount, or undefined ("-" and words are missing). */
function amountOf(v: string | undefined): number | undefined {
  const s = value(v)?.replace(/^(?:ETB|Birr)\s*/i, "");
  if (!s || !/^\d/.test(s)) return undefined;
  const n = parseMoney(s);
  return n !== undefined && n > 0 ? n : undefined;
}

/** Why a Siinqee answer is not a receipt (for the verifier's message). */
export type SiinqeeMiss = "no-success" | "reference" | "amount" | "pdf";

/**
 * Read a Siinqee receipt from its text. Verified only when the page says
 * "Transaction is successful", its Reference No is exactly the reference
 * requested (case-sensitive) and an amount parses.
 */
export function parseSiinqeeText(text: string, requestedReference: string): { parsed: ParsedReceipt; miss?: SiinqeeMiss } {
  const t = (text || "").slice(0, MAX_TEXT);
  if (!SUCCESS_RE.test(t)) return { parsed: { verified: false }, miss: "no-success" };
  const f = siinqeeFields(t);
  // The reference is one token; anything after it is not part of it.
  const reference = f["Reference No"]?.split(" ")[0];
  if (!reference || reference !== requestedReference) return { parsed: { verified: false }, miss: "reference" };
  const amount = amountOf(f["Transferred Amount"]) ?? amountOf(f["Amount"]) ?? amountOf(f["Total Amount"]);
  if (amount === undefined) return { parsed: { verified: false }, miss: "amount" };

  const currency = value(f["Currency"])?.split(" ")[0]?.toUpperCase();
  const date = isoDate(f["Transaction Date"]);
  const description = boundedDescription(f["Transaction Description"]);
  const fee = amountOf(f["Charge Amount"]);
  const vat = amountOf(f["VAT Amount"]);
  const total = amountOf(f["Total Amount"]);

  const parsed: ParsedReceipt = {
    verified: true,
    senderName: value(f["Payer Name"]),
    senderAccount: maskSiinqeeAccount(f["Payer Account"]),
    receiverName: value(f["Receiver Name"]),
    receiverAccount: maskSiinqeeAccount(f["Receiver Account"]),
    amount,
    currency: currency && /^[A-Z]{3}$/.test(currency) ? currency : "ETB",
    date,
    reference,
    transactionType: description,
    transactionStatus: "Successful",
    serviceFee: fee,
    serviceFeeVat: vat,
    totalPaid: total,
    // Only the transaction itself: never the customer block, names or accounts.
    raw: JSON.stringify({ reference, date, currency, description, amount, fee, vat, total }).slice(0, 1000),
  };
  for (const k of Object.keys(parsed) as (keyof ParsedReceipt)[]) {
    if (parsed[k] === undefined) delete parsed[k];
  }
  return { parsed };
}

/** Validate a Siinqee reference. Trimmed only: the case is part of the reference. */
export function checkSiinqeeReference(input: unknown): Checked<string> {
  if (typeof input !== "string") return { ok: false, message: "Reference must be text." };
  const ref = input.trim();
  if (!ref) return { ok: false, message: "Reference number is required." };
  if (!SIINQEE_REF_RE.test(ref)) return { ok: false, message: SIINQEE_REF_HELP };
  return { ok: true, value: ref };
}

export class SiinqeeParser extends BaseParser {
  readonly bankId = "siinqee";
  readonly bankName = "Siinqee Bank";
  readonly responseType = "html" as const;
  readonly requiresAccount = false;
  readonly accountDigits?: number = undefined;
  readonly requiresPhone = false;
  /** Kept as bytes: the page may be a PDF. Gets the PDF size cap. */
  readonly binaryResponse = true;
  /** About five views per receipt (another verifier's report): one request, no retry. */
  protected readonly maxAttempts = 1;
  /**
   * What Siinqee answers for an unknown reference is not observed, so a 404
   * is "not confirmed" (amber), not "no such receipt".
   */
  protected readonly notFoundMessage =
    "Siinqee Bank answered HTTP 404 for this reference, so it cannot be confirmed as a receipt. Check the reference (letter case matters) or ask the sender for the receipt link.";

  normalizeReference(ref: string): Checked<string> {
    return checkSiinqeeReference(ref);
  }

  buildUrl(ref: string): string {
    // Rebuilt from the fixed host; a pasted link is only read for its reference.
    const checked = checkSiinqeeReference(ref);
    if (!checked.ok) throw new Error(checked.message);
    return `https://${SIINQEE_RECEIPT_HOST}/generate/${encodeURIComponent(checked.value)}`;
  }

  static isPdf(buf: Buffer): boolean {
    return buf.toString("ascii", 0, 5).includes("%PDF");
  }

  /** PDF text, the same extractor the CBE parser uses. Empty on failure. */
  static async extractPdfText(data: Buffer): Promise<string> {
    try {
      const { extractText, getDocumentProxy } = await import("unpdf");
      const pdf = await getDocumentProxy(new Uint8Array(data));
      const { text } = await extractText(pdf, { mergePages: true });
      return text || "";
    } catch {
      return "";
    }
  }

  /** Read Siinqee's answer, HTML or PDF, for the reference that was requested. */
  static async parseResponse(data: string | Buffer, requestedReference: string): Promise<{ parsed: ParsedReceipt; miss?: SiinqeeMiss }> {
    const buf = Buffer.isBuffer(data) ? data : Buffer.from(data);
    if (SiinqeeParser.isPdf(buf)) {
      const text = await SiinqeeParser.extractPdfText(buf);
      if (!text.trim()) return { parsed: { verified: false }, miss: "pdf" };
      return parseSiinqeeText(text, requestedReference);
    }
    return parseSiinqeeText(siinqeeHtmlToText(buf.toString("utf8")), requestedReference);
  }

  /**
   * Sync parse without the requested reference (pasted content). The
   * verifier uses parseResponse, which also checks the reference.
   */
  parse(data: string | Buffer, _contentType: string): ParsedReceipt {
    const buf = Buffer.isBuffer(data) ? data : Buffer.from(data);
    if (SiinqeeParser.isPdf(buf)) return { verified: false };
    const text = siinqeeHtmlToText(buf.toString("utf8"));
    const ref = siinqeeFields(text)["Reference No"]?.split(" ")[0] ?? "";
    return parseSiinqeeText(text, ref).parsed;
  }
}

// ─── Legacy: the eBirr route ─────────────────────────────────────────

/**
 * The receipt.ebirr.com tenant for Siinqee. "coop" is Cooperative Bank of
 * Oromia (COOPay-Ebirr), a different bank, so it is checked as eBirr.
 */
const SIINQEE_TENANTS = new Set(["siinqee"]);

function parseSiinqeeEbirr(ref: string): Checked<{ tenant: string; token: string }> {
  const parsed = parseEbirrReference(ref, "siinqee");
  if (!parsed.ok) return parsed;
  if (!SIINQEE_TENANTS.has(parsed.value.tenant)) {
    return { ok: false, message: "That eBirr receipt was not issued by Siinqee Bank." };
  }
  return parsed;
}

export class SiinqeeEbirrParser extends BaseParser {
  readonly bankId = "siinqee-ebirr";
  readonly bankName = "Siinqee Bank";
  readonly responseType = "html" as const;
  readonly requiresAccount = false;
  readonly accountDigits?: number = undefined;
  readonly requiresPhone = false;

  private ebirrParser = new EBirrParser();

  normalizeReference(ref: string): Checked<string> {
    const parsed = parseSiinqeeEbirr(ref);
    if (!parsed.ok) return parsed;
    return { ok: true, value: `${parsed.value.tenant}/${parsed.value.token}` };
  }

  buildUrl(ref: string): string {
    // Rebuilt from the fixed eBirr host; a user-supplied URL is never fetched as is.
    const parsed = parseSiinqeeEbirr(ref);
    if (!parsed.ok) throw new Error(parsed.message);
    return buildEbirrUrl(parsed.value.tenant, parsed.value.token);
  }

  parse(data: string | Buffer, contentType: string): ParsedReceipt {
    return this.ebirrParser.parse(data, contentType);
  }
}
