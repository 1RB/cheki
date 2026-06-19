/**
 * Verifier — the orchestrator. Pure business logic, no direct I/O.
 *
 * Flow:
 *   1. Validate input (bank exists, reference present, account if required)
 *   2. Get parser from registry
 *   3. Fetch receipt data from bank endpoint (via parser's fetchReceipt)
 *   4. Parse the response into a ParsedReceipt
 *   5. Return a Receipt entity
 *
 * For CBE PDF: extract text first, then parse
 * For geo-blocked banks: the parser handles fallback URLs
 */
import type { Result, Receipt, VerifyRequest, ChekiError } from "./types";
import { ok, err } from "./types";
import { getParser } from "../parsers/registry";
import { getBank, suggestBank } from "../manifest/loader";
import { detectBankFromUrl, isUrl } from "../adapters/url-detector";
import { CBEParser } from "../parsers/cbe";
import { DashenParser } from "../parsers/dashen";
import { BOAParser } from "../parsers/boa";

export class Verifier {
  /**
   * Verify a single receipt.
   */
  async verify(request: VerifyRequest): Promise<Result<Receipt, ChekiError>> {
    const startTime = Date.now();
    let { bank, reference, accountNumber, phoneNumber, qrData } = request;

    // Validate reference (or QR data for BOA)
    if (!reference && !qrData) {
      return err({
        kind: "MISSING_INPUT",
        field: "reference",
        message: "Reference number, receipt URL, or QR data is required.",
      });
    }

    // Auto-detect bank from URL
    const trimmedRef = reference.trim();
    if (isUrl(trimmedRef)) {
      const detected = detectBankFromUrl(trimmedRef);
      if (detected) {
        bank = detected.bank;
        reference = detected.reference;
        if (detected.accountNumber && !accountNumber) {
          accountNumber = detected.accountNumber;
        }
      } else {
        return err({
          kind: "MISSING_INPUT",
          field: "reference",
          message: "Could not detect bank from URL. Please paste the reference number manually.",
        });
      }
    }

    // Validate bank
    if (!bank) {
      return err({
        kind: "MISSING_INPUT",
        field: "bank",
        message: "Bank is required.",
      });
    }

    const manifestEntry = getBank(bank);
    if (!manifestEntry) {
      const suggestion = suggestBank(bank);
      return err({
        kind: "BANK_NOT_SUPPORTED",
        bank,
        suggestion: suggestion && suggestion !== bank ? suggestion : undefined,
      });
    }

    // Check if bank is in development
    if (manifestEntry.status === "in-development") {
      return err({
        kind: "BANK_NOT_SUPPORTED",
        bank: bank,
        message: `${manifestEntry.name} is in development and not yet supported.`,
      } as ChekiError);
    }

    // Validate account number if required (skip for QR-based verification)
    if (manifestEntry.requiresAccount && !accountNumber && !qrData) {
      return err({
        kind: "MISSING_INPUT",
        field: "accountNumber",
        message: `${manifestEntry.name} requires the full receiving account number.`,
      });
    }

    // Get parser
    const parser = getParser(bank.toLowerCase());
    if (!parser) {
      return err({
        kind: "BANK_NOT_SUPPORTED",
        bank,
        message: `No parser registered for ${manifestEntry.name}.`,
      } as ChekiError);
    }

    // QR-based verification (BOA only for now)
    if (qrData) {
      if (parser.bankId !== "boa") {
        return err({
          kind: "EXTRACTION_ERROR",
          bank: manifestEntry.name,
          message: "QR code verification is only supported for Bank of Abyssinia receipts.",
        });
      }
      const boaParser = parser as BOAParser;
      const parsed = boaParser.decryptQr(qrData);
      const durationMs = Date.now() - startTime;
      if (!parsed.verified) {
        return err({
          kind: "EXTRACTION_ERROR",
          bank: manifestEntry.name,
          message: "Could not decrypt the QR code. It may be malformed or not a BOA receipt.",
        });
      }
      return ok({
        ...parsed,
        bank: manifestEntry.name,
        bankCode: manifestEntry.id,
        reference: parsed.reference || reference,
        sourceUrl: "qr://boa",
        durationMs,
      });
    }

    // Fetch receipt data
    const fallbackUrl = parser.buildUrl(reference, accountNumber, phoneNumber);
    const fetchResult = await parser.fetchReceipt(reference, accountNumber, phoneNumber, { fallbackUrl });

    if (!fetchResult.ok) {
      return fetchResult;
    }

    const { data, contentType } = fetchResult.value;
    const durationMs = Date.now() - startTime;

    // CBE PDF: special handling (extract text first)
    if (bank.toLowerCase() === "cbe") {
      const buf = Buffer.isBuffer(data) ? data : Buffer.from(data);
      if (!buf.toString("ascii", 0, 4).includes("%PDF")) {
        return err({
          kind: "EXTRACTION_ERROR",
          bank: manifestEntry.name,
          message: "The bank did not return a valid receipt PDF. The reference or account may be incorrect.",
        });
      }
      const text = await CBEParser.extractPdfText(buf);
      const parsed = CBEParser.parsePdfText(text);
      if (!parsed.verified) {
        return err({
          kind: "EXTRACTION_ERROR",
          bank: manifestEntry.name,
          message: "Could not parse the receipt PDF. The reference or account may be incorrect.",
        });
      }
      return ok({
        ...parsed,
        bank: manifestEntry.name,
        bankCode: manifestEntry.id,
        reference,
        sourceUrl: fallbackUrl,
        durationMs,
      });
    }

    // Dashen PDF: special handling (extract text first)
    if (bank.toLowerCase() === "dashen") {
      const buf = Buffer.isBuffer(data) ? data : Buffer.from(data);
      if (!buf.toString("ascii", 0, 4).includes("%PDF")) {
        return err({
          kind: "EXTRACTION_ERROR",
          bank: manifestEntry.name,
          message: "The bank did not return a valid receipt PDF. Check the reference number.",
        });
      }
      const text = await DashenParser.extractPdfText(buf);
      const parsed = DashenParser.parsePdfText(text);
      if (!parsed.verified) {
        return err({
          kind: "EXTRACTION_ERROR",
          bank: manifestEntry.name,
          message: "Could not parse the Dashen receipt PDF. Check the reference number.",
        });
      }
      return ok({
        ...parsed,
        bank: manifestEntry.name,
        bankCode: manifestEntry.id,
        reference: parsed.reference || reference,
        sourceUrl: fallbackUrl,
        durationMs,
      });
    }

    // All other banks: parse directly
    const parsed = parser.parse(data, contentType);
    if (!parsed.verified) {
      return err({
        kind: "EXTRACTION_ERROR",
        bank: manifestEntry.name,
        message: "Receipt not found or invalid.",
      });
    }

    return ok({
      ...parsed,
      bank: manifestEntry.name,
      bankCode: manifestEntry.id,
      reference: parsed.reference || reference,
      sourceUrl: fallbackUrl,
      durationMs,
    });
  }

  /**
   * Verify multiple receipts in parallel (batch).
   */
  async verifyBatch(requests: VerifyRequest[]): Promise<Result<Receipt, ChekiError>[]> {
    return Promise.all(requests.map((r) => this.verify(r)));
  }
}
