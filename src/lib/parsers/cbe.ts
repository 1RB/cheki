/**
 * CBE parser — Commercial Bank of Ethiopia.
 *
 * Two systems:
 * 1. Legacy: PDF receipt from apps.cbe.com.et:100 (requires FT ref + last 8 digits)
 * 2. New: JSON API at Mb.cbe.com.et (receipt ID from QR code / mbreciept.cbe.com.et URLs)
 */
import { BaseParser } from "./base";
import type { ParsedReceipt } from "../core/types";

export class CBEParser extends BaseParser {
  readonly bankId = "cbe";
  readonly bankName = "Commercial Bank of Ethiopia";
  readonly responseType = "pdf" as const;
  readonly requiresAccount = true;
  readonly accountDigits = 8;
  readonly requiresPhone = false;
  readonly sslVerify = false;

  buildUrl(ref: string, account?: string): string {
    const suffix = (account || "").slice(-8);
    return `https://apps.cbe.com.et:100/?id=${ref}${suffix}`;
  }

  parse(data: string | Buffer, _contentType: string): ParsedReceipt {
    const buf = Buffer.isBuffer(data) ? data : Buffer.from(data);
    if (!buf.toString("ascii", 0, 4).includes("%PDF")) {
      return { verified: false };
    }
    // PDF parsing is async (needs pdf-parse), so we return a placeholder.
    // The verifier calls extractPdfText + parseCBEPdfText separately.
    return { verified: false };
  }

  /**
   * Parse CBE PDF text into a ParsedReceipt.
   * Called by the verifier after extracting text from the PDF.
   */
  static parsePdfText(text: string): ParsedReceipt {
    if (!text || !text.includes("Commercial Bank of Ethiopia")) {
      return { verified: false };
    }

    // unpdf may output text with different formatting than pdf-parse.
    // Handle both concatenated (label+value on same line) and separated formats.
    
    let senderName: string | undefined;
    let receiverName: string | undefined;
    let senderAccount: string | undefined;
    let receiverAccount: string | undefined;
    let amount: number | undefined;
    let date: string | undefined;
    let reference: string | undefined;
    let branch: string | undefined;
    let reason: string | undefined;

    // Payer: "PayerMr Mohammed..." or "Payer\nMr Mohammed..." or "Payer Mr Mohammed..."
    const payerMatch = text.match(/Payer\s*(?:\n+|\s+)?(Mr\s+|Mrs\s+|Ms\s+)?(.+?)(?:\n|$|Account|Receiver)/);
    if (payerMatch) {
      senderName = ((payerMatch[1] || "") + (payerMatch[2] || "")).trim();
    }

    // Receiver: "ReceiverSAMI ADIL ZEKARIA" or "Receiver\nSAMI..."
    const receiverMatch = text.match(/Receiver\s*(?:\n+|\s+)?(.+?)(?:\n|$|Account|Payment)/);
    if (receiverMatch) {
      receiverName = receiverMatch[1].trim();
    }

    // Accounts: "Account1****1685" — find all
    const accountMatches = text.matchAll(/Account\s*([0-9*]+)/g);
    const accounts = Array.from(accountMatches).map((m) => m[1]);
    if (accounts.length >= 1) senderAccount = accounts[0];
    if (accounts.length >= 2) receiverAccount = accounts[1];

    // Amount: "Transferred Amount20,000.00 ETB" or "Transferred Amount 20,000.00 ETB"
    const amountMatch = text.match(/Transferred Amount\s*([0-9,]+\.\d{2})\s*ETB/);
    if (amountMatch) {
      amount = parseFloat(amountMatch[1].replace(/,/g, ""));
    }

    // Date: "Payment Date & Time5/20/2026, 7:29:00 PM" or with spaces
    const dateMatch = text.match(
      /Payment Date & Time\s*(\d{1,2}\/\d{1,2}\/\d{4}),?\s*(\d{1,2}:\d{2}:\d{2})\s*(AM|PM)?/
    );
    if (dateMatch) {
      date = `${dateMatch[1]} ${dateMatch[2]}`;
      if (dateMatch[3]) date += ` ${dateMatch[3]}`;
    }

    // Reference: "Reference No. (VAT Invoice No)FT26140P01YB" or with space
    const refMatch = text.match(/Reference No\.?\s*\(VAT Invoice No\)?\s*(\S+)/);
    if (refMatch) reference = refMatch[1];

    // Branch: value appears before "Payment / Transaction Information"
    const branchMatch = text.match(/([A-Z][A-Z ]+?)\s*\n?\s*Payment\s*\/\s*Transaction Information/);
    if (branchMatch) branch = branchMatch[1].trim();

    // Reason: "Reason / Type of service..." 
    const reasonMatch = text.match(/Reason\s*\/\s*Type of service\s*(.+?)(?:\n|$|Transferred)/);
    if (reasonMatch) reason = reasonMatch[1].trim();

    return {
      verified: true,
      senderName,
      senderAccount,
      receiverName,
      receiverAccount,
      amount,
      currency: "ETB",
      date,
      reference,
      branch,
      reason,
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

export class CBENewParser extends BaseParser {
  readonly bankId = "cbe-new";
  readonly bankName = "Commercial Bank of Ethiopia";
  readonly responseType = "json" as const;
  readonly requiresAccount = false;
  readonly accountDigits?: number = undefined;
  readonly requiresPhone = false;
  readonly sslVerify = false;

  private static readonly API_URL = "https://Mb.cbe.com.et/api/v1/transactions/public/transaction-detail";
  private static readonly HEADERS = {
    "X-App-ID": "d1292e42-7400-49de-a2d3-9731caa4c819",
    "X-App-Version": "0a01980b-9859-1369-8198-59f403820000",
    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
    "Accept": "application/json",
  };

  buildUrl(ref: string): string {
    return `${CBENewParser.API_URL}/${ref}`;
  }

  parse(data: string | Buffer, _contentType: string): ParsedReceipt {
    try {
      const json = JSON.parse(data.toString());
      const id = json.id as string;
      if (!id) return { verified: false };

      const debitHolder = json.debitAccountHolder as string;
      const creditHolder = json.creditAccountHolder as string;
      const debitAccount = json.debitAccountNo as string;
      const creditAccount = json.creditAccountNo as string;
      const amountStr = (json.amountCredited as string) || (json.amountDebited as string);
      const amount = amountStr ? parseFloat(amountStr) : undefined;
      const currency = (json.creditCurrency as string) || "ETB";
      const dateTimes = json.dateTimes as string[];
      const date = dateTimes?.[0] ?? undefined;
      const paymentDetails = json.paymentDetails as string[];
      const reason = paymentDetails?.[0] ?? undefined;

      return {
        verified: true,
        senderName: debitHolder,
        senderAccount: debitAccount,
        receiverName: creditHolder,
        receiverAccount: creditAccount,
        amount,
        currency,
        date,
        reference: id,
        reason,
      };
    } catch {
      return { verified: false };
    }
  }

  /**
   * Override fetchReceipt to add custom headers for CBE new API.
   */
  async fetchReceipt(
    ref: string,
    _account?: string,
    _phone?: string,
    _options?: { fallbackUrl?: string }
  ) {
    const url = this.buildUrl(ref);
    const { ok, err } = await import("../core/types");
    try {
      const resp = await fetch(url, {
        headers: CBENewParser.HEADERS,
        signal: AbortSignal.timeout(10000),
      });
      if (resp.status === 404) {
        return err({
          kind: "EXTRACTION_ERROR" as const,
          bank: this.bankName,
          message: "Receipt not found. Check the link or reference.",
        });
      }
      if (!resp.ok) {
        return err({
          kind: "ENDPOINT_ERROR" as const,
          bank: this.bankName,
          message: "CBE receipt service unavailable. Try again.",
        });
      }
      const data = await resp.text();
      return ok({ status: resp.status, data, contentType: "application/json" });
    } catch (e) {
      return err({
        kind: "ENDPOINT_ERROR" as const,
        bank: this.bankName,
        message: `Failed to reach CBE receipt service: ${e instanceof Error ? e.message : String(e)}`,
      });
    }
  }
}
