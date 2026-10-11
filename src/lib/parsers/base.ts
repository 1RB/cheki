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
 *   - Geo-block workaround (X-Forwarded-For, direct IP with full TLS checks)
 */
import type { ParsedReceipt, HttpResult, Result, ChekiError } from "../core/types";
import { ok, err } from "../core/types";
import { checkReference, type Checked } from "../security/reference";
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
export const ETHIOPIAN_IP = "197.156.96.83";

// Direct IPs for geo-blocked services
const GEO_DIRECT_IPS: Record<string, { ip: string; host: string }> = {
  telebirr: { ip: "196.188.116.120", host: "transactioninfo.ethiotelecom.et" },
  mpesa: { ip: "102.218.49.92", host: "m-pesabusiness.safaricom.et" },
};

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
   * Validate and canonicalise a reference before it goes into a URL.
   * Override for banks whose reference is not a plain receipt number.
   */
  normalizeReference(ref: string): Checked<string> {
    return checkReference(ref);
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
      if (last.result.ok || !last.retryable) break;
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
   * Geo-blocked fetch: tries the direct IP with X-Forwarded-For, then falls
   * back to a standard fetch with the same headers.
   */
  private async fetchGeoBlocked(url: string): Promise<Attempt> {
    const geoHeaders = {
      "User-Agent": BROWSER_UA,
      "X-Forwarded-For": ETHIOPIAN_IP,
      "X-Real-IP": ETHIOPIAN_IP,
      ...this.requestHeaders(),
    };
    const geoInfo = GEO_DIRECT_IPS[this.bankId];

    if (geoInfo) {
      // Try 1: direct IP with node:https. TLS is fully verified: `servername`
      // makes Node check the certificate against the real host name.
      try {
        const parsedUrl = new URL(url);
        if (parsedUrl.hostname.toLowerCase() === geoInfo.host && parsedUrl.protocol === "https:") {
          const resp = await directHttpsGet({
            ip: geoInfo.ip,
            host: geoInfo.host,
            path: parsedUrl.pathname + parsedUrl.search,
            headers: {
              Accept: "text/html,application/json,*/*",
              ...geoHeaders,
            },
            timeoutMs: GEO_TIMEOUT_MS,
            maxBytes: this.maxBytes,
          });
          if (resp.status >= 200 && resp.status < 300 && resp.body.length >= 10) {
            const contentType = this.responseType === "json" ? "application/json" : "text/html";
            return this.toAttempt({ ...resp, contentType });
          }
          if (this.notFoundStatuses.includes(resp.status)) return this.toAttempt({ ...resp, contentType: "" });
          // Any other status: fall through to the standard fetch.
        }
      } catch {
        // Fall through to the standard fetch.
      }
    }

    // Try 2: standard fetch with X-Forwarded-For
    try {
      const resp: SafeResponse = await safeFetch(url, { headers: geoHeaders, timeoutMs: GEO_TIMEOUT_MS, maxBytes: this.maxBytes });
      return this.toAttempt(resp);
    } catch (e) {
      return this.networkFailure(e, url);
    }
  }
}

function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}

/**
 * GET over HTTPS to a fixed IP with SNI and Host set to the real host name.
 * Certificate verification stays on. One total deadline covers connect and
 * body; the body is capped; response stream errors reject instead of hanging.
 */
export async function directHttpsGet(opts: {
  ip: string;
  host: string;
  path: string;
  headers: Record<string, string>;
  timeoutMs: number;
  maxBytes: number;
}): Promise<{ status: number; body: Buffer }> {
  const https = await import("node:https");
  return new Promise((resolve, reject) => {
    let settled = false;
    const finish = (fn: () => void) => {
      if (settled) return;
      settled = true;
      clearTimeout(deadline);
      fn();
    };
    const req = https.request(
      {
        hostname: opts.ip,
        port: 443,
        path: opts.path,
        method: "GET",
        headers: { ...opts.headers, Host: opts.host },
        servername: opts.host,
      },
      (res) => {
        const chunks: Buffer[] = [];
        let total = 0;
        res.on("data", (c: Buffer) => {
          total += c.length;
          if (total > opts.maxBytes) {
            req.destroy();
            finish(() => reject(new ResponseTooLargeError()));
            return;
          }
          chunks.push(c);
        });
        res.on("end", () => finish(() => resolve({ status: res.statusCode ?? 0, body: Buffer.concat(chunks) })));
        res.on("error", (e) => finish(() => reject(e)));
        res.on("aborted", () => finish(() => reject(new Error("aborted"))));
      }
    );
    const deadline = setTimeout(() => {
      req.destroy();
      finish(() => reject(new Error("timeout")));
    }, opts.timeoutMs);
    req.on("error", (e) => finish(() => reject(e)));
    req.end();
  });
}
