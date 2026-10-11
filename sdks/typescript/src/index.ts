/**
 * cheki - TypeScript SDK for the cheki receipt verification API.
 *
 * Verify Ethiopian bank transfer receipts from CBE, Telebirr, BOA, Dashen,
 * M-Pesa, and more. Zero runtime dependencies: uses the global Fetch API
 * (Node.js >= 18). The hosted API does not send CORS headers on the verify,
 * batch, banks and health routes, so call it from a server, not a browser.
 *
 * `verified === true` is the ONLY success signal. A 200 response can still
 * be unverified: a BOA QR code that could not be confirmed with the bank
 * comes back as `verified: false, decodedOnly: true`. Use {@link isVerified}.
 *
 * @example
 * ```ts
 * import { Cheki, isVerified } from "cheki-verify";
 *
 * const cheki = new Cheki();
 * const result = await cheki.verify("cbe", "https://mbreciept.cbe.com.et/fHCxExampleRcpt01");
 * if (isVerified(result)) console.log(result.amount, result.senderName);
 * ```
 *
 * @module cheki
 */

// ============================================================================
// Constants
// ============================================================================

/** SDK version, reflected in the default User-Agent header. */
const VERSION = "1.4.1";

/** Default API base URL. */
const DEFAULT_BASE_URL = "https://cheki.et";

/**
 * Default per-attempt timeout (65 s). The server gives a verification up to
 * 60 s (`maxDuration`), so a shorter client timeout would abandon requests
 * the server is still working on.
 */
export const DEFAULT_TIMEOUT_MS = 65_000;

/**
 * SDK retries on top of the first attempt. The server already makes up to 2
 * attempts per bank fetch, so the SDK retries at most once: one SDK call
 * reaches a bank at most 2 x 2 = 4 times.
 */
export const MAX_RETRIES = 1;

/** Maximum receipts per batch request, enforced client-side. */
export const MAX_BATCH_SIZE = 20;

/** A Retry-After longer than this is not waited out; the 429 is thrown. */
const MAX_RETRY_AFTER_MS = 60_000;

/** Base delay before a retry when the server sends no Retry-After. */
const RETRY_BASE_DELAY_MS = 1_000;

/** Banks `/api/receipt` can download, and the account digits each needs. */
/**
 * Banks `GET /api/receipt` serves. `legacyReference` and `accountDigits` mark
 * a legacy format that needs the receiving account: CBE's older FT reference.
 * The current CBE format (a Receipt ID from a mbreciept.cbe.com.et link)
 * needs no account.
 */
export const RECEIPT_DOWNLOAD_BANKS: Readonly<Record<string, { accountDigits?: number; legacyReference?: RegExp }>> = Object.freeze({
  cbe: { accountDigits: 8, legacyReference: /^FT[A-Za-z0-9]{8,12}$/i },
  zemen: {},
  dashen: {},
});

const SAFE_REFERENCE_RE = /^[A-Za-z0-9][A-Za-z0-9_.-]{0,63}$/;

// ============================================================================
// Types - Request
// ============================================================================

/** Optional fields for a single verification, the third argument to {@link Cheki.verify}. */
export interface VerifyOptions {
  /** Receiving account number. Needed by BOA, and by an older CBE receipt that shows only an FT reference (legacy format); a CBE Receipt ID or link needs none. */
  accountNumber?: string;
  /** Payer phone number (required by CBE Birr). */
  phoneNumber?: string;
  /** Raw QR code payload (BOA QR codes, or a receipt link from a QR). */
  qrData?: string;
}

/** A receipt to verify, as sent to {@link Cheki.verifyBatch}. */
export interface Receipt {
  /** Bank id (e.g. `"cbe"`, `"telebirr"`, `"boa"`). */
  bank: string;
  /** Transaction reference or receipt link. Optional when `qrData` is given. */
  reference?: string;
  accountNumber?: string;
  phoneNumber?: string;
  qrData?: string;
}

// ============================================================================
// Types - Response
// ============================================================================

/**
 * A successful (HTTP 200) verification response.
 *
 * `success: true` only means the request was processed. Check `verified`
 * (or {@link isVerified}): only `verified === true` means the bank confirmed
 * the receipt.
 */
export interface VerifyResult {
  success: true;
  /** True only when the bank itself confirmed the receipt. The only success signal. */
  verified: boolean;
  /**
   * BOA QR only: the QR was decrypted but BOA could not be reached, so the
   * data is what the QR claims. Always paired with `verified: false`. A QR
   * code can be forged; never treat this as proof of payment.
   */
  decodedOnly?: boolean;
  /** `/api/parse` only: parsed from caller-supplied text, never checked with the bank. */
  parsed?: boolean;
  /** `/api/parse` only: `"client-supplied"`. */
  source?: string;
  /** `/api/parse` only: a human label for the unverified result. */
  label?: string;
  /** True when served from the server's receipt cache (only verified receipts are cached). */
  cached?: boolean;
  /** Bank name (human-readable). */
  bank: string;
  /** Bank id (machine-readable, e.g. `"cbe"`). */
  bankCode: string;
  /** Transaction reference as returned by the bank. */
  reference: string;
  /** Where the receipt was fetched from (`"qr://boa"` for decoded-only QR results). */
  sourceUrl: string;
  senderName?: string;
  senderAccount?: string;
  receiverName?: string;
  receiverAccount?: string;
  amount?: number;
  currency?: string;
  date?: string;
  branch?: string;
  reason?: string;
  transactionType?: string;
  /** Server processing time. Absent on cache hits. */
  durationMs?: number;
  invoiceNumber?: string;
  transactionStatus?: string;
  settledAmount?: number;
  stampDuty?: number;
  discountAmount?: number;
  serviceFee?: number;
  serviceFeeVat?: number;
  totalPaid?: number;
  amountInWords?: string;
  paymentMode?: string;
  paymentChannel?: string;
  bankAccountNumber?: string;
  bankAccountName?: string;
}

/** A batch item that verified or decoded (the `index` is added by the SDK). */
export type BatchItemResult = VerifyResult & { index: number };

/** A batch item that failed. `status` is the HTTP status a single verify would have returned. */
export interface BatchItemError {
  success: false;
  error: string;
  status: number;
  /** Position in the input array (added by the SDK). */
  index: number;
}

export type BatchItem = BatchItemResult | BatchItemError;

/** Response from `POST /api/verify/batch`. */
export interface BatchResult {
  success: boolean;
  /** Per-receipt results in input order. */
  results: BatchItem[];
  /** Number of receipts in the batch. */
  total: number;
  /** Receipts with `verified: true`. */
  verified: number;
  /** Everything else: errors and decoded-only QR results. */
  failed: number;
  /** Receipts served from the server cache. */
  cached: number;
}

/** A supported bank or wallet from `GET /api/banks`. */
export interface BankInfo {
  /** Bank id, the value to pass as `bank` (e.g. `"cbe"`). */
  id: string;
  /** @deprecated Use `id`. Kept as an alias, filled in by the SDK. */
  code: string;
  name: string;
  swift?: string;
  type: "bank" | "mobile" | "wallet";
  status: "live" | "in-development";
  /** Live, but the parser has not yet been confirmed with a real receipt (M-Pesa as of 2.0). Absent when false. */
  beta?: boolean;
  requiresAccount: boolean;
  /** How many trailing account digits the bank needs, when it needs an account. */
  accountDigits?: number;
  /** Whether a payer phone number is required (defaults to false). */
  requiresPhone: boolean;
  /** Endpoint template of the bank's current format (informational). */
  endpoint: string;
  color: string;
  initials: string;
  /** Receipt formats, current first. Lead with the first `supported` one; the rest are older receipts. Empty when the server is older than this SDK. */
  formats: ReceiptFormatInfo[];
}

/** One receipt format of a bank, from `GET /api/banks`. */
export interface ReceiptFormatInfo {
  id: string;
  /** "current" formats come first; "legacy" still works; "deprecated" links are only read for their reference. */
  status: "current" | "legacy" | "deprecated" | (string & {});
  label: string;
  /** What the format needs: "reference", "receiptId", "link", "account", "phone". */
  inputs: string[];
  /** Trailing account digits, when the format needs an account. */
  accountDigits?: number;
  /** "pdf-in-json": a JSON envelope carrying the receipt as a base64 PDF (M-Pesa). */
  responseType: "pdf" | "html" | "json" | "pdf-in-json" | (string & {});
  /** False when cheki documents the format but cannot check it yet. */
  supported: boolean;
  /** "verified" (observed by cheki) or "inferred" (from another source). */
  confidence: "verified" | "inferred" | (string & {});
}

/** Response from `GET /api/banks`. */
export interface BankListResponse {
  banks: BankInfo[];
}

/** One bank's reachability in `GET /api/health`. */
export interface BankHealth {
  id: string;
  name: string;
  status: "reachable" | "unreachable" | "geo-blocked" | "no-parser" | "in-development" | (string & {});
  latencyMs: number;
}

/** Response from `GET /api/health` (cached up to 5 minutes server-side). */
export interface HealthStatus {
  status: "ok" | (string & {});
  /** When the probe ran (ISO 8601). */
  checkedAt: string;
  /** True when this response came from the server's 5-minute cache. */
  cached: boolean;
  banks: BankHealth[];
}

/** True only when the bank confirmed the receipt. `success`, `decodedOnly` and `parsed` are not proof. */
export function isVerified(result: unknown): result is VerifyResult & { verified: true } {
  return typeof result === "object" && result !== null && (result as { verified?: unknown }).verified === true;
}

// ============================================================================
// Error Hierarchy
// ============================================================================

/** Base class for every error the SDK throws. */
export class ChekiError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ChekiError";
    Object.setPrototypeOf(this, ChekiError.prototype);
  }
}

/** Invalid input caught before any request was made (e.g. more than 20 receipts). */
export class ChekiValidationError extends ChekiError {
  constructor(message: string) {
    super(message);
    this.name = "ChekiValidationError";
    Object.setPrototypeOf(this, ChekiValidationError.prototype);
  }
}

/**
 * The API answered with a non-2xx status. The server's own message is in
 * `serverMessage` (and in `message`); geo-blocked banks add `fallbackUrl`.
 *
 * Status codes: 400 bad input, 404 unsupported bank, 413 body too large,
 * 422 receipt not found / not a valid receipt, 429 rate limited, 502 bank
 * unreachable, 500 internal error.
 */
export class ChekiAPIError extends ChekiError {
  readonly statusCode: number;
  /** Parsed JSON body if possible, otherwise the raw text. */
  readonly body: unknown;
  /** API path that was called (e.g. `"/api/verify"`). */
  readonly endpoint: string;
  /** The server's `error` text, when it sent one. */
  readonly serverMessage?: string;
  /** For geo-blocked banks: open this link in a browser in Ethiopia instead. */
  readonly fallbackUrl?: string;

  constructor(message: string, statusCode: number, body: unknown, endpoint: string) {
    super(message);
    this.name = "ChekiAPIError";
    this.statusCode = statusCode;
    this.body = body;
    this.endpoint = endpoint;
    const obj = body && typeof body === "object" ? (body as Record<string, unknown>) : undefined;
    if (typeof obj?.error === "string") this.serverMessage = obj.error;
    if (typeof obj?.fallbackUrl === "string") this.fallbackUrl = obj.fallbackUrl;
    Object.setPrototypeOf(this, ChekiAPIError.prototype);
  }
}

/** HTTP 429. `retryAfterSeconds` is the server's Retry-After, when sent. */
export class ChekiRateLimitError extends ChekiAPIError {
  readonly retryAfterSeconds?: number;

  constructor(message: string, body: unknown, endpoint: string, retryAfterSeconds?: number) {
    super(message, 429, body, endpoint);
    this.name = "ChekiRateLimitError";
    this.retryAfterSeconds = retryAfterSeconds;
    Object.setPrototypeOf(this, ChekiRateLimitError.prototype);
  }
}

/** HTTP 413: the request body is over the route's cap (verify 16 KB, batch 64 KB). */
export class ChekiPayloadTooLargeError extends ChekiAPIError {
  constructor(message: string, body: unknown, endpoint: string) {
    super(message, 413, body, endpoint);
    this.name = "ChekiPayloadTooLargeError";
    Object.setPrototypeOf(this, ChekiPayloadTooLargeError.prototype);
  }
}

/** Network-level failure (DNS, connection refused, TLS) or a caller abort. */
export class ChekiNetworkError extends ChekiError {
  /** The original error, if available. */
  readonly cause?: Error;

  constructor(message: string, cause?: Error) {
    super(message);
    this.name = "ChekiNetworkError";
    this.cause = cause;
    Object.setPrototypeOf(this, ChekiNetworkError.prototype);
  }
}

/**
 * An attempt exceeded the timeout. Timeouts are not retried: the server may
 * still be working on the request (and talking to the bank).
 */
export class ChekiTimeoutError extends ChekiError {
  readonly timeoutMs: number;

  constructor(message: string, timeoutMs: number) {
    super(message);
    this.name = "ChekiTimeoutError";
    this.timeoutMs = timeoutMs;
    Object.setPrototypeOf(this, ChekiTimeoutError.prototype);
  }
}

// ============================================================================
// Client Configuration
// ============================================================================

export interface ChekiConfig {
  /** @default "https://cheki.et" */
  baseUrl?: string;
  /** Per-attempt timeout in ms. @default 65000 */
  timeoutMs?: number;
  /**
   * Retries for network errors, 5xx and 429 (honouring Retry-After). 4xx
   * other than 429 and timeouts are never retried. Capped at 1.
   * @default 1
   */
  maxRetries?: number;
  /** Optional API key sent as a Bearer token. The public API does not need one. */
  apiKey?: string;
  /** Extra headers for every request (can override the built-in ones). */
  defaultHeaders?: Record<string, string>;
  /** @default "cheki-sdk-typescript/<version>" */
  userAgent?: string;
}

export interface RequestOptions {
  /** Per-attempt timeout (ms) for this call. */
  timeoutMs?: number;
  /** Retries for this call (0 or 1; larger values are capped at 1). */
  retries?: number;
  /** Cancels the request and any pending retry wait. */
  signal?: AbortSignal;
}

interface ResolvedConfig {
  baseUrl: string;
  timeoutMs: number;
  maxRetries: number;
  apiKey?: string;
  defaultHeaders: Record<string, string>;
  userAgent: string;
}

const clampRetries = (n: number | undefined, fallback: number): number => {
  const v = n ?? fallback;
  if (!Number.isFinite(v) || v <= 0) return 0;
  return Math.min(Math.floor(v), MAX_RETRIES);
};

/** Parse a Retry-After header (delta-seconds or HTTP-date) into seconds. */
export function parseRetryAfter(value: string | null | undefined, now: number = Date.now()): number | undefined {
  if (!value) return undefined;
  const trimmed = value.trim();
  if (/^\d+$/.test(trimmed)) return Number(trimmed);
  const date = Date.parse(trimmed);
  if (Number.isNaN(date)) return undefined;
  return Math.max(0, Math.ceil((date - now) / 1000));
}

// ============================================================================
// Cheki Client
// ============================================================================

export class Cheki {
  private readonly config: ResolvedConfig;

  constructor(config?: string | ChekiConfig) {
    const cfg: ChekiConfig = typeof config === "string" ? { baseUrl: config } : config ?? {};
    this.config = {
      baseUrl: (cfg.baseUrl ?? DEFAULT_BASE_URL).replace(/\/+$/, ""),
      timeoutMs: cfg.timeoutMs ?? DEFAULT_TIMEOUT_MS,
      maxRetries: clampRetries(cfg.maxRetries, MAX_RETRIES),
      apiKey: cfg.apiKey,
      defaultHeaders: cfg.defaultHeaders ?? {},
      userAgent: cfg.userAgent ?? `cheki-sdk-typescript/${VERSION}`,
    };
  }

  /**
   * Verify one receipt.
   *
   * Resolves for HTTP 200, which includes unverified decoded-only BOA QR
   * results: check {@link isVerified}. Throws {@link ChekiAPIError} for
   * everything else (422 not found, 404 unsupported bank, ...).
   *
   * @param reference - Reference or receipt link. Pass `""` with `options.qrData` for QR-only.
   */
  async verify(
    bank: string,
    reference: string,
    options?: VerifyOptions,
    requestOptions?: RequestOptions,
  ): Promise<VerifyResult> {
    return this.request<VerifyResult>("POST", "/api/verify", cleanReceipt({ bank, reference, ...options }), requestOptions);
  }

  /**
   * Verify up to {@link MAX_BATCH_SIZE} receipts in one request. Each item
   * also counts against the per-IP verify limit (30/min).
   *
   * @throws {ChekiValidationError} For an empty batch or more than 20 receipts (no request is made).
   */
  async verifyBatch(receipts: Receipt[], requestOptions?: RequestOptions): Promise<BatchResult> {
    if (!Array.isArray(receipts) || receipts.length === 0) {
      throw new ChekiValidationError("verifyBatch needs at least one receipt.");
    }
    if (receipts.length > MAX_BATCH_SIZE) {
      throw new ChekiValidationError(
        `verifyBatch accepts at most ${MAX_BATCH_SIZE} receipts (got ${receipts.length}). Split the list into chunks of ${MAX_BATCH_SIZE}.`,
      );
    }
    const raw = await this.request<Omit<BatchResult, "results"> & { results: Omit<BatchItem, "index">[] }>(
      "POST",
      "/api/verify/batch",
      { receipts: receipts.map(cleanReceipt) },
      requestOptions,
    );
    const results = (raw.results ?? []).map((r, index) => ({ ...r, index }) as BatchItem);
    const verified = results.filter(isVerified).length;
    return {
      success: raw.success,
      results,
      total: raw.total ?? results.length,
      verified: raw.verified ?? verified,
      failed: raw.failed ?? results.length - verified,
      cached: raw.cached ?? 0,
    };
  }

  /** List supported banks and wallets. `id` is the value to pass as `bank`. */
  async getBanks(requestOptions?: RequestOptions): Promise<BankListResponse> {
    const raw = await this.request<{ banks?: Partial<BankInfo>[] }>("GET", "/api/banks", undefined, requestOptions);
    const banks = (raw.banks ?? []).map((b) => {
      const id = String(b.id ?? b.code ?? "");
      return { ...b, id, code: id, requiresPhone: b.requiresPhone === true, formats: Array.isArray(b.formats) ? b.formats : [] } as BankInfo;
    });
    return { banks };
  }

  /** Per-bank reachability. The server caches this for up to 5 minutes. */
  async getHealth(requestOptions?: RequestOptions): Promise<HealthStatus> {
    const raw = await this.request<Partial<HealthStatus>>("GET", "/api/health", undefined, requestOptions);
    return {
      status: raw.status ?? "unknown",
      checkedAt: raw.checkedAt ?? "",
      cached: raw.cached === true,
      banks: raw.banks ?? [],
    };
  }

  /**
   * URL of `GET /api/receipt`, which opens the bank's own copy of a receipt.
   * Supported: CBE, Dashen and Zemen. Lead with the current format: a CBE
   * Receipt ID (from the mbreciept.cbe.com.et link) or a Dashen FT Ref, which
   * the server answers with a redirect to the bank's own receipt page. An
   * older CBE FT reference (legacy) also needs the receiving account (at least
   * its last 8 digits) and comes back as the bank's PDF. Pure helper, no
   * request is made.
   *
   * @throws {ChekiValidationError} For an unsupported bank, a bad reference, or a legacy CBE FT reference without the account.
   */
  getReceiptUrl(bank: string, reference: string, accountNumber?: string): string {
    const id = String(bank ?? "").trim().toLowerCase();
    const spec = Object.prototype.hasOwnProperty.call(RECEIPT_DOWNLOAD_BANKS, id) ? RECEIPT_DOWNLOAD_BANKS[id] : undefined;
    if (!spec) {
      throw new ChekiValidationError(
        `Receipt download is only supported for: ${Object.keys(RECEIPT_DOWNLOAD_BANKS).join(", ")}.`,
      );
    }
    const ref = String(reference ?? "").trim();
    if (!SAFE_REFERENCE_RE.test(ref) || ref.includes("..")) {
      throw new ChekiValidationError("reference must be 1-64 letters, digits, dots, dashes or underscores.");
    }
    const params = new URLSearchParams({ bank: id, reference: ref });
    // Only the legacy format needs the account (CBE FT reference); a current Receipt ID never sends it.
    if (spec.accountDigits && (!spec.legacyReference || spec.legacyReference.test(ref))) {
      const digits = String(accountNumber ?? "").replace(/[\s-]/g, "");
      if (!/^\d+$/.test(digits) || digits.length < spec.accountDigits) {
        throw new ChekiValidationError(
          `An older ${id} FT reference needs the receiving account number (at least the last ${spec.accountDigits} digits). A Receipt ID from the receipt link needs none.`,
        );
      }
      params.set("account", digits);
    }
    return `${this.config.baseUrl}/api/receipt?${params.toString()}`;
  }

  // ───────────────────────────────────────────────────────────────────────
  // Internal helpers
  // ───────────────────────────────────────────────────────────────────────

  private buildHeaders(hasBody: boolean): Record<string, string> {
    const headers: Record<string, string> = {
      Accept: "application/json",
      "User-Agent": this.config.userAgent,
    };
    // Only send Content-Type with a body, so GETs stay "simple" requests.
    if (hasBody) headers["Content-Type"] = "application/json";
    if (this.config.apiKey) headers["Authorization"] = `Bearer ${this.config.apiKey}`;
    return { ...headers, ...this.config.defaultHeaders };
  }

  private sleep(ms: number, signal?: AbortSignal): Promise<void> {
    return new Promise<void>((resolve, reject) => {
      if (signal?.aborted) {
        reject(new ChekiNetworkError("Request aborted by caller signal"));
        return;
      }
      const onAbort = (): void => {
        clearTimeout(timer);
        reject(new ChekiNetworkError("Request aborted by caller signal"));
      };
      const timer = setTimeout(() => {
        signal?.removeEventListener("abort", onAbort);
        resolve();
      }, ms);
      signal?.addEventListener("abort", onAbort, { once: true });
    });
  }

  /** Delay before the retry: Retry-After when sent, otherwise 1-2 s. */
  private retryDelayMs(retryAfterSeconds?: number): number {
    if (retryAfterSeconds !== undefined) return retryAfterSeconds * 1000;
    return RETRY_BASE_DELAY_MS + Math.random() * RETRY_BASE_DELAY_MS;
  }

  /**
   * One request with at most one retry.
   *
   * Retried: network errors, 5xx, and 429 when Retry-After is at most 60 s.
   * Never retried: other 4xx, timeouts, caller aborts.
   */
  private async request<T>(method: string, path: string, body: unknown, options: RequestOptions | undefined): Promise<T> {
    const maxRetries = clampRetries(options?.retries, this.config.maxRetries);
    const timeoutMs = options?.timeoutMs ?? this.config.timeoutMs;
    const externalSignal = options?.signal;
    const url = `${this.config.baseUrl}${path}`;
    const headers = this.buildHeaders(body !== undefined);

    for (let attempt = 0; ; attempt++) {
      const canRetry = attempt < maxRetries;
      if (externalSignal?.aborted) throw new ChekiNetworkError("Request aborted by caller signal");

      const controller = new AbortController();
      let timedOut = false;
      const timer = setTimeout(() => {
        timedOut = true;
        controller.abort();
      }, timeoutMs);
      const onExternalAbort = (): void => controller.abort();
      externalSignal?.addEventListener("abort", onExternalAbort, { once: true });
      const cleanup = (): void => {
        clearTimeout(timer);
        externalSignal?.removeEventListener("abort", onExternalAbort);
      };

      let response: Response;
      let text: string;
      try {
        response = await fetch(url, {
          method,
          headers,
          signal: controller.signal,
          ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
        });
        text = await response.text();
      } catch (err) {
        cleanup();
        if (timedOut) {
          throw new ChekiTimeoutError(`Request to ${path} timed out after ${timeoutMs}ms`, timeoutMs);
        }
        if (externalSignal?.aborted) {
          throw new ChekiNetworkError(`Request to ${path} aborted by caller signal`, err instanceof Error ? err : undefined);
        }
        const networkError = new ChekiNetworkError(
          `Network request to ${path} failed: ${err instanceof Error ? err.message : String(err)}`,
          err instanceof Error ? err : undefined,
        );
        if (canRetry) {
          await this.sleep(this.retryDelayMs(), externalSignal);
          continue;
        }
        throw networkError;
      }
      cleanup();

      let parsed: unknown = text;
      try {
        parsed = text ? JSON.parse(text) : undefined;
      } catch {
        // Keep the raw text.
      }

      if (response.ok) {
        if (parsed === undefined || typeof parsed !== "object") {
          throw new ChekiAPIError(`cheki API returned a non-JSON body for ${method} ${path}`, response.status, parsed, path);
        }
        return parsed as T;
      }

      const status = response.status;
      const serverMessage =
        parsed && typeof parsed === "object" && typeof (parsed as { error?: unknown }).error === "string"
          ? (parsed as { error: string }).error
          : undefined;
      const message = `cheki API returned ${status} for ${method} ${path}${serverMessage ? `: ${serverMessage}` : ""}`;

      if (status === 429) {
        const retryAfter = parseRetryAfter(response.headers.get("retry-after"));
        if (canRetry && (retryAfter === undefined || retryAfter * 1000 <= MAX_RETRY_AFTER_MS)) {
          await this.sleep(this.retryDelayMs(retryAfter), externalSignal);
          continue;
        }
        throw new ChekiRateLimitError(message, parsed, path, retryAfter);
      }
      if (status === 413) throw new ChekiPayloadTooLargeError(message, parsed, path);
      if (status >= 500 && canRetry) {
        const retryAfter = parseRetryAfter(response.headers.get("retry-after"));
        if (retryAfter === undefined || retryAfter * 1000 <= MAX_RETRY_AFTER_MS) {
          await this.sleep(this.retryDelayMs(retryAfter), externalSignal);
          continue;
        }
      }
      throw new ChekiAPIError(message, status, parsed, path);
    }
  }
}

/** Drop empty optional fields so the server sees exactly what was given. */
function cleanReceipt(r: Receipt): Receipt {
  const out: Receipt = { bank: r.bank };
  if (r.reference) out.reference = r.reference;
  if (r.accountNumber) out.accountNumber = r.accountNumber;
  if (r.phoneNumber) out.phoneNumber = r.phoneNumber;
  if (r.qrData) out.qrData = r.qrData;
  return out;
}

export default Cheki;
