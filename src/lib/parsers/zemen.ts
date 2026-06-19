/**
 * Zemen Bank parser.
 *
 * Endpoint: https://share.zemenbank.com/rt/{ref}/pdf
 * Response: PDF with structured text
 * Requires: only the transaction reference number (no account needed)
 */
import { BaseParser } from "./base";
import type { ParsedReceipt } from "../core/types";

export class ZemenParser extends BaseParser {
  readonly bankId = "zemen";
  readonly bankName = "Zemen Bank";
  readonly responseType = "pdf" as const;
  readonly requiresAccount = false;
  readonly accountDigits?: number = undefined;
  readonly requiresPhone = false;

  buildUrl(ref: string): string {
    return `https://share.zemenbank.com/rt/${ref}/pdf`;
  }

  parse(data: string | Buffer, _contentType: string): ParsedReceipt {
    const buf = Buffer.isBuffer(data) ? data : Buffer.from(data);
    if (!buf.toString("ascii", 0, 4).includes("%PDF")) {
      return { verified: false };
    }
    // PDF parsing is async; verifier calls extractPdfText + parseZemenPdfText separately.
    return { verified: false };
  }

  static parsePdfText(text: string): ParsedReceipt {
    if (!text || (!text.includes("Zemen") && !text.includes("ETTB"))) {
      return { verified: false };
    }

    // Zemen PDF labels - we extract values by finding each label and slicing to the next
    const labels = [
      "Transaction Reference:",
      "Transaction Date:",
      "Transaction Amount:",
      "Service Charge",
      "VAT",
      "Total Amount",
      "Sender Name:",
      "Sender Account:",
      "Receiver Name:",
      "Receiver Account:",
      "Receiver Bank:",
      "Narrative:",
      "Payment Reason:",
      "Status:",
      "Currency:",
    ];

    const values: Record<string, string> = {};
    for (let i = 0; i < labels.length; i++) {
      const label = labels[i];
      const startIdx = text.indexOf(label);
      if (startIdx === -1) continue;
      const valueStart = startIdx + label.length;
      let valueEnd = text.length;
      for (let j = i + 1; j < labels.length; j++) {
        const nextIdx = text.indexOf(labels[j], valueStart);
        if (nextIdx !== -1) {
          valueEnd = nextIdx;
          break;
        }
      }
      values[label] = text.slice(valueStart, valueEnd).trim();
    }

    // Parse amount - Zemen amounts may be prefixed with ETB or just numeric
    let amount: number | undefined;
    const amountRaw = values["Transaction Amount:"] || values["Total Amount"];
    if (amountRaw) {
      const m = amountRaw.match(/(?:ETB\s*)?([0-9,]+\.\d{2})/);
      if (m) amount = parseFloat(m[1].replace(/,/g, ""));
    }

    return {
      verified: !!(
        (values["Sender Name:"] || values["Receiver Name:"]) &&
        amount &&
        (values["Transaction Reference:"] || text.includes("ETTB"))
      ),
      senderName: values["Sender Name:"],
      senderAccount: values["Sender Account:"],
      receiverName: values["Receiver Name:"],
      receiverAccount: values["Receiver Account:"],
      amount,
      currency: values["Currency:"] || "ETB",
      date: values["Transaction Date:"],
      reference: values["Transaction Reference:"],
      reason: values["Narrative:"] || values["Payment Reason:"],
      transactionStatus: values["Status:"],
    };
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
