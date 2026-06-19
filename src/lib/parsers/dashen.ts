/**
 * Dashen Bank parser.
 *
 * Endpoint: https://api.dashensuperapp.com/receipts/Within-Dashen-Transfer-{ref}.pdf
 * Response: PDF with structured text
 * Requires: only the transaction reference number (no account needed)
 */
import { BaseParser } from "./base";
import type { ParsedReceipt } from "../core/types";

export class DashenParser extends BaseParser {
  readonly bankId = "dashen";
  readonly bankName = "Dashen Bank";
  readonly responseType = "pdf" as const;
  readonly requiresAccount = false;
  readonly accountDigits?: number = undefined;
  readonly requiresPhone = false;

  buildUrl(ref: string): string {
    return `https://api.dashensuperapp.com/receipts/Within-Dashen-Transfer-${ref}.pdf`;
  }

  parse(data: string | Buffer, _contentType: string): ParsedReceipt {
    const buf = Buffer.isBuffer(data) ? data : Buffer.from(data);
    if (!buf.toString("ascii", 0, 4).includes("%PDF")) {
      return { verified: false };
    }
    // PDF parsing is async; verifier calls extractPdfText + parseDashenPdfText separately.
    return { verified: false };
  }

  static parsePdfText(text: string): ParsedReceipt {
    if (!text || !text.includes("Dashen Bank")) {
      return { verified: false };
    }

    // The Dashen PDF is extracted as one long line by unpdf. We extract values
    // by finding the position of each known label and slicing up to the next label.
    const labels = [
      "Sender Name:",
      "Sender Account Number:",
      "Transaction Channel:",
      "Service Type:",
      "Narrative:",
      "Receiver Name:",
      "Receiver Account Number:",
      "Instituton Name:",
      "Transaction Reference:",
      "Transfer Reference:",
      "Transaction Date:",
      "Transaction Amount",
      "Service Charge",
      "Excise Tax (15%):",
      "DRRF Fee",
      "VAT (15%):",
      "Penalty Fee",
      "Income Tax Fee",
      "Tax",
      "Interest Fee",
      "Stamp Duty",
      "Discount Amount",
      "Total",
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

    // Amount is prefixed with "ETB" in the PDF text, e.g. "ETB 20,475.00"
    let amount: number | undefined;
    const amountRaw = values["Transaction Amount"];
    if (amountRaw) {
      const m = amountRaw.match(/ETB\s*([0-9,]+\.\d{2})/);
      if (m) amount = parseFloat(m[1].replace(/,/g, ""));
    }

    return {
      verified: !!(
        values["Sender Name:"] &&
        values["Receiver Name:"] &&
        amount &&
        values["Transaction Reference:"]
      ),
      senderName: values["Sender Name:"],
      senderAccount: values["Sender Account Number:"],
      receiverName: values["Receiver Name:"],
      receiverAccount: values["Receiver Account Number:"],
      amount,
      currency: "ETB",
      date: (() => {
        const raw = values["Transaction Date:"];
        if (!raw) return undefined;
        const m = raw.match(/[A-Z][a-z]{2}\s+\d{1,2},\s+\d{4},?\s+\d{1,2}:\d{2}:\d{2}\s*(?:am|pm)/i);
        return m ? m[0] : raw;
      })(),
      reference: values["Transaction Reference:"],
      reason: values["Narrative:"],
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
