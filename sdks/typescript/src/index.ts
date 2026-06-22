/**
 * cheki - TypeScript SDK for the cheki receipt verification API.
 *
 * Verify Ethiopian bank transfer receipts from CBE, Telebirr, BOA, Dashen,
 * M-Pesa, and more. Zero runtime dependencies - uses the global Fetch API
 * (Node.js >= 18 or any modern browser).
 *
 * @example
 * ```ts
 * import { Cheki } from "cheki-verify";
 *
 * const cheki = new Cheki();
 * const result = await cheki.verify("cbe", "FT26140P01YB", {
 *   accountNumber: "1000560536171",
 * });
 * console.log(result.verified, result.amount, result.senderName);
 * ```
 *
 * @module cheki
 */

// ============================================================================
// Constants
// ============================================================================

/** SDK version - reflected in the default User-Agent header. */
const VERSION = "1.0.0";

/** Default API base URL. */
const DEFAULT_BASE_URL = "https://chekiapp.vercel.app";

/** Default request timeout in milliseconds (30 seconds). */
const DEFAULT_TIMEOUT_MS = 30_000;

/** Default maximum number of retry attempts. */
const DEFAULT_MAX_RETRIES = 3;

/** Default User-Agent header value. */
const DEFAULT_USER_AGENT = `cheki-sdk-typescript/${VERSION}`;

/** Initial exponential backoff delay in milliseconds. */
const INITIAL_BACKOFF_MS = 500;

/** Maximum (capped) exponential backoff delay in milliseconds. */
const MAX_BACKOFF_MS = 5_000;

/** HTTP status codes that are eligible for automatic retry. */
const RETRYABLE_STATUS_CODES = new Set([429, 500, 502, 503, 504]);

// ============================================================================
// Types - Request
// ============================================================================

/**
 * Optional fields for a single receipt verification request.
 *
 * Passed as the third argument to {@link Cheki.verify}.
 */
export interface VerifyOptions {
  /** Bank account number (required by some banks, e.g. CBE). */
  accountNumber?: string;
  /** Phone number (required by some wallets, e.g. Telebirr). */
  phoneNumber?: string;
  /** Raw QR code data string, if available. */
  qrData?: string;
}

/**
 * A receipt to verify - used as input to batch verification.
 *
 * Passed as elements of the array to {@link Cheki.verifyBatch}.
 */
export interface Receipt {
  /** Bank code (e.g. `"cbe"`, `"telebirr"`, `"boa"`). */
  bank: string;
  /** Transaction reference number. */
  reference: string;
  /** Bank account number (required by some banks). */
  accountNumber?: string;
  /** Phone number (required by some wallets). */
  phoneNumber?: string;
  /** Raw QR code data string, if available. */
  qrData?: string;
}

// ============================================================================
// Types - Response
// ============================================================================

/**
 * Full result of a single receipt verification.
 *
 * Returned by {@link Cheki.verify} and included (with an `index` field) in
 * {@link BatchResult.results}.
 */
export interface VerifyResult {
  /** Whether the request was processed successfully. */
  success: boolean;
  /** Whether the receipt was verified as legitimate. */
  verified: boolean;
  /** Bank name (human-readable). */
  bank: string;
  /** Bank code (machine-readable, e.g. `"cbe"`). */
  bankCode: string;
  /** Transaction reference number. */
  reference: string;
  /** Source URL from which the receipt was fetched or verified. */
  sourceUrl: string;

  // --- Optional transaction details (present when the bank provides them) ---

  /** Sender's name, if available. */
  senderName?: string;
  /** Sender's account number, if available. */
  senderAccount?: string;
  /** Receiver's name, if available. */
  receiverName?: string;
  /** Receiver's account number, if available. */
  receiverAccount?: string;
  /** Transaction amount, if available. */
  amount?: number;
  /** Currency code (e.g. `"ETB"`), if available. */
  currency?: string;
  /** Transaction date (ISO 8601 string), if available. */
  date?: string;
  /** Bank branch, if available. */
  branch?: string;
  /** Reason for verification failure, if applicable. */
  reason?: string;
  /** Server-side processing duration in milliseconds. */
  durationMs?: number;
  /** Invoice number, if available. */
  invoiceNumber?: string;
  /** Transaction status (e.g. `"completed"`, `"pending"`). */
  transactionStatus?: string;
  /** Settled amount, if different from `amount`. */
  settledAmount?: number;
  /** Stamp duty charged, if applicable. */
  stampDuty?: number;
  /** Discount amount, if applicable. */
  discountAmount?: number;
  /** Service fee charged, if applicable. */
  serviceFee?: number;
  /** VAT on the service fee, if applicable. */
  serviceFeeVat?: number;
  /** Total amount paid, if applicable. */
  totalPaid?: number;
  /** Amount in words, if available. */
  amountInWords?: string;
  /** Payment mode (e.g. `"account-transfer"`). */
  paymentMode?: string;
  /** Payment channel, if available. */
  paymentChannel?: string;
  /** Bank account number on file, if available. */
  bankAccountNumber?: string;
  /** Bank account name on file, if available. */
  bankAccountName?: string;

  /** Error message, if the verification failed. */
  error?: string;
}

/**
 * Information about a supported bank or wallet.
 *
 * Returned by {@link Cheki.getBanks}.
 */
export interface BankInfo {
  /** Bank code (e.g. `"cbe"`). */
  code: string;
  /** Human-readable bank name. */
  name: string;
  /** Current integration status. */
  status: "live" | "in-development";
  /** Institution type. */
  type: "bank" | "wallet";
  /** Whether an account number is required for verification. */
  requiresAccount: boolean;
  /** Expected number of digits in the account number, if known. */
  accountDigits?: number;
  /** Whether a phone number is required for verification. */
  requiresPhone: boolean;
  /** Response type expected from the bank's API. */
  responseType: string;
  /** Bank API endpoint URL. */
  endpoint: string;
  /** Whether SSL certificate verification is enabled for this bank. */
  sslVerify: boolean;
  /** Additional notes about the bank integration. */
  notes?: string;
  /** Brand color (hex or CSS color string). */
  color: string;
  /** Short bank initials / abbreviation. */
  initials: string;
}

/**
 * Response from `GET /api/banks`.
 *
 * Returned by {@link Cheki.getBanks}.
 */
export interface BankListResponse {
  /** Whether the request was successful. */
  success: boolean;
  /** Number of banks in the response. */
  count: number;
  /** Array of supported banks. */
  banks: BankInfo[];
}

/**
 * A single component health check within the overall health status.
 */
export interface HealthCheck {
  /** Name of the check (e.g. `"database"`, `"redis"`). */
  name: string;
  /** Status of this individual check. */
  status: string;
  /** Latency of this check in milliseconds, if measured. */
  latencyMs?: number;
}

/**
 * Response from `GET /api/health`.
 *
 * Returned by {@link Cheki.getHealth}.
 */
export interface HealthStatus {
  /** Whether the health check was successful. */
  success: boolean;
  /** Overall service status. */
  status: "ok" | "degraded" | "down";
  /** API version string. */
  version: string;
  /** Timestamp of the health check (ISO 8601 string). */
  timestamp: string;
  /** Individual component checks. */
  checks: HealthCheck[];
}

/**
 * Response from `POST /api/verify/batch`.
 *
 * Returned by {@link Cheki.verifyBatch}.
 */
export interface BatchResult {
  /** Whether the batch request was processed successfully. */
  success: boolean;
  /** Total number of receipts in the batch. */
  total: number;
  /** Number of receipts that were verified. */
  verified: number;
  /** Number of receipts that failed verification. */
  failed: number;
  /** Per-receipt results, each annotated with its index in the input array. */
  results: (VerifyResult & { index: number })[];
}

// ============================================================================
// Error Hierarchy
// ============================================================================

/**
 * Base error class for all cheki SDK errors.
 *
 * Every error thrown by the SDK extends this class, so callers can
 * distinguish SDK errors from other runtime errors with a single
 * `instanceof ChekiError` check.
 *
 * @example
 * ```ts
 * try {
 *   await cheki.verify("cbe", "FT26140P01YB");
 * } catch (err) {
 *   if (err instanceof ChekiError) {
 *     console.error("cheki error:", err.message);
 *   }
 * }
 * ```
 */
export class ChekiError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ChekiError";
    Object.setPrototypeOf(this, ChekiError.prototype);
  }
}

/**
 * Error thrown when the cheki API returns a non-2xx HTTP status code.
 *
 * Includes the HTTP status code, the parsed (or raw) response body,
 * and the API endpoint path that was called.
 */
export class ChekiAPIError extends ChekiError {
  /** HTTP status code returned by the API. */
  readonly statusCode: number;
  /** Response body - parsed JSON if possible, otherwise the raw text. */
  readonly body: unknown;
  /** API endpoint path that was called (e.g. `"/api/verify"`). */
  readonly endpoint: string;

  constructor(
    message: string,
    statusCode: number,
    body: unknown,
    endpoint: string,
  ) {
    super(message);
    this.name = "ChekiAPIError";
    this.statusCode = statusCode;
    this.body = body;
    this.endpoint = endpoint;
    Object.setPrototypeOf(this, ChekiAPIError.prototype);
  }
}

/**
 * Error thrown when a network-level failure occurs (e.g. DNS resolution
 * failure, connection refused, TLS handshake error, or caller-initiated
 * abort). The original underlying error is preserved in {@link cause}.
 */
export class ChekiNetworkError extends ChekiError {
  /** The original underlying error, if available. */
  readonly cause?: Error;

  constructor(message: string, cause?: Error) {
    super(message);
    this.name = "ChekiNetworkError";
    this.cause = cause;
    Object.setPrototypeOf(this, ChekiNetworkError.prototype);
  }
}

/**
 * Error thrown when a request exceeds the configured timeout and is
 * aborted. The timeout duration (in milliseconds) is included for
 * diagnostics.
 */
export class ChekiTimeoutError extends ChekiError {
  /** The timeout duration in milliseconds that was exceeded. */
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

/**
 * Configuration options for the {@link Cheki} client.
 *
 * Pass this object (or a base URL string) to the `Cheki` constructor.
 */
export interface ChekiConfig {
  /**
   * Base URL of the cheki API.
   * @default "https://chekiapp.vercel.app"
   */
  baseUrl?: string;
  /**
   * Default request timeout in milliseconds.
   * @default 30000
   */
  timeoutMs?: number;
  /**
   * Default maximum number of retry attempts for transient failures.
   * @default 3
   */
  maxRetries?: number;
  /**
   * Optional API key sent as a `Bearer` token in the `Authorization`
   * header on every request.
   */
  apiKey?: string;
  /**
   * Default headers to send with every request. These are merged with
   * (and can override) the SDK's built-in headers such as
   * `Content-Type` and `User-Agent`.
   */
  defaultHeaders?: Record<string, string>;
  /**
   * `User-Agent` header value.
   * @default "cheki-sdk-typescript/1.0.0"
   */
  userAgent?: string;
}

/**
 * Per-call request options that override the client's defaults.
 *
 * Every SDK method that performs a network request accepts this as an
 * optional last argument.
 */
export interface RequestOptions {
  /** Override the client's default timeout (ms) for this single call. */
  timeoutMs?: number;
  /** Override the client's default max retries for this single call. */
  retries?: number;
  /**
   * External `AbortSignal` to cancel the request. If the signal is
   * already aborted, the request fails immediately with a
   * {@link ChekiNetworkError}.
   */
  signal?: AbortSignal;
}

/** Internal resolved configuration - all defaults applied. */
interface ResolvedConfig {
  baseUrl: string;
  timeoutMs: number;
  maxRetries: number;
  apiKey?: string;
  defaultHeaders: Record<string, string>;
  userAgent: string;
}

// ============================================================================
// Cheki Client
// ============================================================================

/**
 * Client for the cheki receipt verification API.
 *
 * @example Basic usage
 * ```ts
 * const cheki = new Cheki();
 * const result = await cheki.verify("cbe", "FT26140P01YB", {
 *   accountNumber: "1000560536171",
 * });
 * ```
 *
 * @example With configuration
 * ```ts
 * const cheki = new Cheki({
 *   baseUrl: "https://chekiapp.vercel.app",
 *   timeoutMs: 10_000,
 *   maxRetries: 5,
 *   apiKey: "sk_live_...",
 * });
 * ```
 */
export class Cheki {
  private readonly config: ResolvedConfig;

  /**
   * Create a new Cheki client.
   *
   * @param config - Base URL string, full configuration object, or
   *   `undefined` to use all defaults (public cheki API).
   */
  constructor(config?: string | ChekiConfig) {
    const cfg: ChekiConfig =
      typeof config === "string" ? { baseUrl: config } : config ?? {};

    this.config = {
      baseUrl: (cfg.baseUrl ?? DEFAULT_BASE_URL).replace(/\/+$/, ""),
      timeoutMs: cfg.timeoutMs ?? DEFAULT_TIMEOUT_MS,
      maxRetries: cfg.maxRetries ?? DEFAULT_MAX_RETRIES,
      apiKey: cfg.apiKey,
      defaultHeaders: cfg.defaultHeaders ?? {},
      userAgent: cfg.userAgent ?? DEFAULT_USER_AGENT,
    };
  }

  // ───────────────────────────────────────────────────────────────────────
  // Public API
  // ───────────────────────────────────────────────────────────────────────

  /**
   * Verify a single bank transfer receipt.
   *
   * @param bank - Bank code (e.g. `"cbe"`, `"telebirr"`, `"boa"`).
   * @param reference - Transaction reference number.
   * @param options - Optional verification fields (`accountNumber`,
   *   `phoneNumber`, `qrData`).
   * @param requestOptions - Per-call overrides for timeout, retries,
   *   and abort signal.
   * @returns Verification result with full transaction details.
   * @throws {ChekiAPIError} On non-2xx API responses (after retries).
   * @throws {ChekiNetworkError} On network failures (after retries).
   * @throws {ChekiTimeoutError} On request timeout.
   *
   * @example
   * ```ts
   * const result = await cheki.verify("cbe", "FT26140P01YB", {
   *   accountNumber: "1000560536171",
   * });
   * if (result.verified) {
   *   console.log(`Verified: ${result.amount} ${result.currency}`);
   * }
   * ```
   */
  async verify(
    bank: string,
    reference: string,
    options?: VerifyOptions,
    requestOptions?: RequestOptions,
  ): Promise<VerifyResult> {
    const body: Receipt = { bank, reference, ...options };
    return this.request<VerifyResult>(
      "POST",
      "/api/verify",
      body,
      requestOptions,
    );
  }

  /**
   * Verify multiple receipts in a single batch request.
   *
   * @param receipts - Array of receipts to verify.
   * @param requestOptions - Per-call overrides for timeout, retries,
   *   and abort signal.
   * @returns Batch result with per-receipt verification details.
   * @throws {ChekiAPIError} On non-2xx API responses (after retries).
   * @throws {ChekiNetworkError} On network failures (after retries).
   * @throws {ChekiTimeoutError} On request timeout.
   *
   * @example
   * ```ts
   * const result = await cheki.verifyBatch([
   *   { bank: "cbe", reference: "FT26140P01YB", accountNumber: "1000560536171" },
   *   { bank: "telebirr", reference: "TELEBIRR123", phoneNumber: "0912345678" },
   * ]);
   * console.log(`Verified: ${result.verified}/${result.total}`);
   * ```
   */
  async verifyBatch(
    receipts: Receipt[],
    requestOptions?: RequestOptions,
  ): Promise<BatchResult> {
    return this.request<BatchResult>(
      "POST",
      "/api/verify/batch",
      { receipts },
      requestOptions,
    );
  }

  /**
   * List all supported banks and wallets.
   *
   * @param requestOptions - Per-call overrides for timeout, retries,
   *   and abort signal.
   * @returns List of supported banks with integration metadata.
   * @throws {ChekiAPIError} On non-2xx API responses (after retries).
   * @throws {ChekiNetworkError} On network failures (after retries).
   * @throws {ChekiTimeoutError} On request timeout.
   *
   * @example
   * ```ts
   * const { banks } = await cheki.getBanks();
   * for (const bank of banks) {
   *   console.log(`${bank.code}: ${bank.name} (${bank.status})`);
   * }
   * ```
   */
  async getBanks(requestOptions?: RequestOptions): Promise<BankListResponse> {
    return this.request<BankListResponse>(
      "GET",
      "/api/banks",
      undefined,
      requestOptions,
    );
  }

  /**
   * Check the health of the cheki API service.
   *
   * @param requestOptions - Per-call overrides for timeout, retries,
   *   and abort signal.
   * @returns Service health status with version and component checks.
   * @throws {ChekiAPIError} On non-2xx API responses (after retries).
   * @throws {ChekiNetworkError} On network failures (after retries).
   * @throws {ChekiTimeoutError} On request timeout.
   *
   * @example
   * ```ts
   * const health = await cheki.getHealth();
   * console.log(health.status, health.version);
   * ```
   */
  async getHealth(requestOptions?: RequestOptions): Promise<HealthStatus> {
    return this.request<HealthStatus>(
      "GET",
      "/api/health",
      undefined,
      requestOptions,
    );
  }

  /**
   * Build the URL for viewing a receipt in the cheki web interface.
   *
   * This is a pure helper - it does **not** make a network request.
   *
   * @param bank - Bank code.
   * @param reference - Transaction reference number.
   * @param accountNumber - Optional account number.
   * @returns The full receipt URL.
   *
   * @example
   * ```ts
   * const url = cheki.getReceiptUrl("cbe", "FT26140P01YB", "1000560536171");
   * // "https://chekiapp.vercel.app/api/receipt?bank=cbe&reference=FT26140P01YB&account=1000560536171"
   * ```
   */
  getReceiptUrl(bank: string, reference: string, accountNumber?: string): string {
    const params = new URLSearchParams({ bank, reference });
    if (accountNumber) {
      params.set("account", accountNumber);
    }
    return `${this.config.baseUrl}/api/receipt?${params.toString()}`;
  }

  // ───────────────────────────────────────────────────────────────────────
  // Internal helpers
  // ───────────────────────────────────────────────────────────────────────

  /**
   * Build the full headers object for an API request.
   * User-provided `defaultHeaders` can override built-in headers.
   */
  private buildHeaders(): Record<string, string> {
    const headers: Record<string, string> = {
      "Content-Type": "application/json",
      Accept: "application/json",
      "User-Agent": this.config.userAgent,
    };

    if (this.config.apiKey) {
      headers["Authorization"] = `Bearer ${this.config.apiKey}`;
    }

    for (const [key, value] of Object.entries(this.config.defaultHeaders)) {
      headers[key] = value;
    }

    return headers;
  }

  /**
   * Join the configured base URL with an API path.
   */
  private joinUrl(path: string): string {
    const p = path.startsWith("/") ? path : `/${path}`;
    return `${this.config.baseUrl}${p}`;
  }

  /**
   * Compute the backoff delay for a given retry attempt.
   *
   * Uses exponential backoff with **equal jitter**:
   * ```
   * capped   = min(initial * 2^attempt, maxDelay)
   * delay    = capped / 2 + random(0, capped / 2)
   * ```
   *
   * @param attempt - Zero-based retry attempt number.
   * @returns Delay in milliseconds.
   */
  private computeBackoff(attempt: number): number {
    const exponential = INITIAL_BACKOFF_MS * Math.pow(2, attempt);
    const capped = Math.min(exponential, MAX_BACKOFF_MS);
    return capped / 2 + Math.random() * (capped / 2);
  }

  /**
   * Sleep for the computed backoff delay.
   *
   * If an external `AbortSignal` is provided and fires during the
   * sleep, the promise rejects with a {@link ChekiNetworkError}.
   *
   * @param attempt - Zero-based retry attempt number.
   * @param signal - Optional external `AbortSignal`.
   */
  private async sleepWithBackoff(
    attempt: number,
    signal?: AbortSignal,
  ): Promise<void> {
    const delay = this.computeBackoff(attempt);

    await new Promise<void>((resolve, reject) => {
      const timer = setTimeout(resolve, delay);

      if (!signal) return;

      if (signal.aborted) {
        clearTimeout(timer);
        reject(new ChekiNetworkError("Request aborted by caller signal"));
        return;
      }

      const onAbort = (): void => {
        clearTimeout(timer);
        reject(new ChekiNetworkError("Request aborted by caller signal"));
      };

      signal.addEventListener("abort", onAbort, { once: true });
    });
  }

  /**
   * Core HTTP request method with retry, timeout, and error handling.
   *
   * - **Timeout:** Each attempt is guarded by an `AbortController` with
   *   the configured `timeoutMs`. On timeout, a {@link ChekiTimeoutError}
   *   is thrown.
   * - **Retry:** Transient failures (HTTP 429, 500, 502, 503, 504 and
   *   network errors) are retried up to `maxRetries` times with
   *   exponential backoff + jitter. Non-retryable 4xx errors are thrown
   *   immediately.
   * - **External signal:** If the caller provides an `AbortSignal`, it
   *   is linked to the internal controller. Aborting the external signal
   *   cancels the in-flight request and any pending backoff sleep.
   *
   * @param method - HTTP method (`"GET"` or `"POST"`).
   * @param path - API path (e.g. `"/api/verify"`).
   * @param body - Request body for POST, or `undefined` for GET.
   * @param options - Per-call overrides.
   * @returns Parsed JSON response typed as `T`.
   */
  private async request<T>(
    method: string,
    path: string,
    body: unknown,
    options: RequestOptions | undefined,
  ): Promise<T> {
    const maxRetries = options?.retries ?? this.config.maxRetries;
    const timeoutMs = options?.timeoutMs ?? this.config.timeoutMs;
    const externalSignal = options?.signal;
    const url = this.joinUrl(path);
    const headers = this.buildHeaders();

    for (let attempt = 0; attempt <= maxRetries; attempt++) {
      // Bail out early if the caller has already aborted.
      if (externalSignal?.aborted) {
        throw new ChekiNetworkError("Request aborted by caller signal");
      }

      // ── Set up AbortController for timeout ──────────────────────────
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), timeoutMs);

      // Wire up an external AbortSignal if one was provided.
      let externalAborted = false;
      const onExternalAbort = (): void => {
        externalAborted = true;
        controller.abort();
      };
      if (externalSignal) {
        if (externalSignal.aborted) {
          externalAborted = true;
          controller.abort();
        } else {
          externalSignal.addEventListener("abort", onExternalAbort, {
            once: true,
          });
        }
      }

      const cleanup = (): void => {
        clearTimeout(timer);
        if (externalSignal) {
          externalSignal.removeEventListener("abort", onExternalAbort);
        }
      };

      try {
        // ── Build fetch options ──────────────────────────────────────
        const fetchInit: RequestInit = {
          method,
          headers,
          signal: controller.signal,
        };
        if (body !== undefined) {
          fetchInit.body = JSON.stringify(body);
        }

        const response = await fetch(url, fetchInit);
        cleanup();

        // ── Handle non-2xx responses ─────────────────────────────────
        if (!response.ok) {
          const text = await response.text().catch(() => "");
          let errorBody: unknown = text;
          try {
            errorBody = JSON.parse(text);
          } catch {
            // Keep the raw text as the error body.
          }

          const apiError = new ChekiAPIError(
            `cheki API returned ${response.status} ${response.statusText} for ${method} ${path}`,
            response.status,
            errorBody,
            path,
          );

          // Retry on specific status codes if attempts remain.
          if (
            RETRYABLE_STATUS_CODES.has(response.status) &&
            attempt < maxRetries
          ) {
            await this.sleepWithBackoff(attempt, externalSignal);
            continue;
          }
          throw apiError;
        }

        // ── Parse and return the JSON response ───────────────────────
        return (await response.json()) as T;
      } catch (err) {
        cleanup();

        // Re-throw ChekiAPIError (non-retryable, thrown above).
        if (err instanceof ChekiAPIError) {
          throw err;
        }

        // Re-throw ChekiNetworkError from sleepWithBackoff (caller abort
        // during backoff - thrown from inside the try block).
        if (err instanceof ChekiNetworkError) {
          throw err;
        }

        // ── Handle fetch-level abort (timeout or external signal) ─────
        if (err instanceof Error && err.name === "AbortError") {
          if (externalAborted) {
            throw new ChekiNetworkError(
              `Request to ${path} aborted by caller signal`,
              err,
            );
          }
          throw new ChekiTimeoutError(
            `Request to ${path} timed out after ${timeoutMs}ms`,
            timeoutMs,
          );
        }

        // ── Handle generic network errors ─────────────────────────────
        const message = err instanceof Error ? err.message : String(err);
        const networkError = new ChekiNetworkError(
          `Network request to ${path} failed: ${message}`,
          err instanceof Error ? err : undefined,
        );

        // Retry network errors if attempts remain.
        if (attempt < maxRetries) {
          await this.sleepWithBackoff(attempt, externalSignal);
          continue;
        }
        throw networkError;
      }
    }

    // Unreachable - the loop always returns or throws on every iteration.
    throw new ChekiError("cheki: unreachable state in request loop");
  }
}

export default Cheki;
