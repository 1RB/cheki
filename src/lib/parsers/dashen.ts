/**
 * Dashen Bank parser.
 *
 * Endpoint: https://receipts.dashenbanksc.com/receipt/{ref}
 * Response: HTML receipt page (the "Download Receipt" button renders a PDF
 *           client-side with html2pdf; the server only returns HTML).
 *           Unknown references return HTTP 400 with a JSON body
 *           ("Transaction not found").
 * Requires: only the FT Ref / Transaction Reference (e.g. B22WDTI00SAMPLE1).
 *           The app's long "Transaction Ref" / Transfer Reference
 *           (WDTI0000000000000000002) is NOT accepted by the endpoint.
 *
 * History: until mid-2026 receipts lived at receipt.dashensuperapp.com as
 * PDFs. That host now returns 502, which is why Dashen checks broke.
 * parsePdfText is kept for PDFs users upload or paste.
 */
import { BaseParser } from "./base";
import type { ParsedReceipt } from "../core/types";
import { removeScriptsAndStyles, TAG_RE } from "../core/html";
import { parseMoney } from "../core/money";

/** Shown when Dashen answers 400/404: it has no receipt for this reference. */
export const DASHEN_NOT_FOUND =
  "Dashen has no receipt for this reference. Use the FT Ref (e.g. B22WDTI00SAMPLE1), not the longer Transaction Ref.";

export class DashenParser extends BaseParser {
  readonly bankId = "dashen";
  readonly bankName = "Dashen Bank";
  readonly responseType = "html" as const;
  readonly requiresAccount = false;
  readonly accountDigits?: number = undefined;
  readonly requiresPhone = false;
  /** receipts.dashenbanksc.com answers an unknown reference with HTTP 400 JSON "Transaction not found". */
  protected override readonly notFoundStatuses: readonly number[] = [400, 404];
  protected override readonly notFoundMessage = DASHEN_NOT_FOUND;

  buildUrl(ref: string): string {
    return `https://receipts.dashenbanksc.com/receipt/${encodeURIComponent(ref.trim())}`;
  }

  parse(data: string | Buffer, _contentType: string): ParsedReceipt {
    const raw = Buffer.isBuffer(data) ? data.toString("utf8") : data;
    // PDFs need async text extraction; the verifier handles that path.
    if (raw.startsWith("%PDF")) return { verified: false };
    return DashenParser.parsePdfText(DashenParser.htmlToText(raw));
  }

  /**
   * Flatten the receipt HTML into the same single-line text the PDF yields.
   * Linear time: uses the shared helpers, not `<[^>]+>` / lazy `<script>`
   * regexes, which are quadratic on stray "<" or unclosed tags (ReDoS).
   */
  static htmlToText(html: string): string {
    return removeScriptsAndStyles(html)
      .replace(TAG_RE, " ")
      .replace(/&nbsp;/g, " ")
      .replace(/&#39;|&apos;/g, "'")
      .replace(/&quot;/g, '"')
      .replace(/&lt;/g, "<")
      .replace(/&gt;/g, ">")
      .replace(/&amp;/g, "&")
      .replace(/\s+/g, " ")
      .trim();
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
      "Beneficiary Bank Name:",
      "Institution Name:",
      "Instituton Name:",
      "Receiver Account Number:",
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

    // Each value runs from the end of its label to the start of the nearest
    // label that follows it in the text, whatever order the receipt uses.
    // (The HTML receipt puts Beneficiary Bank / Institution between Receiver
    // Name and Receiver Account, unlike the old PDF.)
    const found = labels
      .map((label) => ({ label, idx: text.indexOf(label) }))
      .filter((f) => f.idx !== -1)
      .sort((a, b) => a.idx - b.idx);
    const values: Record<string, string> = {};
    for (let i = 0; i < found.length; i++) {
      const { label, idx } = found[i];
      const valueStart = idx + label.length;
      let valueEnd = text.length;
      for (let j = i + 1; j < found.length; j++) {
        if (found[j].idx >= valueStart) {
          valueEnd = found[j].idx;
          break;
        }
      }
      values[label] = text.slice(valueStart, valueEnd).trim();
    }

    // Amount is prefixed with "ETB" in the PDF text, e.g. "ETB 20,475.00"
    let amount: number | undefined;
    const amountRaw = values["Transaction Amount"];
    if (amountRaw) {
      const etb = amountRaw.indexOf("ETB");
      amount = etb === -1 ? undefined : parseMoney(amountRaw.slice(etb + 3));
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
