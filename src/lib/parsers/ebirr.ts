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
import { removeScriptsAndStyles, TAG_RE } from "../core/html";
import { parseMoney } from "../core/money";
import { parseEbirrReference, buildEbirrUrl, type Checked } from "../security/reference";

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

  /**
   * Accepts "tenant/token" or a https://receipt.ebirr.com/tenant/token link and
   * returns the canonical "tenant/token". The link is never fetched as given.
   */
  normalizeReference(ref: string): Checked<string> {
    const parsed = parseEbirrReference(ref);
    if (!parsed.ok) return parsed;
    return { ok: true, value: `${parsed.value.tenant}/${parsed.value.token}` };
  }

  buildUrl(ref: string): string {
    // Always rebuilt from the fixed eBirr host. A full URL or anything that
    // does not parse as tenant/token is rejected (it used to be fetched as is,
    // which allowed SSRF and forged "verified" receipts).
    const parsed = parseEbirrReference(ref);
    if (!parsed.ok) throw new Error(parsed.message);
    return buildEbirrUrl(parsed.value.tenant, parsed.value.token);
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
    const amount = parseMoney(amountStr);

    const bankName = tenant ? TENANT_MAP[tenant] : undefined;

    const result: ParsedReceipt = {
      // A real receipt names a party, an amount, and a reference or a date.
      // One field alone (e.g. a page with only "To: support desk") is not a receipt.
      verified: !!((senderName || receiverName) && amount !== undefined && amount > 0 && (reference || date)),
      senderName,
      receiverName,
      senderAccount,
      receiverAccount,
      amount,
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
    return removeScriptsAndStyles(html)
      .replace(/<br\s*\/?>/gi, "\n")
      .replace(/<\/td>\s*<td[^<>]*>/gi, ":\t")
      .replace(/<\/tr>/gi, "\n")
      .replace(/<\/div>/gi, "\n")
      .replace(/<\/p>/gi, "\n")
      .replace(/<div[^<>]*>/gi, "")
      .replace(/<p[^<>]*>/gi, "")
      .replace(TAG_RE, " ")
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
