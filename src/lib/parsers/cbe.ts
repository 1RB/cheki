/**
 * CBE parser - Commercial Bank of Ethiopia.
 *
 * Two formats (banks.json `formats`, current first):
 * 1. Current (CBENewParser): the Receipt ID from a mbreciept.cbe.com.et link
 *    or QR code, read through the JSON API at mb.cbe.com.et. No account.
 * 2. Legacy (CBEParser): FT reference + last 8 digits of the receiving
 *    account, a PDF from apps.cbe.com.et:100. Still tried, often unreachable.
 */
import { BaseParser, BROWSER_UA } from "./base";
import type { ParsedReceipt, Result, HttpResult } from "../core/types";
import { ok, err } from "../core/types";
import { parseMoney } from "../core/money";
import { safeFetch, describeFetchError, MAX_PDF_BYTES, MAX_TEXT_BYTES } from "../http/safe-fetch";
import { HostNotAllowedError } from "../security/hosts";
import { getBank } from "../manifest/loader";

function str(v: unknown): string | undefined {
  if (typeof v === "string") return v.trim() || undefined;
  if (typeof v === "number" && Number.isFinite(v)) return String(v);
  return undefined;
}

export class CBEParser extends BaseParser {
  readonly bankId = "cbe";
  readonly bankName = "Commercial Bank of Ethiopia";
  readonly responseType = "pdf" as const;
  readonly requiresAccount = true;
  readonly accountDigits = 8;
  readonly requiresPhone = false;

  buildUrl(ref: string, account?: string): string {
    const suffix = (account || "").replace(/\D/g, "").slice(-8);
    return `https://apps.cbe.com.et:100/?id=${encodeURIComponent(ref)}${suffix}`;
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

    // Payer: "PayerMr Abebe..." or "Payer\nMr Abebe..." or "Payer Mr Abebe..."
    const payerMatch = text.match(/Payer\s*(?:\n+|\s+)?(Mr\s+|Mrs\s+|Ms\s+)?(.+?)(?:\n|$|Account|Receiver)/);
    if (payerMatch) {
      senderName = ((payerMatch[1] || "") + (payerMatch[2] || "")).trim();
    }

    // Receiver: "ReceiverTIGIST ALEMU" or "Receiver\nTIGIST..."
    const receiverMatch = text.match(/Receiver\s*(?:\n+|\s+)?(.+?)(?:\n|$|Account|Payment)/);
    if (receiverMatch) {
      receiverName = receiverMatch[1].trim();
    }

    // Accounts: "Account1****4321" - find all
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

    // Reference: "Reference No. (VAT Invoice No)FT26SAMPLE01" or with space
    const refMatch = text.match(/Reference No\.?\s*\(VAT Invoice No\)?\s*(\S+)/);
    if (refMatch) reference = refMatch[1];

    // Branch: value appears before "Payment / Transaction Information"
    const branchMatch = text.match(/([A-Z][A-Z ]+?)\s*\n?\s*Payment\s*\/\s*Transaction Information/);
    if (branchMatch) branch = branchMatch[1].trim();

    // Reason: "Reason / Type of service..." 
    const reasonMatch = text.match(/Reason\s*\/\s*Type of service\s*(.+?)(?:\n|$|Transferred)/);
    if (reasonMatch) reason = reasonMatch[1].trim();

    // The bank name alone (e.g. an error page on the CBE host) is not a
    // receipt. Require the amount, a party and the reference.
    const verified = !!(amount !== undefined && amount > 0 && (senderName || receiverName) && reference);

    return {
      verified,
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

  /**
   * Legacy CBE (FT reference + account). apps.cbe.com.et:100 is often
   * unreachable (links.et reports it down since July 2026), so a failure
   * points the user at the current format: the receipt link or Receipt ID.
   */
  async fetchReceipt(
    ref: string,
    account?: string,
    _phone?: string,
    _options?: { fallbackUrl?: string }
  ): Promise<Result<HttpResult>> {
    const gone =
      "CBE's older receipt service (FT reference + account) did not answer. Ask the sender for the receipt link or Receipt ID from the CBE app (mbreciept.cbe.com.et).";
    try {
      const resp = await safeFetch(this.buildUrl(ref, account), {
        headers: { "User-Agent": BROWSER_UA },
        timeoutMs: 30000,
        maxBytes: MAX_PDF_BYTES,
      });

      if (resp.status === 404) {
        return err({
          kind: "EXTRACTION_ERROR" as const,
          bank: this.bankName,
          message: "Receipt not found. Check the reference number and account suffix.",
        });
      }

      if (resp.status < 200 || resp.status >= 300) {
        return err({ kind: "ENDPOINT_ERROR" as const, bank: this.bankName, message: gone });
      }

      return ok({ status: resp.status, data: resp.body, contentType: "application/pdf" });
    } catch (e) {
      return err({
        kind: "ENDPOINT_ERROR" as const,
        bank: this.bankName,
        message: e instanceof HostNotAllowedError ? describeFetchError(e) : gone,
      });
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

  private static readonly API_URL = "https://mb.cbe.com.et/api/v1/transactions/public/transaction-detail";
  /**
   * The CBE web app's headers, from the manifest (the current CBE format).
   * Without X-App-ID / X-App-Version the API answers 400; links.et also sends
   * Origin and Referer, so cheki does too.
   */
  private static readonly HEADERS: Record<string, string> = {
    ...(getBank("cbe")?.formats?.find((f) => f.parser === "cbe-new")?.headers ?? getBank("cbe-new")?.headers ?? {}),
    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
    "Accept": "application/json",
  };

  buildUrl(ref: string): string {
    return `${CBENewParser.API_URL}/${encodeURIComponent(ref)}`;
  }

  parse(data: string | Buffer, _contentType: string): ParsedReceipt {
    try {
      const json = JSON.parse(data.toString());
      if (!json || typeof json !== "object") return { verified: false };
      const id = str(json.id);
      if (!id) return { verified: false };

      const debitHolder = str(json.debitAccountHolder);
      const creditHolder = str(json.creditAccountHolder);
      const debitAccount = str(json.debitAccountNo);
      const creditAccount = str(json.creditAccountNo);
      // "1,250.00" used to parse as 1 with parseFloat.
      const amount = parseMoney(json.amountCredited) ?? parseMoney(json.amountDebited);
      const currency = str(json.creditCurrency) || "ETB";
      const date = Array.isArray(json.dateTimes) ? str(json.dateTimes[0]) : undefined;
      const reason = Array.isArray(json.paymentDetails) ? str(json.paymentDetails[0]) : undefined;

      return {
        verified: !!(amount !== undefined && amount > 0 && (debitHolder || creditHolder || debitAccount || creditAccount)),
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
  ): Promise<Result<HttpResult>> {
    try {
      const resp = await safeFetch(this.buildUrl(ref), {
        headers: CBENewParser.HEADERS,
        timeoutMs: 10000,
        maxBytes: MAX_TEXT_BYTES,
      });
      if (resp.status === 404) {
        return err({
          kind: "EXTRACTION_ERROR" as const,
          bank: this.bankName,
          message: "Receipt not found. Check the link or reference.",
        });
      }
      if (resp.status < 200 || resp.status >= 300) {
        return err({
          kind: "ENDPOINT_ERROR" as const,
          bank: this.bankName,
          message: "CBE receipt service unavailable. Try again.",
        });
      }
      return ok({ status: resp.status, data: resp.body.toString("utf8"), contentType: "application/json" });
    } catch (e) {
      return err({
        kind: "ENDPOINT_ERROR" as const,
        bank: this.bankName,
        message: `Failed to reach CBE receipt service: ${describeFetchError(e)}`,
      });
    }
  }
}
