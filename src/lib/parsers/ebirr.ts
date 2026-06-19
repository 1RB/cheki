/**
 * eBirr parser - eBirr mobile money platform.
 *
 * Covers 5 partner banks through a single receipt endpoint:
 *   - Nib International Bank (tenant: nib)
 *   - Wegagen Bank (tenant: wegagen)
 *   - Ahadu Bank (tenant: ahadu)
 *   - KAAFI Microfinance (tenant: kaafimf)
 *   - Cooperative Bank of Oromia / Siinqee (tenant: varies, may use own domain)
 *
 * Endpoint: https://receipt.ebirr.com/{tenant}/{token}
 * Response: HTML receipt page with transaction details
 *
 * The user provides either:
 *   - A full URL: https://receipt.ebirr.com/nib/abc123def
 *   - A "tenant/token" string: nib/abc123def
 *
 * The receipt HTML contains transaction details in a table-based layout.
 * Without a valid token, the server returns a "Not Found Page" (HTTP 200, red H1).
 */
import { BaseParser } from "./base";
import type { ParsedReceipt } from "../core/types";

// Map tenant codes to bank names
const TENANT_MAP: Record<string, string> = {
  nib: "Nib International Bank",
  wegagen: "Wegagen Bank",
  ahadu: "Ahadu Bank",
  kaafimf: "KAAFI Microfinance",
  coop: "Cooperative Bank of Oromia",
  siinqee: "Siinqee Bank",
};

export class EBirrParser extends BaseParser {
  readonly bankId = "ebirr";
  readonly bankName = "eBirr";
  readonly responseType = "html" as const;
  readonly requiresAccount = false;
  readonly accountDigits?: number = undefined;
  readonly requiresPhone = false;

  buildUrl(ref: string): string {
    // ref can be either:
    //   "nib/abc123" (tenant/token format)
    //   "https://receipt.ebirr.com/nib/abc123" (full URL)
    const cleaned = ref.trim();

    // If it's already a full URL, use it directly
    if (cleaned.startsWith("http")) {
      return cleaned;
    }

    // Otherwise, treat it as tenant/token
    return `https://receipt.ebirr.com/${cleaned}`;
  }

  parse(data: string | Buffer, _contentType: string): ParsedReceipt {
    const html = data.toString();

    // Check for "Not Found Page" - eBirr returns this for invalid tokens
    if (html.includes("Not Found Page") || html.includes('color: red')) {
      return { verified: false, raw: html.slice(0, 500) };
    }

    try {
      const receipt = this.parseHtmlReceipt(html);
      return receipt;
    } catch {
      return { verified: false, raw: html.slice(0, 500) };
    }
  }

  /**
   * Parse the eBirr HTML receipt.
   * The receipt uses a table-based layout with label/value pairs.
   * Common fields: sender name, receiver name, amount, date, reference, status.
   */
  private parseHtmlReceipt(html: string): ParsedReceipt {
    // Extract text content, stripping HTML tags
    const text = this.stripHtml(html);

    // Check if it looks like a valid receipt
    if (text.length < 20) {
      return { verified: false, raw: html.slice(0, 500) };
    }

    // Parse key-value pairs from the receipt
    const fields = this.extractFields(text);

    // Extract tenant from the URL if available (passed via raw)
    const tenantMatch = html.match(/receipt\.ebirr\.com\/([^/]+)/i);
    const tenant = tenantMatch?.[1]?.toLowerCase();

    // Map common eBirr receipt fields
    const senderName = fields["sender"] || fields["payer"] || fields["from"] || fields["sender name"] || fields["payer name"];
    const receiverName = fields["receiver"] || fields["payee"] || fields["to"] || fields["receiver name"] || fields["beneficiary"];
    const amountStr = fields["amount"] || fields["transferred amount"] || fields["transfer amount"];
    const date = fields["date"] || fields["transaction date"] || fields["time"];
    const reference = fields["reference"] || fields["transaction id"] || fields["ref"] || fields["transaction reference"];
    const status = fields["status"] || fields["transaction status"];
    const senderAccount = fields["sender account"] || fields["from account"] || fields["payer account"];
    const receiverAccount = fields["receiver account"] || fields["to account"] || fields["payee account"];
    const phone = fields["phone"] || fields["mobile"] || fields["phone number"];

    // Parse amount
    let amount: number | undefined;
    if (amountStr) {
      const m = amountStr.replace(/[^0-9.]/g, "");
      if (m) amount = parseFloat(m);
    }

    const bankName = tenant ? TENANT_MAP[tenant] : undefined;

    const result: ParsedReceipt = {
      verified: !!(senderName || receiverName || amount),
      senderName,
      receiverName,
      senderAccount,
      receiverAccount,
      amount: Number.isFinite(amount) ? amount : undefined,
      currency: "ETB",
      date,
      reference,
      raw: html.slice(0, 1000),
    };

    if (status) result.transactionStatus = status;
    if (phone) result.senderAccount = phone;
    if (bankName) result.bankAccountName = bankName;

    return result;
  }

  /**
   * Strip HTML tags and decode entities to get plain text.
   */
  private stripHtml(html: string): string {
    return html
      .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, "")
      .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, "")
      .replace(/<br\s*\/?>/gi, "\n")
      .replace(/<\/td>\s*<td[^>]*>/gi, ":\t")
      .replace(/<\/tr>/gi, "\n")
      .replace(/<\/div>/gi, "\n")
      .replace(/<\/p>/gi, "\n")
      .replace(/<div[^>]*>/gi, "")
      .replace(/<p[^>]*>/gi, "")
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

  /**
   * Extract key-value pairs from receipt text.
   * Looks for patterns like "Label: value" or "Label\tvalue" (from table cells).
   */
  private extractFields(text: string): Record<string, string> {
    const fields: Record<string, string> = {};
    const lines = text.split("\n");

    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed) continue;

      // Try "Label: value" pattern
      const colonMatch = trimmed.match(/^([^:]+):\s*(.+)$/);
      if (colonMatch) {
        const key = colonMatch[1].trim().toLowerCase();
        const value = colonMatch[2].trim();
        if (value && !fields[key]) {
          fields[key] = value;
        }
        continue;
      }

      // Try "Label\tvalue" pattern (from table cells)
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
