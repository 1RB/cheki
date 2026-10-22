/**
 * Base parser - shared HTTP client with retries, timeout, geo-block handling.
 *
 * Each bank parser extends this class and implements:
 *   - buildUrl(ref, account?, phone?) → receipt URL
 *   - parse(data, contentType) → ParsedReceipt
 *
 * The base class handles:
 *   - HTTP fetching through safeFetch: host allowlist on every hop, manual
 *     redirects, a total deadline and a response size cap
 *   - Retries for network errors and 5xx only (at most 2 attempts in total);
 *     a 4xx, including 404, is a definite answer and is never retried
 *   - Geo-blocked banks (Telebirr, M-Pesa): one plain attempt with a short
 *     timeout. They only answer Ethiopian IPs, and no header trick changes
 *     that, so we fail fast and hand the user the receipt link instead.
 */
import type { ParsedReceipt, HttpResult, Result, ChekiError } from "../core/types";
import { ok, err } from "../core/types";
import { checkReference, type Checked } from "../security/reference";
import { canonicalReference } from "../reference-case";
import { assertAllowedUrl } from "../security/hosts";
import {
  safeFetch,
  describeFetchError,
  MAX_PDF_BYTES,
  MAX_TEXT_BYTES,
  ResponseTooLargeError,
  type SafeResponse,
} from "../http/safe-fetch";

/** Total attempts per receipt fetch (first try plus one retry). */
export const MAX_ATTEMPTS = 2;
/** @deprecated kept for callers that read it; equals MAX_ATTEMPTS - 1. */
export const MAX_RETRIES = MAX_ATTEMPTS - 1;
export const RETRY_BACKOFF_MS = 500;
export const DEFAULT_TIMEOUT_MS = 15000;
export const SLOW_BANK_TIMEOUT_MS = 30000; // CBE legacy PDF endpoint is slow
export const GEO_TIMEOUT_MS = 8000;

export const BROWSER_UA = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36";

/** A fetch outcome plus whether trying again could help. */
type Attempt = { result: Result<HttpResult>; retryable: boolean };

export abstract class BaseParser {
  abstract readonly bankId: string;
  abstract readonly bankName: string;
  abstract readonly responseType: "pdf" | "html" | "json";
  abstract readonly requiresAccount: boolean;
  abstract readonly accountDigits?: number;
  abstract readonly requiresPhone: boolean;
  readonly sslVerify: boolean = true;
  readonly geoBlocked: boolean = false;
  /**
   * Read the body as bytes even when responseType is not "pdf" (a bank that
   * may answer with a PDF or with HTML, like CBE Birr). Such a bank gets the
   * PDF size cap.
   */
  readonly binaryResponse: boolean = false;
  /**
   * HTTP statuses that mean "this bank has no receipt for that reference".
   * They become a not-found EXTRACTION_ERROR and are never retried. Most banks
   * use 404; a bank that answers an unknown reference differently (Dashen: 400)
   * overrides this.
   */
  protected readonly notFoundStatuses: readonly number[] = [404];
  /** Message for a not-found status; a generic one is used when unset. */
  protected readonly notFoundMessage?: string;

  abstract buildUrl(ref: string, account?: string, phone?: string): string;
  abstract parse(data: string | Buffer, contentType: string): ParsedReceipt;
  // Note: parse is sync for simple HTML/JSON parsers. PDF banks use a static async extractPdfText.

  /**
   * Validate and canonicalise a reference before it goes into a URL: capitals
   * for banks whose references are uppercase-only (src/lib/reference-case.ts),
   * then the strict charset check. Separators are not dropped here: the
   * verifier compacts typed input before this, and a reference read out of a
   * bank link keeps whatever the link had. Override for banks whose reference
   * is not a plain receipt number.
   */
  normalizeReference(ref: string): Checked<string> {
    return checkReference(canonicalReference(this.bankId, ref, { compact: false }));
  }

  protected get maxBytes(): number {
    return this.responseType === "pdf" || this.binaryResponse ? MAX_PDF_BYTES : MAX_TEXT_BYTES;
  }

  /**
   * Extra request headers a bank's endpoint expects (M-Pesa: Accept and
   * Referer). Merged into every fetch path, after the defaults.
   */
  protected requestHeaders(): Record<string, string> {
    return {};
  }

  /**
   * The bank-specific headers every fetch sends (requestHeaders), for the
   * daily health probe so it asks the endpoint the same way the parser does.
   * Server-side only: never put these in a response.
   */
  probeHeaders(): Record<string, string> {
    return { ...this.requestHeaders() };
  }

  protected get timeoutMs(): number {
    return this.bankId === "cbe" ? SLOW_BANK_TIMEOUT_MS : DEFAULT_TIMEOUT_MS;
  }

  /**
   * Fetch receipt data from the bank endpoint with retries and geo-block handling.
   */
  async fetchReceipt(
    ref: string,
    account?: string,
    phone?: string,
    options?: { fallbackUrl?: string }
  ): Promise<Result<HttpResult>> {
    let url: string;
    try {
      url = this.buildUrl(ref, account, phone);
      assertAllowedUrl(url);
    } catch (e) {
      return err({ kind: "ENDPOINT_ERROR" as const, bank: this.bankName, message: describeFetchError(e) });
    }

    let last: Attempt | undefined;
    for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
      last = this.geoBlocked ? await this.fetchGeoBlocked(url) : await this.doFetch(url);
      // A geo-block does not lift on a retry: one attempt, then the fallback link.
      if (last.result.ok || !last.retryable || this.geoBlocked) break;
      if (attempt < MAX_ATTEMPTS) await sleep(RETRY_BACKOFF_MS);
    }
    const result = last!.result;

    if (!result.ok && this.geoBlocked && options?.fallbackUrl && result.error.kind === "ENDPOINT_ERROR") {
      return err({
        kind: "ENDPOINT_ERROR" as const,
        bank: this.bankName,
        message: "Our server can't reach this bank (it blocks cloud IPs). Open the receipt directly:",
        fallbackUrl: options.fallbackUrl,
      });
    }
    return result;
  }

  /** Map an HTTP response to a Result, with the retry decision. */
  protected toAttempt(resp: { status: number; body: Buffer; contentType: string }, notFoundMessage?: string): Attempt {
    if (this.notFoundStatuses.includes(resp.status)) {
      return {
        result: err({
          kind: "EXTRACTION_ERROR" as const,
          bank: this.bankName,
          message: notFoundMessage ?? this.notFoundMessage ?? "Receipt not found. Check the reference number.",
        }),
        retryable: false,
      };
    }
    if (resp.status >= 500) {
      return {
        result: err({
          kind: "ENDPOINT_ERROR" as const,
          bank: this.bankName,
          message: `${this.bankName} server is currently unavailable (HTTP ${resp.status}).`,
        }),
        retryable: true,
      };
    }
    if (resp.status < 200 || resp.status >= 300) {
      return {
        result: err({
          kind: "ENDPOINT_ERROR" as const,
          bank: this.bankName,
          message: `${this.bankName} refused the request (HTTP ${resp.status}).`,
        }),
        retryable: false,
      };
    }
    const data = this.responseType === "pdf" || this.binaryResponse ? resp.body : resp.body.toString("utf8");
    return { result: ok({ status: resp.status, data, contentType: resp.contentType }), retryable: false };
  }

  protected networkFailure(e: unknown, fallbackUrl?: string): Attempt {
    const error: ChekiError = {
      kind: "ENDPOINT_ERROR",
      bank: this.bankName,
      message: describeFetchError(e),
      ...(fallbackUrl ? { fallbackUrl } : {}),
    };
    // An oversized body or a blocked host will not change on a retry.
    const retryable = !(e instanceof ResponseTooLargeError) && !(e instanceof Error && e.name === "HostNotAllowedError");
    return { result: err(error), retryable };
  }

  protected async doFetch(
    url: string,
    headers: Record<string, string> = { "User-Agent": BROWSER_UA, ...this.requestHeaders() }
  ): Promise<Attempt> {
    try {
      const resp = await safeFetch(url, { headers, timeoutMs: this.timeoutMs, maxBytes: this.maxBytes });
      return this.toAttempt(resp);
    } catch (e) {
      return this.networkFailure(e);
    }
  }

  /**
   * Geo-blocked fetch: one plain request with a short timeout. No spoofed
   * X-Forwarded-For and no pinned bank IPs: the banks block by the real TCP
   * source address, so those never got past the block, only slowed the
   * failure down (Telebirr took about 33 seconds to give up).
   */
  private async fetchGeoBlocked(url: string): Promise<Attempt> {
    try {
      const resp: SafeResponse = await safeFetch(url, {
        headers: { "User-Agent": BROWSER_UA, ...this.requestHeaders() },
        timeoutMs: GEO_TIMEOUT_MS,
        maxBytes: this.maxBytes,
      });
      return this.toAttempt(resp);
    } catch (e) {
      return this.networkFailure(e, url);
    }
  }
}

function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}
