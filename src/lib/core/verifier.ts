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

export class Verifier {
  /**
   * Verify a single receipt.
   */
  async verify(request: VerifyRequest): Promise<Result<Receipt, ChekiError>> {
    const startTime = Date.now();
    let { bank, reference, accountNumber, phoneNumber } = request;

    // Validate reference
    if (!reference) {
      return err({
        kind: "MISSING_INPUT",
        field: "reference",
        message: "Reference number or receipt URL is required.",
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

    // Validate account number if required
    if (manifestEntry.requiresAccount && !accountNumber) {
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
