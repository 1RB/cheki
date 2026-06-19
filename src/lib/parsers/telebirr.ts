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
    const html = data.toString();
    if (
      html.includes("This request is not correct") ||
      !html.toLowerCase().includes("telebirr receipt")
    ) {
      return { verified: false, raw: html.slice(0, 500) };
    }

    // Convert HTML to text lines, preserving table cell boundaries
    const text = html
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

    // Helper: find value after a label (checks both English and Amharic)
    function valAfter(en: string, am?: string): string | undefined {
      for (let i = 0; i < text.length; i++) {
        const line = text[i];
        if (line.includes(en) || (am && line.includes(am))) {
          // The value might be on the same line (label concatenated with value)
          // or on the next line
          const afterLabel = line.split(en)[1] || (am ? line.split(am)[1] : "");
          if (afterLabel && afterLabel.trim()) {
            const cleaned = afterLabel.trim().replace(/^[.\-:]+/, "").trim();
            if (cleaned) return cleaned;
          }
          if (am) {
            const afterAm = line.split(am)[1];
            if (afterAm && afterAm.trim()) {
              const cleaned = afterAm.trim().replace(/^[.\-:]+/, "").trim();
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
      const parts = bankAccountRaw.split(/\s{2,}/).map((s) => s.trim()).filter(Boolean);
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
