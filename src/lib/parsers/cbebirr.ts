/**
 * CBE Birr parser — Commercial Bank of Ethiopia mobile wallet.
 *
 * Endpoint: https://cbepay1.cbe.com.et/aureceipt?TID={ref}&PH={phone}
 * Response: HTML (ASP.NET page with Telerik report viewer)
 * Requires: transaction reference + payer phone number
 *
 * The receipt data is rendered in the HTML body when the TID and PH
 * match a real transaction. With invalid params, the page shows an
 * empty report viewer with no transaction data.
 */
import { BaseParser } from "./base";
import type { ParsedReceipt } from "../core/types";

export class CBEBirrParser extends BaseParser {
  readonly bankId = "cbebirr";
  readonly bankName = "CBE Birr";
  readonly responseType = "html" as const;
  readonly requiresAccount = false;
  readonly accountDigits?: number = undefined;
  readonly requiresPhone = true;

  buildUrl(ref: string, _account?: string, phone?: string): string {
    const ph = phone || "";
    return `https://cbepay1.cbe.com.et/aureceipt?TID=${encodeURIComponent(ref)}&PH=${encodeURIComponent(ph)}`;
  }

  parse(data: string | Buffer, _contentType: string): ParsedReceipt {
    const html = data.toString();

    // ASP.NET empty form — no receipt data
    if (html.length < 500) {
      return { verified: false };
    }

    // Strip scripts and styles, extract text
    const text = this.stripHtml(html);

    // Check for error indicators
    if (text.includes("No receipt found") || text.includes("Invalid transaction") || text.includes("not found")) {
      return { verified: false };
    }

    // The CBE Birr receipt contains transaction details in table cells
    // Look for common receipt field patterns
    const fields = this.extractFields(text);

    const senderName = fields["sender name"] || fields["payer name"] || fields["sender"] || fields["payer"];
    const receiverName = fields["receiver name"] || fields["beneficiary name"] || fields["receiver"] || fields["beneficiary"];
    const amountStr = fields["amount"] || fields["transaction amount"] || fields["transferred amount"];
    const date = fields["date"] || fields["transaction date"] || fields["time"];
    const reference = fields["reference"] || fields["transaction id"] || fields["transaction reference"] || fields["receipt no"];
    const status = fields["status"] || fields["transaction status"];
    const senderAccount = fields["sender account"] || fields["payer account"] || fields["from account"];
    const receiverAccount = fields["receiver account"] || fields["beneficiary account"] || fields["to account"];
    const phone = fields["phone"] || fields["mobile"] || fields["phone number"] || fields["payer phone"];

    let amount: number | undefined;
    if (amountStr) {
      const m = amountStr.replace(/[^0-9.]/g, "");
      if (m) amount = parseFloat(m);
    }

    // Must have at least some transaction data to be verified
    if (!senderName && !receiverName && !amount) {
      return { verified: false };
    }

    const result: ParsedReceipt = {
      verified: true,
      senderName,
      receiverName,
      senderAccount: senderAccount || phone,
      receiverAccount,
      amount: Number.isFinite(amount) ? amount : undefined,
      currency: "ETB",
      date,
      reference,
    };

    if (status) result.transactionStatus = status;

    return result;
  }

  private stripHtml(html: string): string {
    return html
      .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, "")
      .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, "")
      .replace(/<br\s*\/?>/gi, "\n")
      .replace(/<\/td>\s*<td[^>]*>/gi, ":\t")
      .replace(/<\/tr>/gi, "\n")
      .replace(/<\/div>/gi, "\n")
      .replace(/<\/p>/gi, "\n")
      .replace(/<[^>]+>/g, " ")
      .replace(/&nbsp;/g, " ")
      .replace(/&amp;/g, "&")
      .replace(/&lt;/g, "<")
      .replace(/&gt;/g, ">")
      .replace(/&quot;/g, '"')
      .replace(/&#39;/g, "'")
      .replace(/[ \t]+/g, " ")
      .replace(/\n[ \t]*\n/g, "\n")
      .trim();
  }

  private extractFields(text: string): Record<string, string> {
    const fields: Record<string, string> = {};
    const lines = text.split("\n");

    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed) continue;

      // "Label: value" pattern
      const colonMatch = trimmed.match(/^([^:]+):\s*(.+)$/);
      if (colonMatch) {
        const key = colonMatch[1].trim().toLowerCase();
        const value = colonMatch[2].trim();
        if (value && !fields[key]) {
          fields[key] = value;
        }
        continue;
      }

      // "Label\tvalue" pattern (from table cells)
      const tabMatch = trimmed.match(/^([^\t]+)\t(.+)$/);
      if (tabMatch) {
        const key = tabMatch[1].trim().toLowerCase();
        const value = tabMatch[2].trim();
        if (value && !fields[key]) {
          fields[key] = value;
        }
      }
    }

    return fields;
  }
}
