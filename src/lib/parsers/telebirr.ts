/**
 * Telebirr parser - Ethio Telecom mobile wallet.
 *
 * Endpoint: https://transactioninfo.ethiotelecom.et/receipt/{ref}
 * Response: HTML receipt page with table-based layout
 * Geo-blocked from non-Ethiopian IPs.
 *
 * The receipt has 3 key tables:
 *   Table A: Payer info (name, telebirr no, account type, credited party, status, bank account)
 *   Table B: Invoice details (invoice no, date, settled amount, stamp duty, discount, service fee, VAT, total paid)
 *   Table C: Payment metadata (amount in words, payment mode, reason, channel, customer note)
 */
import { BaseParser } from "./base";
import type { ParsedReceipt } from "../core/types";

/**
 * Mobile "Select All" copy of a Telebirr receipt often concatenates every
 * label and value onto one line because the receipt is rendered with inline
 * elements and no visible line breaks. Insert a newline before each known
 * label so the existing line-based parser can extract values correctly.
 */
function normalizeReceiptText(text: string): string {
  const labels = [
    "Service fee VAT",
    "Service fee",
    "Total Paid Amount",
    "Total Amount in words",
    "Settled Amount",
    "Discount Amount",
    "Stamp Duty",
    "Payer telebirr no",
    "Payer account type",
    "Payer TIN No",
    "Payer Name",
    "VAT Reg. Date",
    "VAT Reg. No",
    "Credited party account no",
    "Credited Party name",
    "transaction status",
    "Bank account number",
    "Invoice details",
    "Invoice No.",
    "Payment date",
    "Payment Mode",
    "Payment Reason",
    "Payment channel",
    "Customer Note",
  ];
  // Sort longest first so "Service fee VAT" is not split into "Service fee" + " VAT"
  const sorted = labels
    .map((l) => l.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"))
    .sort((a, b) => b.length - a.length);
  const regex = new RegExp(`(${sorted.join("|")})`, "g");
  const labeled = text.replace(regex, (match, _p1: string, offset: number, str: string) => {
    if (offset === 0 || str[offset - 1] === "\n") return match;
    return "\n" + match;
  });
  return restructureInvoiceSection(labeled);
}

/**
 * Mobile "Select All" often groups all invoice-detail labels together in one
 * column and then dumps every value after the last label. Detect that pattern
 * and restructure the lines so each label is followed by its own value.
 */
function restructureInvoiceSection(text: string): string {
  const lines = text.split("\n");
  const invoiceNoIdx = lines.findIndex((l) => /Invoice\s*No\.?/i.test(l));
  const settledIdx = lines.findIndex((l) => l.includes("Settled Amount"));
  const stampIdx = lines.findIndex((l) => l.includes("Stamp Duty"));

  if (invoiceNoIdx === -1 || settledIdx === -1 || stampIdx === -1) return text;
  if (settledIdx >= stampIdx) return text;

  // The value blob is concatenated on the same line as "Settled Amount":
  // Settled Amount{REF}{DD-MM-YYYY HH:MM:SS}{AMOUNT} Birr ...
  const settledLine = lines[settledIdx];
  const valueText = settledLine.replace(/Settled\s*Amount/i, "").trim();

  const match = valueText.match(
    /^([A-Z]{2,3}[A-Z0-9]{6,8})(\d{2}-\d{2}-\d{4}\s+\d{2}:\d{2}:\d{2})(\d+\.?\d*)\s*Birr/
  );

  if (match) {
    const [, ref, date, amount] = match;
    const section = ["Invoice No.", ref, "Payment date", date, "Settled Amount", amount + " Birr"];
    const newLines = [...lines];
    newLines.splice(invoiceNoIdx, settledIdx - invoiceNoIdx + 1, ...section);
    return newLines.join("\n");
  }

  // Case 2: HTML rendered as two columns so labels appear first, then their values.
  // Collect the first three non-label values after the grouped labels and pair them.
  const invoiceLabels = ["Invoice No.", "Payment date", "Settled Amount"];
  const knownLabels = new Set([
    ...invoiceLabels,
    "Stamp Duty",
    "Discount Amount",
    "Service fee",
    "Service fee VAT",
    "Total Paid Amount",
    "Total Amount in words",
  ]);

  const values: string[] = [];
  let valueEndIdx = settledIdx + 1;
  for (let i = settledIdx + 1; i < stampIdx; i++) {
    const line = lines[i];
    const isKnownLabel = [...knownLabels].some((label) => line.includes(label));
    if (isKnownLabel) continue;
    values.push(line);
    if (values.length === 3) {
      valueEndIdx = i + 1;
      break;
    }
  }

  if (values.length < 3) return text;
  const [ref, date, amount] = values;
  if (!/^\d{2}-\d{2}-\d{4}\s+\d{2}:\d{2}:\d{2}$/.test(date)) return text;
  if (!/^\d[\d,]*\.?\d*\s*Birr$/i.test(amount)) return text;

  const section = ["Invoice No.", ref, "Payment date", date, "Settled Amount", amount];
  const newLines = [...lines];
  newLines.splice(invoiceNoIdx, valueEndIdx - invoiceNoIdx, ...section);
  return newLines.join("\n");
}

export class TelebirrParser extends BaseParser {
  readonly bankId = "telebirr";
  readonly bankName = "Telebirr";
  readonly responseType = "html" as const;
  readonly requiresAccount = false;
  readonly accountDigits?: number = undefined;
  readonly requiresPhone = false;
  readonly geoBlocked = true;

  buildUrl(ref: string): string {
    return `https://transactioninfo.ethiotelecom.et/receipt/${ref}`;
  }

  parse(data: string | Buffer, _contentType: string): ParsedReceipt {
    const raw = data.toString();
    if (
      raw.includes("This request is not correct") ||
      !raw.toLowerCase().includes("telebirr receipt")
    ) {
      return { verified: false, raw: raw.slice(0, 500) };
    }

    // Convert HTML to text lines, preserving table cell boundaries
    let text = raw
      .replace(/<\/td>/gi, "\n")
      .replace(/<\/tr>/gi, "\n")
      .replace(/<[^>]+>/g, "\n")
      .replace(/&nbsp;/g, " ")
      .replace(/&amp;/g, "&")
      .replace(/&lt;/g, "<")
      .replace(/&gt;/g, ">")
      .replace(/\n{2,}/g, "\n")
      .split("\n")
      .map((l) => l.trim())
      .filter((l) => l);

    // Normalize mobile "Select All" and HTML column layouts, then restructure
    // the invoice section so every label is followed by its own value.
    text = restructureInvoiceSection(normalizeReceiptText(text.join("\n")))
      .split("\n")
      .map((l) => l.trim())
      .filter((l) => l);

    // Helper: find value after a label (checks both English and Amharic)
    function valAfter(en: string, am?: string): string | undefined {
      for (let i = 0; i < text.length; i++) {
        const line = text[i];
        if (line.includes(en) || (am && line.includes(am))) {
          // The value might be on the same line (label concatenated with value)
          // or on the next line
          const afterLabel = line.split(en)[1] || (am ? line.split(am)[1] : "");
          if (afterLabel && afterLabel.trim()) {
            const cleaned = afterLabel
              .trim()
              .replace(/^[.\-:]+/, "")
              .replace(/[\u1200-\u137F].*\/\s*$/, "")
              .trim();
            if (cleaned) return cleaned;
          }
          if (am) {
            const afterAm = line.split(am)[1];
            if (afterAm && afterAm.trim()) {
              const cleaned = afterAm
                .trim()
                .replace(/^[.\-:]+/, "")
                .replace(/[\u1200-\u137F].*\/\s*$/, "")
                .trim();
              if (cleaned) return cleaned;
            }
          }
          // Look at next non-label line
          for (let j = i + 1; j < Math.min(i + 4, text.length); j++) {
            const next = text[j];
            // Skip if it's another label (contains Amharic chars + "/" separator)
            // Amharic Unicode range: U+1200-U+137F
            if (/[\u1200-\u137F]/.test(next) && next.includes("/")) continue;
            return next;
          }
        }
      }
      return undefined;
    }

    // Helper: extract a Birr amount from a line, looking ahead a few lines
    function birrAmount(label: string, am?: string): number | undefined {
      for (let i = 0; i < text.length; i++) {
        const line = text[i];
        if (line.includes(label) || (am && line.includes(am))) {
          // Check current line
          const m = line.match(/([0-9,]+\.?\d*)\s*(Birr|ETB)/i);
          if (m) return parseFloat(m[1].replace(/,/g, ""));
          // Look at next few lines for the amount
          for (let j = i + 1; j < Math.min(i + 4, text.length); j++) {
            const m2 = text[j].match(/([0-9,]+\.?\d*)\s*(Birr|ETB)/i);
            if (m2) return parseFloat(m2[1].replace(/,/g, ""));
          }
        }
      }
      return undefined;
    }

    // ── Payer info ──
    const senderName = valAfter("Payer Name", "\u12E8\u12A8\u12CD\u12FA\u12ED \u1235\u121B");
    const senderAccount = valAfter("Payer telebirr no", "\u12E8\u12A8\u12CD\u12FA\u12ED \u124C\u12EC\u12A5\u1228\u1201 \u1230\u1201");

    // ── Credited party ──
    const receiverName = valAfter("Credited Party name", "\u12E8\u1300\u12AD\u12F0\u12E5 \u1320\u1241\u124B\u12ED \u1235\u121B");
    // "Credited party account no" is telebirr's internal account (e.g. "0003"), NOT the real bank account
    const receiverAccount = valAfter("Credited party account no", "\u12E8\u1300\u12AD\u12F0\u12E5 \u1320\u1241\u124B\u12ED \u124C\u12EC\u12A5\u1228\u1201 \u1230\u1201");

    // ── Bank account (the REAL recipient bank account) ──
    // "Bank account number" contains both the account and name, e.g. "1000370251685   Mr Mohammed Abdulwasi Reshid"
    const bankAccountRaw = valAfter("Bank account number", "\u12E8\u1230\u12AD\u12AD \u12A0\u12AB\u12A0\u12CD\u12F5 \u1230\u1201\u120D");
    let bankAccountNumber: string | undefined;
    let bankAccountName: string | undefined;
    if (bankAccountRaw) {
      let parts = bankAccountRaw.split(/\s{2,}/).map((s) => s.trim()).filter(Boolean);
      // Mobile "Select All" collapses multiple spaces to one; split on the first space after the account number
      if (parts.length === 1) {
        const m = bankAccountRaw.match(/^(\d{10,})\s+(.+)$/);
        if (m) parts = [m[1], m[2]];
      }
      bankAccountNumber = parts[0];
      bankAccountName = parts.slice(1).join(" ") || undefined;
    }

    // ── Transaction status ──
    const transactionStatus = valAfter("transaction status", "\u12E8\u12AD\u12CD\u12EB\u12F0 \u12D5\u12AD\u12D5\u12AD");

    // ── Invoice details ──
    const invoiceNumber = valAfter("Invoice No", "\u12E8\u12AD\u12CD\u12EB \u1230\u1201");
    const settledAmount = birrAmount("Settled Amount", "\u12E8\u1300\u12A8\u12CD\u12F0\u12E5 \u1218\u12D5\u12D5");
    const stampDuty = birrAmount("Stamp Duty", "\u12E8\u1230\u12ED\u12A5\u12E5\u12EB \u12AD\u12CD\u12EB");
    const discountAmount = birrAmount("Discount Amount", "\u1305\u12D3\u12E5");
    const serviceFee = birrAmount("Service fee", "\u12E8\u12A0\u1300\u12CD\u12CD\u12A5\u12EB \u12AD\u12CD\u12EB");
    const serviceFeeVat = birrAmount("Service fee VAT", "\u12E8\u12A0\u1300\u12CD\u12CD\u12A5\u12EB \u12AD\u12CD\u12EB \u1320\u12A5\u12A5\u1320");
    const totalPaid = birrAmount("Total Paid Amount", "\u1300\u12AD\u12AD\u12E8\u12E5 \u12E8\u1300\u12A8\u12CD\u12F0\u12E5");

    // ── Payment metadata ──
    const amountInWords = valAfter("Total Amount in word", "\u12E8\u1300\u12D3\u12E5 \u12E8\u12AD\u12AD \u12A0\u12CD\u12F0\u12EB");
    const paymentMode = valAfter("Payment Mode", "\u12E8\u12AD\u12CD\u12EB \u12D5\u12F5");
    const reason = valAfter("Payment Reason", "\u12E8\u12AD\u12CD\u12EB \u121D\u12AD\u12D5\u12EB");
    const paymentChannel = valAfter("Payment channel", "\u12E8\u12AD\u12CD\u12EB \u1218\u12D5\u12CD");

    // ── Date ──
    let date: string | undefined;
    for (const line of text) {
      const m = line.match(/(\d{2}-\d{2}-\d{4}\s+\d{2}:\d{2}:\d{2})/);
      if (m) { date = m[1]; break; }
    }

    // Amount: use settledAmount (the actual transfer amount), fallback to first Birr match
    let amount = settledAmount;
    if (amount === undefined) {
      for (const line of text) {
        const m = line.match(/([0-9,]+\.?\d*)\s*(Birr|ETB)/i);
        if (m) { amount = parseFloat(m[1].replace(/,/g, "")); break; }
      }
    }

    return {
      verified: true,
      senderName,
      senderAccount,
      receiverName,
      receiverAccount,
      amount,
      currency: "ETB",
      date,
      reference: invoiceNumber,
      reason,
      invoiceNumber,
      transactionStatus,
      settledAmount,
      stampDuty,
      discountAmount,
      serviceFee,
      serviceFeeVat,
      totalPaid,
      amountInWords,
      paymentMode,
      paymentChannel,
      bankAccountNumber,
      bankAccountName,
      raw: text.join("\n").slice(0, 1500),
    };
  }
}
