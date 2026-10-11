/**
 * CBE Birr parser - Commercial Bank of Ethiopia mobile wallet.
 *
 * Endpoint: https://cbepay1.cbe.com.et/aureceipt?TID={ref}&PH={phone}
 * Requires: transaction reference (receipt number) + payer phone number
 *
 * Response type is not yet confirmed with a real receipt in this repo:
 *   - An unknown TID/PH returns HTTP 200 with an empty Telerik ReportViewer
 *     shell (ASP.NET page titled "Auto Receipt", no transaction data).
 *   - Another open-source verifier (Vixen878/verifier-api,
 *     src/services/verifyCBEBirr.ts) reads a real receipt as a PDF and uses
 *     these labels: Debit Account, Credit Account, Receiver Name, Order ID,
 *     Transaction Status, Reference, Receipt Number, Paid amount,
 *     Service charge, VAT, Total Paid Amount, Payment Reason, Payment Channel.
 *
 * So this parser accepts both: PDF text (via the verifier, which extracts
 * text first) and HTML (label/value table cells). The bank stays
 * "in-development" in the manifest until a real receipt confirms the layout.
 */
import { BaseParser } from "./base";
import type { ParsedReceipt } from "../core/types";
import { removeScriptsAndStyles, TAG_RE } from "../core/html";
import { parseMoney } from "../core/money";

/**
 * A real receipt is a few KB of text. Everything below is linear time, and the
 * text is also capped, because parse() is reachable with pasted content.
 */
const MAX_TEXT = 50_000;

/** Labels seen on real CBE Birr receipts (see header comment for source). */
export const CBEBIRR_LABELS = [
  "Debit Account",
  "Credit Account",
  "Receiver Name",
  "Order ID",
  "Transaction Status",
  "Reference",
  "Receipt Number",
  "Transaction Date",
  "Paid amount",
  "Service charge",
  "VAT",
  "Total Paid Amount",
  "Payment Reason",
  "Payment Channel",
] as const;

function toNumber(raw: string | undefined): number | undefined {
  return parseMoney(raw);
}

/** Trim whitespace and colons from both ends (linear; `[\s:]+$` is quadratic). */
function clean(v: string | undefined): string | undefined {
  if (!v) return undefined;
  const isTrim = (c: string) => c === ":" || /\s/.test(c);
  let a = 0;
  let b = v.length;
  while (a < b && isTrim(v[a])) a++;
  while (b > a && isTrim(v[b - 1])) b--;
  const out = v.slice(a, b).replace(/\s+/g, " ");
  return out || undefined;
}

/**
 * Text between the first `start` label and the nearest following `end` label
 * (case-insensitive), or undefined. indexOf-based, so linear time.
 */
function between(text: string, lower: string, start: string, ends: string[], maxLen = 200): string | undefined {
  const i = lower.indexOf(start.toLowerCase());
  if (i === -1) return undefined;
  const from = i + start.length;
  let to = -1;
  for (const e of ends) {
    const j = lower.indexOf(e.toLowerCase(), from);
    if (j !== -1 && (to === -1 || j < to)) to = j;
  }
  if (to === -1) return undefined;
  if (to - from > maxLen) return undefined;
  return text.slice(from, to);
}

export class CBEBirrParser extends BaseParser {
  readonly bankId = "cbebirr";
  readonly bankName = "CBE Birr";
  readonly responseType = "html" as const;
  readonly requiresAccount = false;
  readonly accountDigits?: number = undefined;
  readonly requiresPhone = true;
  /** Read the body as bytes: a real receipt may be a PDF, a miss is HTML. */
  readonly binaryResponse = true;

  buildUrl(ref: string, _account?: string, phone?: string): string {
    const ph = phone || "";
    return `https://cbepay1.cbe.com.et/aureceipt?TID=${encodeURIComponent(ref)}&PH=${encodeURIComponent(ph)}`;
  }

  /**
   * Sync parse for HTML responses. A PDF body returns verified=false here;
   * the verifier extracts PDF text and calls parseText instead.
   */
  parse(data: string | Buffer, _contentType: string): ParsedReceipt {
    const buf = Buffer.isBuffer(data) ? data : Buffer.from(data);
    if (CBEBirrParser.isPdf(buf)) return { verified: false };
    return CBEBirrParser.parseText(CBEBirrParser.htmlToText(buf.toString("utf8")));
  }

  static isPdf(buf: Buffer): boolean {
    return buf.toString("ascii", 0, 5).includes("%PDF");
  }

  /** True when the HTML is the empty Telerik ReportViewer shell (unknown TID/PH). */
  static isEmptyShell(html: string): boolean {
    const text = CBEBirrParser.htmlToText(html);
    return /ReportViewer|Telerik/i.test(html) && !CBEBIRR_LABELS.some((l) => text.includes(l));
  }

  static htmlToText(html: string): string {
    return removeScriptsAndStyles(html)
      .replace(/<br\s*\/?>/gi, "\n")
      .replace(/<\/t[dh]>\s*<t[dh][^<>]*>/gi, "\t")
      .replace(/<\/tr>/gi, "\n")
      .replace(/<\/(div|p|li|h\d)>/gi, "\n")
      .replace(TAG_RE, " ")
      .replace(/&nbsp;/g, " ")
      .replace(/&lt;/g, "<")
      .replace(/&gt;/g, ">")
      .replace(/&quot;/g, '"')
      .replace(/&#39;/g, "'")
      .replace(/&amp;/g, "&")
      .replace(/[ ]+/g, " ")
      .replace(/\n[ \t]*\n+/g, "\n")
      .trim();
  }

  /** "Label: value" or "Label<TAB>value" lines, keyed by lowercased label. */
  private static lineFields(text: string): Record<string, string> {
    const fields: Record<string, string> = {};
    const known = CBEBIRR_LABELS.map((l) => l.toLowerCase());
    for (const raw of text.split("\n")) {
      // Label lines are short; skipping long ones keeps the lazy match linear.
      if (raw.length > 300) continue;
      const line = raw.trim();
      const m = line.match(/^([^:\t]+?)\s*(?::|\t)\s*(.+)$/);
      if (!m) continue;
      const key = m[1].trim().toLowerCase();
      if (!known.includes(key)) continue;
      const value = m[2].trim();
      if (value && !fields[key]) fields[key] = value;
    }
    return fields;
  }

  /**
   * Parse receipt text from either layout:
   *   - HTML: one "Label: value" per row.
   *   - PDF (pdf-parse/unpdf text): values follow labels in the account block,
   *     the financial values come before their labels, and the payment block
   *     lists labels before values.
   */
  static parseText(input: string): ParsedReceipt {
    if (!input) return { verified: false };
    const text = input.length > MAX_TEXT ? input.slice(0, MAX_TEXT) : input;
    const lower = text.toLowerCase();
    const f = CBEBirrParser.lineFields(text);
    const get = (label: string) => clean(f[label.toLowerCase()]);
    const near = (label: string, after: number) => {
      const i = lower.indexOf(label.toLowerCase());
      return i === -1 ? undefined : text.slice(i + label.length, i + label.length + after);
    };

    const subCity = clean(between(text, lower, "Sub city:", ["Wereda/kebele:"]));
    const senderName = subCity && /^[A-Z][A-Z ]+$/.test(subCity) ? subCity : undefined;
    const debitAccount = get("Debit Account") ?? clean(between(text, lower, "Debit Account", ["Credit Account"]));
    const creditAccount = get("Credit Account") ?? clean(between(text, lower, "Credit Account", ["Receiver Name"]));
    const receiverName = get("Receiver Name") ?? clean(between(text, lower, "Receiver Name", ["Order ID"]));
    const orderId = get("Order ID") ?? clean(near("Order ID", 80)?.match(/^\s*([A-Z0-9]+)/i)?.[1]);
    const transactionStatus = get("Transaction Status") ?? clean(near("Transaction Status", 80)?.match(/^\s*([A-Za-z]+)/)?.[1]);
    let reference = get("Reference");
    if (!reference) {
      const m = text.match(/(?:^|\n)[ \t]*Reference/i);
      if (m && m.index !== undefined) {
        const from = m.index + m[0].length;
        const tail = text.slice(from, from + 200);
        const tailLower = tail.toLowerCase();
        let to = tail.length;
        for (const e of ["transaction details", "receipt number", "የኢትዮጵያ", "commercial bank"]) {
          const j = tailLower.indexOf(e);
          if (j !== -1 && j < to) to = j;
        }
        reference = clean(tail.slice(0, to));
      }
    }

    // PDF row: receipt number, date and amount run together, e.g.
    // "CHK0000001" "2026-10-01 14:05" "1500.00" => "CHK00000012026-10-01 14:051500.00"
    const row = text.match(/([A-Z0-9]{10})(\d{4}-\d{2}-\d{2}[ \t]{1,4}\d{2}:\d{2})([\d.,]{1,20})/);
    const receiptNumber = get("Receipt Number") ?? (row ? row[1] : undefined);
    const date = get("Transaction Date") ?? (row ? row[2] : undefined);
    const rowAmount = row ? toNumber(row[3]) : undefined;

    // PDF financial block: four values, then the labels. Only the 200
    // characters before "Paid amount" are searched.
    const paidAt = lower.indexOf("paid amount");
    const finWindow = paidAt === -1 ? "" : text.slice(Math.max(0, paidAt - 200), paidAt + "paid amount".length);
    const fin = finWindow.match(/([\d.,]{1,20})\s+([\d.,]{1,20})\s+([\d.,]{1,20})\s+([\d.,]{1,20})\s+Paid amount$/i);
    const paidAmount = toNumber(get("Paid amount")) ?? (fin ? toNumber(fin[1]) : undefined);
    const serviceCharge = toNumber(get("Service charge")) ?? (fin ? toNumber(fin[2]) : undefined);
    const vat = toNumber(get("VAT")) ?? (fin ? toNumber(fin[3]) : undefined);
    const totalPaid = toNumber(get("Total Paid Amount")) ?? (fin ? toNumber(fin[4]) : undefined);

    // PDF payment block: "Payment Channel" then amount in words, reason, channel.
    let paymentReason = get("Payment Reason");
    let paymentChannel = get("Payment Channel");
    let amountInWords: string | undefined;
    if (!paymentReason || !paymentChannel) {
      const block = near("Payment Channel", 600);
      const lines = block
        ?.split("\n")
        .slice(1)
        .map((l) => l.trim())
        .filter(Boolean);
      if (block && /^[ \t]*\n/.test(block) && lines && lines.length >= 3) {
        amountInWords = clean(lines[0]);
        paymentReason = paymentReason ?? clean(lines[1]);
        paymentChannel = paymentChannel ?? clean(lines[2]);
      }
    }

    const amount = paidAmount ?? rowAmount ?? totalPaid;
    const hasId = Boolean(receiptNumber || orderId || reference);
    const hasParty = Boolean(receiverName || creditAccount || debitAccount || senderName);
    if (!hasId || amount === undefined || !hasParty) return { verified: false };

    const result: ParsedReceipt = {
      verified: true,
      senderName,
      senderAccount: debitAccount,
      receiverName,
      receiverAccount: creditAccount,
      amount,
      currency: "ETB",
      date,
      reference: receiptNumber ?? reference,
      orderId,
      transactionStatus,
      serviceFee: serviceCharge,
      serviceFeeVat: vat,
      totalPaid,
      reason: paymentReason,
      paymentChannel,
      amountInWords,
    };
    for (const k of Object.keys(result) as (keyof ParsedReceipt)[]) {
      if (result[k] === undefined) delete result[k];
    }
    return result;
  }

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
}
