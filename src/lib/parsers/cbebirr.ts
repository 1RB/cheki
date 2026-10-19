/**
 * CBE Birr parser - Commercial Bank of Ethiopia mobile wallet.
 *
 * Endpoint: https://cbepay1.cbe.com.et/aureceipt?TID={ref}&PH={phone}
 * Requires: transaction reference (receipt number) + payer phone number
 *
 * Confirmed 2026-10-16 against two real receipts (a wallet-to-wallet "Send
 * Money" and a wallet-to-bank transfer), fetched from cheki's egress outside
 * Ethiopia, so the endpoint is not geo-blocked:
 *   - A matching TID/PH pair returns HTTP 200 application/pdf (~0.5 MB, one
 *     page, PDF 1.6) titled "VAT Invoice/ Customer Receipt", CBEBirr.
 *   - Its "Transaction Information" block is one "Label value" row per field:
 *     Debit Account ("<payer phone> - <PAYER NAME>"), Credit Account ("<wallet
 *     phone> - <NAME>" or a masked bank account "1000****1234 - <BANK>"),
 *     Receiver Name (sometimes "<phone> - <NAME>"), Order ID, Transaction
 *     Status, Reference (the payer's optional note, then ":"). Long names wrap
 *     onto a second row.
 *   - "Transaction Details": a header row, then "<receipt number> <yyyy-mm-dd
 *     HH:MM> <amount>" (Addis Ababa time, no offset), then Paid amount,
 *     Service Charge, Disaster Response Fee, VAT, Tip and Total Paid Amount,
 *     then Total Amount in word, Payment Reason and Payment Channel.
 *   - A wrong TID/PH pair (or an unknown TID) returns HTTP 200 with an empty
 *     Telerik ReportViewer shell (ASP.NET page titled "Auto Receipt", no
 *     data). The earlier "real receipt came back empty" report was a pair that
 *     did not match; links.et gets the same empty page for it. The verifier
 *     still reports the shell as "could not confirm" with the receipt link,
 *     never as "fake", because a typo in the phone gives the same page.
 *
 * The payer and receiver phone numbers are printed in full on the PDF; cheki
 * masks them (09****1234) before anything leaves the parser.
 *
 * Text comes in three shapes, all handled by parseText:
 *   - PDF rows from extractPdfText (positioned text grouped into visual rows,
 *     the real layout above);
 *   - flowed PDF text (labels and values in content-stream order, as other
 *     extractors produce it);
 *   - HTML label/value cells.
 */
import { BaseParser } from "./base";
import type { ParsedReceipt } from "../core/types";
import { removeScriptsAndStyles, TAG_RE } from "../core/html";
import { parseMoney } from "../core/money";
import { checkReference, type Checked } from "../security/reference";

/**
 * A real receipt is a few KB of text. Everything below is linear time, and the
 * text is also capped, because parse() is reachable with pasted content.
 */
const MAX_TEXT = 50_000;
/** The real receipt is one page with a few hundred text items. */
const MAX_PDF_PAGES = 4;
const MAX_PDF_ITEMS = 5_000;
/** Items whose baselines are this close (PDF points) share a row. */
const ROW_TOLERANCE = 3;

interface PositionedText {
  str: string;
  x: number;
  y: number;
  w: number;
}

/**
 * Group positioned text into rows: top to bottom, left to right, with a space
 * wherever there is a gap between items. Sorting is O(n log n) and n is capped.
 */
export function rowsFromItems(items: PositionedText[]): string {
  const sorted = [...items].sort((a, b) => b.y - a.y || a.x - b.x);
  const rows: PositionedText[][] = [];
  for (const it of sorted) {
    const row = rows[rows.length - 1];
    if (row && Math.abs(row[0].y - it.y) <= ROW_TOLERANCE) row.push(it);
    else rows.push([it]);
  }
  return rows
    .map((row) => {
      row.sort((a, b) => a.x - b.x);
      let line = "";
      let end = -Infinity;
      for (const it of row) {
        if (line && it.x > end + 0.5) line += " ";
        line += it.str;
        end = Math.max(end, it.x + it.w);
      }
      return line.replace(/\s+/g, " ").trim();
    })
    .filter(Boolean)
    .join("\n");
}

/** Labels seen on real CBE Birr receipts (see the header comment). */
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
  "Total Amount in word",
  "Payment Reason",
  "Payment Channel",
] as const;

/** A whole cell that is an amount: "1,250.50", "ETB 2,000.00", "2,000.00 ETB". */
const MONEY_VALUE_RE = /^(?:ETB\s?)?\d[\d,]{0,20}(?:\.\d{1,2})?(?:\s?(?:ETB|Birr))?$/i;
/** Labels whose value must be a number; a row like "VAT Registration No:011140" is not the VAT. */
const MONEY_LABELS = new Set(["paid amount", "service charge", "vat", "total paid amount"]);
/** Labels whose value is one id token; the header row "Receipt Number Transaction Date Amount" is not one. */
const ID_LABELS = new Set(["order id", "receipt number"]);
/** Rows whose value can wrap onto the next row (long names). */
const WRAPPING_LABELS = new Set(["debit account", "credit account", "receiver name"]);
/** Longest first, so "Total Paid Amount" wins over "Paid amount". */
const LABELS_BY_LENGTH = [...CBEBIRR_LABELS].map((l) => l.toLowerCase()).sort((a, b) => b.length - a.length);

/**
 * Mask a phone number or account number printed in full on the receipt.
 * Ethiopian mobile numbers keep their 09/07 (or 2519/2517) prefix and last 4
 * (0911223344 -> 09****3344); other long numbers keep their first digit and
 * last 4. Values the bank already masked (1000****1234) pass through.
 */
export function maskCbeBirrNumber(v: string | undefined): string | undefined {
  if (!v) return undefined;
  const s = v.replace(/\s+/g, "");
  if (!s) return undefined;
  if (s.includes("*")) return s;
  if (!/^\+?\d+$/.test(s)) return s;
  const d = s.replace(/^\+/, "");
  if (/^0[79]\d{8}$/.test(d)) return `${d.slice(0, 2)}****${d.slice(-4)}`;
  if (/^251[79]\d{8}$/.test(d)) return `${d.slice(0, 4)}****${d.slice(-4)}`;
  if (d.length <= 5) return "*".repeat(d.length);
  return `${d[0]}${"*".repeat(d.length - 5)}${d.slice(-4)}`;
}

/**
 * "0911223344 - TIGIST ALEMU" or "1000****1234 - CBE" -> number and name.
 * A value with no " - " separator is a name when it has letters, else a number.
 */
function splitParty(v: string | undefined): { number?: string; name?: string } {
  if (!v) return {};
  const m = v.match(/^\s*(\+?[\d*Xx]{6,20})\s*-\s*(.*)$/);
  if (m) return { number: m[1], name: clean(m[2]) };
  if (/^[\s\d*+Xx]+$/.test(v)) return { number: clean(v) };
  return { name: clean(v) };
}

/** TID: letters and digits only. Real ones are 10 or 11 characters. */
/** A CBE Birr receipt number (TID): 10 or 11 letters and digits, as in the SMS. */
const TID_RE = /^[A-Za-z0-9]{10,11}$/;

/**
 * The payer's wallet number as CBE Birr's receipt links carry it: 251 then 9
 * digits starting with 9 (Ethio telecom) or 7 (Safaricom). Accepts +251,
 * 251, 0 and bare 9-digit forms.
 */
export function normalizeCbeBirrPhone(input: string): Checked<string> {
  const digits = input.replace(/[\s()+-]/g, "");
  if (!/^\d+$/.test(digits)) return { ok: false, message: "Enter the payer's phone number using digits only." };
  let local: string | undefined;
  if (digits.length === 12 && digits.startsWith("251")) local = digits.slice(3);
  else if (digits.length === 10 && digits.startsWith("0")) local = digits.slice(1);
  else if (digits.length === 9) local = digits;
  if (!local || !/^[79]\d{8}$/.test(local)) {
    return { ok: false, message: "Enter the payer's CBE Birr phone number, e.g. 09XXXXXXXX or 2519XXXXXXXX." };
  }
  return { ok: true, value: `251${local}` };
}

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

  normalizeReference(ref: string): Checked<string> {
    const checked = checkReference(ref);
    if (!checked.ok) return checked;
    if (!TID_RE.test(checked.value)) {
      return { ok: false, message: "A CBE Birr receipt number is 10 or 11 letters and digits, as in the SMS." };
    }
    return checked;
  }

  normalizePhone(phone: string): Checked<string> {
    return normalizeCbeBirrPhone(phone);
  }

  buildUrl(ref: string, _account?: string, phone?: string): string {
    // Normalised here too, so every caller (probe, /api/receipt) sends the
    // same 251XXXXXXXXX form the bank's own links use.
    const n = phone ? normalizeCbeBirrPhone(phone) : undefined;
    const ph = n?.ok ? n.value : phone || "";
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

  /**
   * Label/value rows, keyed by lowercased label: "Label: value",
   * "Label<TAB>value" (HTML cells) or "Label value" (the real PDF's rows). A
   * value that does not fit its label (a word where a number belongs, the
   * table header where a receipt number belongs) is skipped, so a later row
   * with the same label can still fill it. A wrapped name row is joined to
   * the row before it.
   */
  private static lineFields(text: string): Record<string, string> {
    const fields: Record<string, string> = {};
    const known = CBEBIRR_LABELS.map((l) => l.toLowerCase());
    const lines = text.split("\n");
    for (let i = 0; i < lines.length; i++) {
      const raw = lines[i];
      // Label lines are short; skipping long ones keeps the lazy match linear.
      if (raw.length > 300) continue;
      const line = raw.trim();
      let key: string | undefined;
      let value: string | undefined;
      const m = line.match(/^([^:\t]+?)\s*(?::|\t)\s*(.+)$/);
      if (m && known.includes(m[1].trim().toLowerCase())) {
        key = m[1].trim().toLowerCase();
        value = m[2].trim();
      } else {
        const lower = line.toLowerCase();
        const label = LABELS_BY_LENGTH.find((l) => lower.startsWith(l) && /[\s:]/.test(line.charAt(l.length)));
        if (label) {
          key = label;
          value = clean(line.slice(label.length));
        }
      }
      if (!key || !value || fields[key]) continue;
      if (MONEY_LABELS.has(key) && !MONEY_VALUE_RE.test(value)) continue;
      if (ID_LABELS.has(key) && !/^[A-Za-z0-9]{4,32}$/.test(value)) continue;
      if (WRAPPING_LABELS.has(key)) {
        // "ABEBE KEBEDE\nTESFAYE": an all-caps row that is not a label continues the name.
        const next = lines[i + 1]?.trim() ?? "";
        const nextLower = next.toLowerCase();
        if (next && next.length <= 80 && /^[A-Z][A-Z .'-]*$/.test(next) && !LABELS_BY_LENGTH.some((l) => nextLower.startsWith(l))) {
          value = `${value} ${next}`;
        }
      }
      fields[key] = value;
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
    const customerName = clean(near("Customer Name:", 120)?.split("\n")[0]);
    const nameOk = (v: string | undefined) => (v && /^[A-Z][A-Za-z .'-]*$/.test(v) && /[A-Z]{2}/.test(v) ? v : undefined);
    const debit = splitParty(get("Debit Account") ?? clean(between(text, lower, "Debit Account", ["Credit Account"])));
    const credit = splitParty(get("Credit Account") ?? clean(between(text, lower, "Credit Account", ["Receiver Name"])));
    const receiver = splitParty(get("Receiver Name") ?? clean(between(text, lower, "Receiver Name", ["Order ID"])));
    // Payer: the name on the debit row, else the customer block. The account
    // is the payer's wallet number, masked.
    const senderName = debit.name ?? nameOk(customerName) ?? (subCity && /^[A-Z][A-Z ]+$/.test(subCity) ? subCity : undefined);
    const debitAccount = maskCbeBirrNumber(debit.number);
    const creditAccount = maskCbeBirrNumber(credit.number);
    // A wallet transfer prints "<phone> - <NAME>" as the receiver name too.
    // On a bank transfer the credit row's name is the bank ("- CBE"), so it
    // only stands in for the receiver when the credit account is a wallet.
    const walletCredit = Boolean(credit.number && /^(?:0|\+?251)[79]/.test(credit.number));
    const receiverName = receiver.name ?? (walletCredit ? credit.name : undefined);
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
    // Receipt numbers are 10 or 11 characters. Anchored at the start of a
    // line or a non-alphanumeric, the date's fixed "dddd-" shape decides the
    // split; a fixed {10} would drop the first character of an 11-character
    // number and the gate would then reject the real receipt.
    // The real PDF's row has spaces: "DTS41AB2C90 2026-10-01 09:15 1250.50".
    const row =
      text.match(/(?:^|[^A-Za-z0-9])([A-Z0-9]{10,12})[ \t]{0,4}(\d{4}-\d{2}-\d{2}[ \t]{1,4}\d{2}:\d{2}(?::\d{2})?)[ \t]{0,4}(\d[\d,]{0,20}(?:\.\d{1,2})?)/m) ??
      text.match(/([A-Z0-9]{10})(\d{4}-\d{2}-\d{2}[ \t]{1,4}\d{2}:\d{2})([\d.,]{1,20})/);
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
    let amountInWords = clean(get("Total Amount in word")?.replace(/\s*\.$/, ""));
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

  /**
   * PDF text as visual rows: positioned text items grouped by baseline (top
   * to bottom), each row's items ordered left to right. The real receipt
   * stores its values after all the labels in the content stream, so flowed
   * text cannot tell "Payment Reason" from "Payment Channel"; rows can.
   */
  static async extractPdfText(data: Buffer): Promise<string> {
    try {
      const { getDocumentProxy } = await import("unpdf");
      const pdf = await getDocumentProxy(new Uint8Array(data));
      const out: string[] = [];
      for (let p = 1; p <= Math.min(pdf.numPages, MAX_PDF_PAGES); p++) {
        const page = await pdf.getPage(p);
        const content = await page.getTextContent();
        const items: PositionedText[] = [];
        for (const it of content.items as unknown[]) {
          const t = it as { str?: unknown; transform?: unknown; width?: unknown };
          if (typeof t.str !== "string" || !t.str.trim() || !Array.isArray(t.transform)) continue;
          items.push({ str: t.str, x: Number(t.transform[4]) || 0, y: Number(t.transform[5]) || 0, w: Number(t.width) || 0 });
          if (items.length > MAX_PDF_ITEMS) break;
        }
        out.push(rowsFromItems(items));
      }
      const text = out.join("\n");
      return text.length > MAX_TEXT ? text.slice(0, MAX_TEXT) : text;
    } catch {
      return "";
    }
  }
}
