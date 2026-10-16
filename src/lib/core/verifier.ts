/**
 * Verifier - the orchestrator. Pure business logic, no direct I/O.
 *
 * Flow:
 *   1. Resolve the input: a QR payload, a receipt link or a reference
 *      becomes (bank, reference, account, phone). Links are only used to
 *      extract those parts; the bank URL is always rebuilt from a fixed host.
 *   2. Gate the bank: it exists, is live, has a parser, and the account or
 *      phone it needs is present and well formed.
 *   3. Validate the reference (no path/query characters, strict charset).
 *   4. Fetch from the bank (allowlisted hosts only) and parse.
 *   5. Run the shared verification gate (amount, matching reference, a
 *      party, a non-failure status). It fails closed.
 *
 * BOA QR payloads are decrypted only to find the receipt, then looked up at
 * BOA like any other reference. They never verify on their own.
 *
 * Telebirr receipt QR payloads only carry the transaction number
 * (src/lib/qr/telebirr.ts). It is read out and checked exactly like a typed
 * Telebirr reference; nothing else from the QR is used.
 */
import type { Result, Receipt, VerifyRequest, ChekiError, ParsedReceipt, BankManifestEntry } from "./types";
import { ok, err } from "./types";
import { getParser, type RegisteredParser } from "../parsers/registry";
import { getBank, suggestBank } from "../manifest/loader";
import { detectBankFromUrl, isUrl, looksLikeUrl } from "../adapters/url-detector";
import { CBEParser } from "../parsers/cbe";
import { DashenParser, DASHEN_NOT_FOUND } from "../parsers/dashen";
import { BOAParser } from "../parsers/boa";
import { ZemenParser } from "../parsers/zemen";
import { CBEBirrParser } from "../parsers/cbebirr";
import { MpesaParser } from "../parsers/mpesa";
import { ZamZamParser } from "../parsers/zamzam";
import { verificationGate, gateFailureMessage } from "./gate";
import { checkAccountSuffix, checkPhone, checkReference } from "../security/reference";
import { parseTelebirrQr } from "../qr/telebirr";
import { selectFormat, formatNeeds, formatAccountDigits, fillTemplate } from "../manifest/formats";

/** Receipts verified at the same time in one batch. */
export const BATCH_CONCURRENCY = 5;
const MAX_QR_LENGTH = 4096;
const MAX_BANK_LENGTH = 32;

/** "Account on the receipt" → "account on the receipt" (keeps "FT" etc. intact). */
function lowerFirst(s: string): string {
  return s.charAt(0).toLowerCase() + s.slice(1);
}

function asOptionalString(v: unknown): string | undefined {
  return typeof v === "string" ? v : undefined;
}

/** Strip debugging data before a receipt leaves the core. */
function publicFields(parsed: ParsedReceipt): Omit<ParsedReceipt, "raw" | "verified"> {
  const rest: Partial<ParsedReceipt> = { ...parsed };
  delete rest.raw;
  delete rest.verified;
  return rest as Omit<ParsedReceipt, "raw" | "verified">;
}


/**
 * CBE Birr sent an empty receipt page. From cheki's servers that is not proof
 * of a fake: a real receipt fetched from outside Ethiopia looked the same.
 */
export const CBEBIRR_EMPTY_SHELL_MESSAGE =
  "CBE Birr sent back an empty receipt page, so this could not be confirmed. The receipt number and payer phone number may not match: check both, or open the receipt on CBE Birr's own site.";

export class Verifier {
  /**
   * Verify a single receipt. Never throws: unexpected failures become
   * INTERNAL_ERROR so one bad item cannot sink a batch.
   */
  async verify(request: VerifyRequest): Promise<Result<Receipt, ChekiError>> {
    const startTime = Date.now();
    try {
      return await this.resolve(request, startTime, 0);
    } catch {
      return err({ kind: "INTERNAL_ERROR", message: "Verification failed unexpectedly. Try again." });
    }
  }

  /**
   * Verify multiple receipts, at most BATCH_CONCURRENCY at a time, keeping
   * the input order.
   */
  async verifyBatch(requests: VerifyRequest[]): Promise<Result<Receipt, ChekiError>[]> {
    const results: Result<Receipt, ChekiError>[] = new Array(requests.length);
    let next = 0;
    const worker = async () => {
      while (next < requests.length) {
        const i = next++;
        results[i] = await this.verify(requests[i]);
      }
    };
    await Promise.all(Array.from({ length: Math.min(BATCH_CONCURRENCY, requests.length) }, worker));
    return results;
  }

  // ─── Input resolution ─────────────────────────────────────────────

  private async resolve(request: VerifyRequest, startTime: number, depth: number): Promise<Result<Receipt, ChekiError>> {
    if (depth > 2) {
      return err({ kind: "MISSING_INPUT", field: "reference", message: "Could not resolve this receipt." });
    }
    const bank = asOptionalString(request.bank);
    const reference = asOptionalString(request.reference)?.trim();
    const accountNumber = asOptionalString(request.accountNumber)?.trim() || undefined;
    const phoneNumber = asOptionalString(request.phoneNumber)?.trim() || undefined;
    const qrData = asOptionalString(request.qrData)?.trim();

    if (!reference && !qrData) {
      return err({
        kind: "MISSING_INPUT",
        field: "reference",
        message: "Reference number, receipt URL, or QR data is required.",
      });
    }

    // QR payloads
    if (qrData) {
      if (qrData.length > MAX_QR_LENGTH) {
        return err({ kind: "MISSING_INPUT", field: "qrData", message: "QR data is too long." });
      }
      // A Telebirr receipt QR (CRC-checked, so it can't be mistaken for a
      // BOA ciphertext). Only the transaction number inside is used.
      const telebirr = parseTelebirrQr(qrData);
      if (telebirr.ok) {
        const named = (bank || "").trim().toLowerCase();
        if (named && named !== "telebirr") {
          return err({
            kind: "MISSING_INPUT",
            field: "qrData",
            message: "This QR code is from a Telebirr receipt. Check it with bank \"telebirr\".",
          });
        }
        return this.resolve({ bank: "telebirr", reference: telebirr.reference }, startTime, depth + 1);
      }
      if ((bank || "").toLowerCase() === "boa") {
        return this.verifyBoaQr(qrData, startTime, depth);
      }
      if (looksLikeUrl(qrData)) {
        // Only a receipt link cheki recognises. An unknown URL is rejected,
        // never fetched or used as a reference.
        if (!isUrl(qrData) || !detectBankFromUrl(qrData)) {
          return err({
            kind: "MISSING_INPUT",
            field: "qrData",
            message: "This QR code is not a receipt link cheki recognises.",
          });
        }
        return this.resolve({ bank: bank ?? "", reference: qrData, accountNumber, phoneNumber }, startTime, depth + 1);
      }
      // Plain reference inside the QR, for the bank the caller named.
      return this.resolve({ bank: bank ?? "", reference: qrData, accountNumber, phoneNumber }, startTime, depth + 1);
    }

    let resolvedBank = bank;
    let resolvedRef = reference!;
    let resolvedAccount = accountNumber;
    let resolvedPhone = phoneNumber;

    // Receipt links. Anything with URL syntax must be a proper http(s) link
    // to a known bank host; "http:/x", "http:evil.com", "//x" are rejected.
    if (looksLikeUrl(resolvedRef)) {
      const detected = isUrl(resolvedRef) ? detectBankFromUrl(resolvedRef) : null;
      if (!detected) {
        return err({
          kind: "MISSING_INPUT",
          field: "reference",
          message: "Could not detect bank from URL. Please paste the reference number manually.",
        });
      }
      resolvedBank = detected.bank;
      resolvedRef = detected.reference;
      if (detected.accountNumber && !resolvedAccount) resolvedAccount = detected.accountNumber;
      if (detected.phoneNumber && !resolvedPhone) resolvedPhone = detected.phoneNumber;
    }

    return this.verifyReference(
      { bank: resolvedBank, reference: resolvedRef, accountNumber: resolvedAccount, phoneNumber: resolvedPhone },
      startTime
    );
  }

  // ─── Bank + input gates, fetch, parse, verification gate ─────────────

  private async verifyReference(
    input: { bank?: string; reference: string; accountNumber?: string; phoneNumber?: string },
    startTime: number
  ): Promise<Result<Receipt, ChekiError>> {
    const bank = input.bank;
    if (!bank) {
      return err({ kind: "MISSING_INPUT", field: "bank", message: "Bank is required." });
    }

    // Bank codes are short. A huge value is neither looked up, fuzzy-matched
    // (suggestBank is quadratic in its input) nor echoed back in full.
    if (bank.length > MAX_BANK_LENGTH) {
      return err({ kind: "BANK_NOT_SUPPORTED", bank: bank.slice(0, MAX_BANK_LENGTH) });
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

    if (manifestEntry.status === "in-development") {
      return err({
        kind: "BANK_NOT_SUPPORTED",
        bank,
        message: `${manifestEntry.name} is in development and not yet supported.`,
      });
    }

    // Pick the receipt format from the input's shape (current formats first).
    // This never costs a bank request: exactly one format is fetched.
    const selection = selectFormat(manifestEntry, input);
    if (!selection.ok) {
      return err({ kind: "MISSING_INPUT", field: selection.field, message: selection.message });
    }
    const format = selection.format;

    const parser = getParser((format?.parser ?? manifestEntry.id).toLowerCase());
    if (!parser) {
      return err({
        kind: "BANK_NOT_SUPPORTED",
        bank,
        message: `No parser registered for ${manifestEntry.name}.`,
      });
    }

    const needsAccount = format ? formatNeeds(format, "account") : manifestEntry.requiresAccount;
    const needsPhone = format ? formatNeeds(format, "phone") : Boolean(parser.requiresPhone || manifestEntry.requiresPhone);

    // Account number (only the suffix the bank needs, digits only)
    let account: string | undefined;
    if (needsAccount) {
      if (!input.accountNumber) {
        return err({
          kind: "MISSING_INPUT",
          field: "accountNumber",
          message: `${manifestEntry.name} requires the ${lowerFirst(manifestEntry.accountLabel || "account number")}.`,
        });
      }
      const digits = formatAccountDigits(format) ?? manifestEntry.accountDigits ?? parser.accountDigits ?? 1;
      const checked = checkAccountSuffix(input.accountNumber, digits);
      if (!checked.ok) return err({ kind: "MISSING_INPUT", field: "accountNumber", message: checked.message });
      account = checked.value;
    }

    // Phone number (CBE Birr)
    let phone: string | undefined;
    if (needsPhone) {
      if (!input.phoneNumber) {
        return err({
          kind: "MISSING_INPUT",
          field: "phoneNumber",
          message: `${manifestEntry.name} requires the payer's phone number.`,
        });
      }
      const checked = checkPhone(input.phoneNumber);
      if (!checked.ok) return err({ kind: "MISSING_INPUT", field: "phoneNumber", message: checked.message });
      // A bank may need one canonical form (CBE Birr: 251XXXXXXXXX, as in its own links).
      const canonical = parser.normalizePhone ? parser.normalizePhone(checked.value) : checked;
      if (!canonical.ok) return err({ kind: "MISSING_INPUT", field: "phoneNumber", message: canonical.message });
      phone = canonical.value;
    }

    // Reference: strict charset, no path or query characters.
    const refCheck = parser.normalizeReference(input.reference);
    if (!refCheck.ok) {
      return err({ kind: "REF_ERROR", bank: manifestEntry.name, message: refCheck.message });
    }
    const ref = refCheck.value;

    let fallbackUrl: string;
    try {
      fallbackUrl = parser.buildUrl(ref, account, phone);
    } catch (e) {
      return err({
        kind: "REF_ERROR",
        bank: manifestEntry.name,
        message: e instanceof Error ? e.message : "Invalid reference.",
      });
    }

    const fetchResult = await parser.fetchReceipt(ref, account, phone, { fallbackUrl });
    if (!fetchResult.ok) return fetchResult;

    const { data, contentType } = fetchResult.value;
    const parsedResult = await this.parseResponse(manifestEntry, parser, data, contentType, ref, fallbackUrl);
    if (!parsedResult.ok) return parsedResult;
    const parsed = parsedResult.value;

    // The gate is keyed by the parser (format), e.g. cbe-new looks receipts up by an opaque Receipt ID.
    const gate = verificationGate(parsed, { bankId: parser.bankId, requestedReference: ref });
    if (!gate.ok) {
      return err({ kind: "EXTRACTION_ERROR", bank: manifestEntry.name, message: gateFailureMessage(gate) });
    }

    return ok({
      ...publicFields(parsed),
      verified: true,
      bank: manifestEntry.name,
      bankCode: manifestEntry.id,
      reference: parsed.reference || ref,
      // The bank's own receipt page when the format has one people can open
      // (CBE's mbreciept link, Dashen's receipt page); otherwise the URL fetched.
      sourceUrl: format?.receiptPage === "redirect" && format.link ? fillTemplate(format.link, { ref, account, phone }) : fallbackUrl,
      durationMs: Date.now() - startTime,
    });
  }

  /** Bank-specific body handling (PDF text extraction) before the gate. */
  private async parseResponse(
    manifestEntry: BankManifestEntry,
    parser: RegisteredParser,
    data: string | Buffer,
    contentType: string,
    requestedReference: string,
    receiptUrl?: string
  ): Promise<Result<ParsedReceipt, ChekiError>> {
    // Keyed by the parser, not the bank: one bank can have a PDF format
    // (CBE legacy) and a JSON one (CBE current).
    const id = parser.bankId.toLowerCase();
    // PDF banks. `htmlOk` banks (Dashen) normally answer with an HTML receipt
    // page that parser.parse() reads below; a PDF from them (legacy host) is
    // still text-extracted here. Either way the result goes through the gate.
    const pdfParsers: Record<
      string,
      { extract: (b: Buffer) => Promise<string>; parse: (t: string) => ParsedReceipt; hint: string; htmlOk?: boolean }
    > = {
      cbe: { extract: CBEParser.extractPdfText, parse: CBEParser.parsePdfText, hint: "The reference or account may be incorrect." },
      dashen: { extract: DashenParser.extractPdfText, parse: DashenParser.parsePdfText, hint: "Check the FT Ref.", htmlOk: true },
      zemen: { extract: ZemenParser.extractPdfText, parse: ZemenParser.parsePdfText, hint: "Check the reference number." },
    };
    const pdf = Object.hasOwn(pdfParsers, id) ? pdfParsers[id] : undefined;

    if (pdf) {
      const buf = Buffer.isBuffer(data) ? data : Buffer.from(data);
      const isPdf = buf.toString("ascii", 0, 4).includes("%PDF");
      if (isPdf) {
        const parsed = pdf.parse(await pdf.extract(buf));
        if (!parsed.verified) {
          return err({
            kind: "EXTRACTION_ERROR",
            bank: manifestEntry.name,
            message: `Could not parse the receipt PDF. ${pdf.hint}`,
          });
        }
        return ok(parsed);
      }
      if (!pdf.htmlOk) {
        return err({
          kind: "EXTRACTION_ERROR",
          bank: manifestEntry.name,
          message: `The bank did not return a valid receipt PDF. ${pdf.hint}`,
        });
      }
    }

    // CBE Birr: a real receipt is a PDF (confirmed 2026-10-16); the body is
    // read as bytes, under the PDF size cap, and HTML is still parsed in case
    // the bank changes format. A TID/PH pair that does not match is an empty
    // Telerik shell. A typo in the phone gives the same page as a fake
    // receipt, so the shell is "could not confirm" (with a hint to check the
    // pair and CBE Birr's own receipt link), never "not found". A parsed
    // receipt still goes through the gate.
    if (id === "cbebirr") {
      const buf = Buffer.isBuffer(data) ? data : Buffer.from(data);
      const isPdf = CBEBirrParser.isPdf(buf);
      const html = isPdf ? "" : buf.toString("utf8");
      const parsed = CBEBirrParser.parseText(isPdf ? await CBEBirrParser.extractPdfText(buf) : CBEBirrParser.htmlToText(html));
      if (!parsed.verified) {
        if (html && CBEBirrParser.isEmptyShell(html)) {
          return err({
            kind: "ENDPOINT_ERROR",
            bank: manifestEntry.name,
            message: CBEBIRR_EMPTY_SHELL_MESSAGE,
            ...(receiptUrl ? { fallbackUrl: receiptUrl } : {}),
          });
        }
        return err({
          kind: "EXTRACTION_ERROR",
          bank: manifestEntry.name,
          message: "Could not read the CBE Birr receipt. Check the receipt number and the payer phone number.",
        });
      }
      return ok(parsed);
    }

    // M-Pesa: a JSON envelope carrying the receipt as a base64 PDF
    // ({responseCode, responseDescription, base64Data}). The envelope and the
    // decoded PDF are size-checked before any text extraction.
    if (id === "mpesa") {
      const { parsed, envelope } = await MpesaParser.parseEnvelope(data);
      if (!envelope.ok) {
        const message =
          envelope.reason === "upstream-error"
            ? `M-Pesa did not return a receipt for this transaction number${envelope.description ? ` (${envelope.description})` : ""}. Check the transaction number.`
            : envelope.reason === "too-large"
              ? "M-Pesa returned a receipt larger than cheki accepts."
              : "M-Pesa did not return a valid receipt.";
        return err({ kind: "EXTRACTION_ERROR", bank: manifestEntry.name, message });
      }
      if (!parsed.verified) {
        return err({
          kind: "EXTRACTION_ERROR",
          bank: manifestEntry.name,
          message: "Could not read the M-Pesa receipt PDF. Check the transaction number.",
        });
      }
      return ok(parsed);
    }

    // ZamZam: an unknown receipt id is HTTP 200 with the body `null`. The
    // record must carry the id it was looked up by (the gate treats the id as
    // an opaque key, so this is where it is matched).
    if (id === "zamzam") {
      const { parsed, notFound } = ZamZamParser.parseRecord(data, requestedReference);
      if (!parsed.verified) {
        return err({
          kind: "EXTRACTION_ERROR",
          bank: manifestEntry.name,
          message: notFound
            ? "ZamZam Bank has no receipt with this id. Check the number at the end of the receipt link."
            : "Could not read the ZamZam Bank receipt.",
        });
      }
      return ok(parsed);
    }

    if (id === "dashen") {
      const parsed = parser.parse(data, contentType);
      if (!parsed.verified) {
        const text = typeof data === "string" ? data : data.toString("utf8");
        return err({
          kind: "EXTRACTION_ERROR",
          bank: manifestEntry.name,
          message: /transaction not found/i.test(text.slice(0, 4096)) ? DASHEN_NOT_FOUND : "Could not read the Dashen receipt. Check the FT Ref.",
        });
      }
      return ok(parsed);
    }

    const parsed = parser.parse(data, contentType);
    if (!parsed.verified) {
      return err({ kind: "EXTRACTION_ERROR", bank: manifestEntry.name, message: "Receipt not found or invalid." });
    }
    return ok(parsed);
  }

  // ─── BOA QR ───────────────────────────────────────────────────────

  /**
   * A BOA QR is AES-encrypted with a key that is public, so anyone can make
   * one. The decrypted reference and receiver account are only used to look
   * the receipt up at BOA; the result shown is BOA's, not the QR's.
   */
  private async verifyBoaQr(qrData: string, startTime: number, depth: number): Promise<Result<Receipt, ChekiError>> {
    const manifestEntry = getBank("boa");
    const parser = getParser("boa") as BOAParser | undefined;
    if (!manifestEntry || !parser || manifestEntry.status !== "live") {
      return err({ kind: "BANK_NOT_SUPPORTED", bank: "boa" });
    }

    const decoded = parser.decryptQr(qrData);
    if (!decoded.reference) {
      return err({
        kind: "EXTRACTION_ERROR",
        bank: manifestEntry.name,
        message: "Could not decrypt the QR code. It may be malformed or not a BOA receipt.",
      });
    }

    // Both parts must be checkable before anything is fetched. A QR with an
    // invalid reference, or a receiving account that is missing or masked
    // ("1****42674"), can't be looked up at BOA, so it is an error, never a
    // decoded-only result.
    const digits = manifestEntry.accountDigits ?? 5;
    const refCheck = checkReference(decoded.reference);
    if (!refCheck.ok) {
      return err({
        kind: "EXTRACTION_ERROR",
        bank: manifestEntry.name,
        message: "The QR code does not contain a valid BOA reference, so it can't be checked with the bank.",
      });
    }
    const accountCheck = decoded.receiverAccount ? checkAccountSuffix(decoded.receiverAccount, digits) : null;
    if (!accountCheck || !accountCheck.ok) {
      return err({
        kind: "EXTRACTION_ERROR",
        bank: manifestEntry.name,
        message: "The QR code does not contain a full receiving account number, so it can't be checked with the bank.",
      });
    }

    const decodedOnly = (): Result<Receipt, ChekiError> =>
      ok({
        ...publicFields(decoded),
        verified: false,
        decodedOnly: true,
        bank: manifestEntry.name,
        bankCode: manifestEntry.id,
        reference: refCheck.value,
        sourceUrl: "qr://boa",
        durationMs: Date.now() - startTime,
      });

    const lookup = await this.resolve(
      { bank: "boa", reference: refCheck.value, accountNumber: decoded.receiverAccount },
      startTime,
      depth + 1
    );

    if (lookup.ok) {
      // The bank's amount wins. A QR that claims a different amount than the
      // bank's record is a forgery signal, so it fails.
      if (
        decoded.amount !== undefined &&
        lookup.value.amount !== undefined &&
        Math.abs(decoded.amount - lookup.value.amount) > 0.009
      ) {
        return err({
          kind: "EXTRACTION_ERROR",
          bank: manifestEntry.name,
          message: "The QR code does not match the bank's record for this receipt.",
        });
      }
      return lookup;
    }

    // A real lookup was attempted and BOA could not be reached: show what the
    // QR says, clearly unconfirmed. decodedOnly is only ever reached here.
    if (lookup.error.kind === "ENDPOINT_ERROR") return decodedOnly();

    // BOA answered and has no matching receipt (or it failed the gate).
    return lookup;
  }
}
