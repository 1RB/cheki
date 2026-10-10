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
  if (!raw) return undefined;
  const m = raw.replace(/,/g, "").match(/\d+(?:\.\d+)?/);
  if (!m) return undefined;
  const n = parseFloat(m[0]);
  return Number.isFinite(n) ? n : undefined;
}

function clean(v: string | undefined): string | undefined {
  if (!v) return undefined;
  const out = v.replace(/\s+/g, " ").replace(/^[\s:]+|[\s:]+$/g, "").trim();
  return out || undefined;
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
    return html
      .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, "")
      .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, "")
      .replace(/<br\s*\/?>/gi, "\n")
      .replace(/<\/t[dh]>\s*<t[dh][^>]*>/gi, "\t")
      .replace(/<\/tr>/gi, "\n")
      .replace(/<\/(div|p|li|h\d)>/gi, "\n")
      .replace(/<[^>]+>/g, " ")
      .replace(/&nbsp;/g, " ")
      .replace(/&amp;/g, "&")
      .replace(/&lt;/g, "<")
      .replace(/&gt;/g, ">")
      .replace(/&quot;/g, '"')
      .replace(/&#39;/g, "'")
      .replace(/[ ]+/g, " ")
      .replace(/\n[ \t]*\n+/g, "\n")
      .trim();
  }

  /** "Label: value" or "Label<TAB>value" lines, keyed by lowercased label. */
  private static lineFields(text: string): Record<string, string> {
    const fields: Record<string, string> = {};
    const known = CBEBIRR_LABELS.map((l) => l.toLowerCase());
    for (const raw of text.split("\n")) {
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
  static parseText(text: string): ParsedReceipt {
    if (!text) return { verified: false };
    const f = CBEBirrParser.lineFields(text);
    const get = (label: string) => clean(f[label.toLowerCase()]);
    const rx = (re: RegExp) => clean(text.match(re)?.[1]);

    const senderName = rx(/Sub city:\s+([A-Z][A-Z\s]+?)\s+Wereda\/kebele:/);
    const debitAccount = get("Debit Account") ?? rx(/Debit Account\s*([\s\S]*?)(?=\s*Credit Account)/i);
    const creditAccount = get("Credit Account") ?? rx(/Credit Account\s*([\s\S]*?)(?=\s*Receiver Name)/i);
    const receiverName = get("Receiver Name") ?? rx(/Receiver Name\s*([\s\S]*?)(?=\s*Order ID)/i);
    const orderId = get("Order ID") ?? rx(/Order ID\s*([A-Z0-9]+)/i);
    const transactionStatus = get("Transaction Status") ?? rx(/Transaction Status\s*([A-Za-z]+)/i);
    const reference =
      get("Reference") ??
      rx(/(?:^|\n)\s*Reference[\s:]*([\s\S]*?)(?=\s*(?:Transaction Details|Receipt Number|የኢትዮጵያ|Commercial Bank|$))/i);

    // PDF row: receipt number, date and amount run together, e.g.
    // "CHK0000001" "2026-10-01 14:05" "1500.00" => "CHK00000012026-10-01 14:051500.00"
    const row = text.match(/([A-Z0-9]{10})(\d{4}-\d{2}-\d{2}\s+\d{2}:\d{2})([\d.,]+)/);
    const receiptNumber = get("Receipt Number") ?? (row ? row[1] : undefined);
    const date = get("Transaction Date") ?? (row ? row[2] : undefined);
    const rowAmount = row ? toNumber(row[3]) : undefined;

    // PDF financial block: four values, then the labels.
    const fin = text.match(/([\d.,]+)\s+([\d.,]+)\s+([\d.,]+)\s+([\d.,]+)\s+Paid amount/i);
    const paidAmount = toNumber(get("Paid amount")) ?? (fin ? toNumber(fin[1]) : undefined);
    const serviceCharge = toNumber(get("Service charge")) ?? (fin ? toNumber(fin[2]) : undefined);
    const vat = toNumber(get("VAT")) ?? (fin ? toNumber(fin[3]) : undefined);
    const totalPaid = toNumber(get("Total Paid Amount")) ?? (fin ? toNumber(fin[4]) : undefined);

    // PDF payment block: "Payment Channel" then amount in words, reason, channel.
    let paymentReason = get("Payment Reason");
    let paymentChannel = get("Payment Channel");
    let amountInWords: string | undefined;
    if (!paymentReason || !paymentChannel) {
      const pm = text.match(/Payment Channel[ \t]*\n+\s*([^\n]+)\n+\s*([^\n]+)\n+\s*([^\n]+)/i);
      if (pm) {
        amountInWords = clean(pm[1]);
        paymentReason = paymentReason ?? clean(pm[2]);
        paymentChannel = paymentChannel ?? clean(pm[3]);
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
