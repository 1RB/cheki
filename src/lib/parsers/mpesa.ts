/**
 * M-Pesa parser - Safaricom Ethiopia mobile wallet.
 *
 * Endpoint: https://m-pesabusiness.safaricom.et/api/receipt/getReceipt?trxNo={ref}
 * Response: a JSON envelope carrying the receipt as a base64-encoded PDF:
 *
 *   { "responseCode": "0", "responseDescription": "...", "base64Data": "JVBERi0..." }
 *
 * A non-"0" responseCode, or no base64Data, is an upstream error (no receipt).
 * Geo-blocked from non-Ethiopian IPs, so cheki has not observed it itself.
 *
 * Evidence (inferred, not observed by cheki): every open-source verifier that
 * calls this endpoint reads that envelope and parses the PDF -
 * Vixen878/verifier-api src/services/verifyMpesa.ts, nahom-d54/tx-verify
 * src/providers/mpesa.ts, nahom-d54/veri-py, kira-coding/kira-verify-opensource
 * MpesaVerifier.php, matthias22m/transaction-verify - and another verifier tags these
 * receipts `mpesa-pdf` ("PDF parsed"). None of them reads flat JSON fields, so
 * the old flat-JSON reader (senderName/amount/transactionId at the top level)
 * was removed: no source shows that shape exists.
 *
 * The PDF's labels come from those parsers (see FIELD_LABELS). They are in
 * English next to Amharic ("<Amharic> / SENDER NAME   value"). Values are
 * read by splitting each line at every known label, so the parser works on
 * row-ordered layout text and on one long run of flowed text alike. Every
 * pattern here is linear: labels are found with indexOf, and the few regexes
 * run on short, length-capped values.
 */
import { BaseParser } from "./base";
import type { ParsedReceipt } from "../core/types";
import { parseMoney } from "../core/money";
import { MAX_PDF_BYTES } from "../http/safe-fetch";
import { getBank } from "../manifest/loader";

const MPESA_HEADERS = { Accept: "application/json, text/plain, */*", Referer: "https://m-pesabusiness.safaricom.et/" };

/** Largest base64 string that can decode to at most MAX_PDF_BYTES. */
export const MAX_BASE64_CHARS = Math.ceil(MAX_PDF_BYTES / 3) * 4;
/** Body cap for the JSON envelope: the base64 PDF plus room for the other fields. */
export const MAX_ENVELOPE_BYTES = MAX_BASE64_CHARS + 64 * 1024;
/** A real receipt is a page or two; text beyond this is not a receipt. */
const MAX_TEXT_CHARS = 50_000;
const MAX_PAGES = 4;
const MAX_LINE_CHARS = 2_000;
const MAX_VALUE_CHARS = 200;
const MAX_LABEL_HITS = 500;
const MAX_TEXT_ITEMS = 20_000;

export type MpesaEnvelope =
  | { ok: true; pdf: Buffer; description?: string }
  | {
      ok: false;
      reason: "too-large" | "not-json" | "not-object" | "upstream-error" | "missing-pdf" | "bad-base64" | "not-pdf";
      description?: string;
    };

type Field =
  | "payerName"
  | "payerAccount"
  | "receiverName"
  | "receiverBusinessName"
  | "receiverAccount"
  | "transactionId"
  | "serviceFee"
  | "vat"
  | "discount"
  | "total"
  | "amountInWords"
  | "paymentMethod"
  | "transactionType"
  | "paymentChannel"
  | "reason"
  | "status"
  | "receiptHeader"
  | "stop";

/**
 * English labels on the receipt PDF. Sources: N = nahom-d54/tx-verify label
 * map, V = Vixen878/verifier-api regexes. "TRANSACTION STATUS" is in neither;
 * it is read defensively so a status row, if a receipt ever has one, reaches
 * the shared gate. "stop" labels end the previous value and carry nothing.
 */
const FIELD_LABELS: ReadonlyArray<readonly [string, Field]> = [
  ["PAYER NAME", "payerName"], // V
  ["SENDER NAME", "payerName"], // N
  ["BUYER NAME", "payerName"], // N
  ["PAYER PHONE NUMBER", "payerAccount"], // V
  ["SENDER NUMBER", "payerAccount"], // N
  ["BUYER PHONE NUMBER", "payerAccount"], // N
  ["RECEIVER NAME", "receiverName"], // N, V
  ["RECEIVER BUSINESS NAME", "receiverBusinessName"], // N
  ["RECEIVER NUMBER", "receiverAccount"], // V
  ["RECEIVER ACCOUNT NUMBER", "receiverAccount"], // N
  ["RECEIVER BUSINESS NUMBER", "receiverAccount"], // N
  ["TRANSACTION ID", "transactionId"], // N, V
  ["SERVICE FEE", "serviceFee"], // N, V
  ["+ 15% VAT", "vat"], // N, V
  ["DISCOUNT", "discount"], // N
  ["TOTAL", "total"], // N, V
  ["TOTAL AMOUNT IN WORDS", "amountInWords"], // N
  ["PAYMENT METHOD", "paymentMethod"], // N
  ["TRANSACTION TYPE", "transactionType"], // N
  ["PAYMENT CHANNEL", "paymentChannel"], // N
  ["PAYMENT REASON", "reason"], // N
  ["TRANSACTION STATUS", "status"], // defensive, unobserved
  ["SETTLED AMOUNT", "receiptHeader"], // N: last cell of the RECEIPT NO / PAYMENT DATE / SETTLED AMOUNT row
  ["RECEIPT NO", "stop"],
  ["PAYMENT DATE", "stop"],
  ["BANK NAME", "stop"], // N (bank transfers); not mapped
  ["PACKAGE DETAILS", "stop"], // N (airtime bundles)
  ["VALIDITY PERIOD", "stop"], // N
  ["TRANSACTION INFORMATION", "stop"], // N section titles
  ["TRANSACTION DETAIL", "stop"],
  ["SCAN TO VERIFY", "stop"],
  ["THANK YOU", "stop"],
];

/** Longest first, so "TOTAL AMOUNT IN WORDS" wins over "TOTAL" at the same position. */
const LABELS_BY_LENGTH = [...FIELD_LABELS].sort((a, b) => b[0].length - a[0].length);

const ETHIOPIC_RE = /[\u1200-\u139F\u2D80-\u2DDF\uAB00-\uAB2F]+/g;
const DATE_TIME_RE = /(\d{4}-\d{2}-\d{2}) (\d{2}:\d{2}(?::\d{2})?)/;
const ID_RE = /^[A-Z0-9]{6,20}$/;

function isWordChar(c: string | undefined): boolean {
  return c !== undefined && /[A-Z0-9]/.test(c);
}

/** Trim whitespace and separator characters (/ : | -) from both ends, without a backtracking regex. */
function trimSeparators(s: string): string {
  const sep = (c: string) => c === " " || c === "/" || c === ":" || c === "|" || c === "-" || c === "\t";
  let a = 0;
  let b = s.length;
  while (a < b && sep(s[a])) a++;
  while (b > a && sep(s[b - 1])) b--;
  return s.slice(a, b);
}

/** Amharic removed, whitespace collapsed, length capped. */
function normalizeLine(line: string): string {
  return line.slice(0, MAX_LINE_CHARS).replace(ETHIOPIC_RE, " ").replace(/\s+/g, " ").trim();
}

function blank(v: string | undefined): boolean {
  if (!v) return true;
  const t = v.trim();
  return t === "" || t === "-" || t === "- - -" || t === "---" || t.toLowerCase() === "null" || t.toLowerCase() === "n/a";
}

/**
 * Split one line at every known label. Returns [field, value] pairs in order;
 * a value runs from the end of its label to the start of the next one.
 */
function splitAtLabels(line: string): Array<[Field, string]> {
  const upper = line.toUpperCase();
  const hits: Array<{ at: number; end: number; field: Field }> = [];
  for (const [label, field] of LABELS_BY_LENGTH) {
    let from = 0;
    while (hits.length < MAX_LABEL_HITS) {
      const at = upper.indexOf(label, from);
      if (at === -1) break;
      const end = at + label.length;
      from = at + 1;
      if (isWordChar(upper[at - 1]) && isWordChar(label[0])) continue;
      if (isWordChar(upper[end])) continue;
      hits.push({ at, end, field });
    }
  }
  // Earliest first; at the same start the longer label (pushed first) stays first.
  hits.sort((a, b) => a.at - b.at || b.end - a.end);
  const chosen: typeof hits = [];
  let lastEnd = -1;
  for (const h of hits) {
    if (h.at < lastEnd) continue; // inside a longer label already chosen ("TOTAL" in "TOTAL AMOUNT IN WORDS")
    chosen.push(h);
    lastEnd = h.end;
  }
  return chosen.map((h, i) => {
    const next = chosen[i + 1]?.at ?? line.length;
    return [h.field, trimSeparators(line.slice(h.end, next)).slice(0, MAX_VALUE_CHARS)];
  });
}

function cleanName(v: string | undefined): string | undefined {
  if (blank(v)) return undefined;
  // Keep letters, spaces and . ' - ; drop digits and anything after them (an address or account run).
  const cut = v!.search(/\d/);
  const name = trimSeparators((cut === -1 ? v! : v!.slice(0, cut)).replace(/[^A-Za-z .'-]/g, " ").replace(/ {2,}/g, " "));
  return /[A-Za-z]/.test(name) ? name.slice(0, 100) : undefined;
}

function cleanAccount(v: string | undefined): string | undefined {
  if (blank(v)) return undefined;
  const m = v!.slice(0, 40).match(/^\+?[0-9*][0-9* ]{2,24}/);
  return m ? m[0].replace(/ /g, "") : undefined;
}

function cleanId(v: string | undefined): string | undefined {
  if (blank(v)) return undefined;
  const token = v!.trim().split(" ")[0].toUpperCase();
  return ID_RE.test(token) ? token : undefined;
}

function cleanText(v: string | undefined, max = 120): string | undefined {
  return blank(v) ? undefined : v!.trim().slice(0, max);
}

function money(v: string | undefined): number | undefined {
  if (blank(v)) return undefined;
  const n = parseMoney(v);
  return n !== undefined && n >= 0 ? n : undefined;
}

/**
 * The value row under "RECEIPT NO  PAYMENT DATE  SETTLED AMOUNT":
 * "<receipt no> <yyyy-mm-dd hh:mm:ss> <amount>". The receipt number may be
 * glued to the date in flowed text ("UCK0SYNTH12026-09-14 ...").
 */
function parseReceiptRow(row: string): { receiptNo?: string; date?: string; settled?: number } {
  const s = row.slice(0, 200);
  const m = s.match(DATE_TIME_RE);
  if (!m || m.index === undefined) return {};
  const before = s.slice(0, m.index).replace(/ /g, "").toUpperCase();
  const after = s.slice(m.index + m[0].length);
  return {
    receiptNo: ID_RE.test(before) ? before : undefined,
    date: `${m[1]} ${m[2]}`,
    settled: money(after),
  };
}

export class MpesaParser extends BaseParser {
  readonly bankId = "mpesa";
  readonly bankName = "M-Pesa Ethiopia";
  readonly responseType = "json" as const;
  readonly requiresAccount = false;
  readonly accountDigits?: number = undefined;
  readonly requiresPhone = false;
  readonly geoBlocked = true;

  /** The envelope carries a base64 PDF, so it may exceed the 2 MB JSON cap; the decoded PDF still respects MAX_PDF_BYTES. */
  protected get maxBytes(): number {
    return MAX_ENVELOPE_BYTES;
  }

  /** From the manifest format (other verifiers send these; kira-verify notes the endpoint gates on the Referer). */
  protected requestHeaders(): Record<string, string> {
    return getBank("mpesa")?.formats?.find((f) => f.parser === "mpesa")?.headers ?? MPESA_HEADERS;
  }

  buildUrl(ref: string): string {
    return `https://m-pesabusiness.safaricom.et/api/receipt/getReceipt?trxNo=${encodeURIComponent(ref)}`;
  }

  /**
   * Sync entry point required by BaseParser. The receipt is a PDF inside the
   * envelope and PDF text extraction is async, so the verifier calls
   * parseEnvelope() instead; this never verifies on its own.
   */
  parse(_data: string | Buffer, _contentType: string): ParsedReceipt {
    return { verified: false };
  }

  /**
   * Validate the getReceipt envelope and decode its PDF. Fails closed on an
   * oversized body, non-JSON, a non-"0" responseCode, a missing or malformed
   * base64Data, a decoded body over MAX_PDF_BYTES, or bytes that are not a PDF.
   */
  static decodeEnvelope(data: string | Buffer): MpesaEnvelope {
    const size = typeof data === "string" ? data.length : data.length;
    if (size > MAX_ENVELOPE_BYTES) return { ok: false, reason: "too-large" };
    let payload: unknown;
    try {
      payload = JSON.parse(typeof data === "string" ? data : data.toString("utf8"));
    } catch {
      return { ok: false, reason: "not-json" };
    }
    if (!payload || typeof payload !== "object" || Array.isArray(payload)) return { ok: false, reason: "not-object" };
    const p = payload as Record<string, unknown>;
    const description =
      typeof p.responseDescription === "string" ? p.responseDescription.replace(/[^\x20-\x7E]/g, " ").trim().slice(0, 120) || undefined : undefined;

    if (String(p.responseCode ?? "") !== "0") return { ok: false, reason: "upstream-error", description };
    if (typeof p.base64Data !== "string" || p.base64Data.length === 0) return { ok: false, reason: "missing-pdf", description };

    // Line breaks (MIME-style encoders) are allowed; anything else outside the
    // standard alphabet is not. Length is checked before decoding.
    const b64 = p.base64Data.replace(/[\r\n]/g, "");
    if (b64.length > MAX_BASE64_CHARS) return { ok: false, reason: "too-large" };
    if (b64.length % 4 !== 0 || !/^[A-Za-z0-9+/]+={0,2}$/.test(b64)) return { ok: false, reason: "bad-base64" };
    const pdf = Buffer.from(b64, "base64");
    if (pdf.length > MAX_PDF_BYTES) return { ok: false, reason: "too-large" };
    if (pdf.subarray(0, 5).toString("latin1") !== "%PDF-") return { ok: false, reason: "not-pdf" };
    return { ok: true, pdf, description };
  }

  /**
   * Text lines of the PDF in reading order: text items grouped into rows by
   * their baseline, rows top to bottom, items left to right. Falls back to
   * unpdf's flowed text when the page has no positioned items.
   */
  static async extractPdfLines(data: Buffer): Promise<string[]> {
    try {
      const { getDocumentProxy } = await import("unpdf");
      const pdf = await getDocumentProxy(new Uint8Array(data));
      const lines: string[] = [];
      let chars = 0;
      for (let n = 1; n <= Math.min(pdf.numPages, MAX_PAGES); n++) {
        const page = await pdf.getPage(n);
        const content = await page.getTextContent();
        const items: Array<{ x: number; y: number; s: string }> = [];
        for (const it of (content.items as Array<{ str?: unknown; transform?: unknown }>).slice(0, MAX_TEXT_ITEMS)) {
          if (typeof it.str !== "string" || !it.str.trim() || !Array.isArray(it.transform)) continue;
          items.push({ x: Number(it.transform[4]) || 0, y: Number(it.transform[5]) || 0, s: it.str });
        }
        items.sort((a, b) => b.y - a.y || a.x - b.x);
        let row: typeof items = [];
        const flush = () => {
          if (!row.length) return;
          const text = row.sort((a, b) => a.x - b.x).map((i) => i.s).join("  ");
          chars += text.length;
          lines.push(text);
          row = [];
        };
        for (const it of items) {
          if (row.length && Math.abs(row[0].y - it.y) > 3) flush();
          row.push(it);
        }
        flush();
        if (chars > MAX_TEXT_CHARS) break;
      }
      if (lines.length) return lines;
      const { extractText } = await import("unpdf");
      const { text } = await extractText(await getDocumentProxy(new Uint8Array(data)), { mergePages: true });
      return (text || "").split("\n");
    } catch {
      return [];
    }
  }

  /** Map receipt text lines to a ParsedReceipt. Pure and synchronous, for tests and the verifier. */
  static parseLines(input: string[]): ParsedReceipt {
    const lines: string[] = [];
    let chars = 0;
    for (const raw of input) {
      if (chars > MAX_TEXT_CHARS) break;
      const l = normalizeLine(String(raw));
      if (!l) continue;
      chars += l.length;
      lines.push(l);
    }

    const values: Partial<Record<Field, string>> = {};
    let header: ReturnType<typeof parseReceiptRow> = {};
    lines.forEach((line, i) => {
      for (const [field, value] of splitAtLabels(line)) {
        if (field === "stop") continue;
        if (field === "receiptHeader") {
          // Layout text: the values are on the next row. Flowed text: they follow the label.
          if (!header.date) header = parseReceiptRow(value || lines[i + 1] || "");
          continue;
        }
        if (values[field] === undefined && !blank(value)) values[field] = value;
      }
    });

    const reference = cleanId(values.transactionId) ?? header.receiptNo;
    const total = money(values.total);
    const amount = header.settled !== undefined && header.settled > 0 ? header.settled : total;
    const senderName = cleanName(values.payerName);
    const receiverName = cleanName(values.receiverName) ?? cleanName(values.receiverBusinessName);
    const senderAccount = cleanAccount(values.payerAccount);
    const receiverAccount = cleanAccount(values.receiverAccount);
    const date = header.date ?? lines.join(" ").slice(0, MAX_TEXT_CHARS).match(DATE_TIME_RE)?.slice(1, 3).join(" ");

    return {
      verified: !!(reference && amount !== undefined && amount > 0 && (senderName || receiverName || senderAccount || receiverAccount)),
      senderName,
      senderAccount,
      receiverName,
      receiverAccount,
      amount,
      currency: "ETB",
      date,
      reference,
      invoiceNumber: header.receiptNo,
      settledAmount: header.settled,
      serviceFee: money(values.serviceFee),
      serviceFeeVat: money(values.vat),
      discountAmount: money(values.discount),
      totalPaid: total,
      amountInWords: cleanText(values.amountInWords),
      paymentMode: cleanText(values.paymentMethod, 60),
      transactionType: cleanText(values.transactionType, 60),
      paymentChannel: cleanText(values.paymentChannel, 60),
      reason: cleanText(values.reason),
      transactionStatus: cleanText(values.status, 40),
    };
  }

  /** Same as parseLines for a block of text (one line per "\n"). */
  static parsePdfText(text: string): ParsedReceipt {
    return MpesaParser.parseLines(String(text ?? "").slice(0, MAX_TEXT_CHARS * 2).split("\n"));
  }

  /**
   * Envelope to receipt: validate the envelope, decode and size-check the PDF,
   * extract its text and map the fields. The shared verification gate still
   * runs on the result in the verifier.
   */
  static async parseEnvelope(data: string | Buffer): Promise<{ parsed: ParsedReceipt; envelope: MpesaEnvelope }> {
    const envelope = MpesaParser.decodeEnvelope(data);
    if (!envelope.ok) return { parsed: { verified: false, raw: `envelope: ${envelope.reason}` }, envelope };
    const lines = await MpesaParser.extractPdfLines(envelope.pdf);
    let parsed = MpesaParser.parseLines(lines);
    if (!parsed.reference) {
      // Some layouts put a value before its label in row order; flowed text keeps it after.
      try {
        const { extractText, getDocumentProxy } = await import("unpdf");
        const { text } = await extractText(await getDocumentProxy(new Uint8Array(envelope.pdf)), { mergePages: true });
        const flowed = MpesaParser.parsePdfText(text || "");
        if (flowed.reference) parsed = flowed;
      } catch {
        // keep the layout result
      }
    }
    return { parsed, envelope };
  }
}
