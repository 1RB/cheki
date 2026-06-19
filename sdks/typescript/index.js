"use strict";
/**
 * cheki — TypeScript SDK for the cheki receipt verification API.
 *
 * Verify Ethiopian bank transfer receipts from CBE, Telebirr, BOA, Dashen,
 * M-Pesa, and more. Zero runtime dependencies — uses the global Fetch API
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
Object.defineProperty(exports, "__esModule", { value: true });
exports.Cheki = exports.ChekiTimeoutError = exports.ChekiNetworkError = exports.ChekiAPIError = exports.ChekiError = void 0;
// ============================================================================
// Constants
// ============================================================================
/** SDK version — reflected in the default User-Agent header. */
const VERSION = "1.0.0";
/** Default API base URL. */
const DEFAULT_BASE_URL = "https://cheki-pi.vercel.app";
/** Default request timeout in milliseconds (30 seconds). */
const DEFAULT_TIMEOUT_MS = 30000;
/** Default maximum number of retry attempts. */
const DEFAULT_MAX_RETRIES = 3;
/** Default User-Agent header value. */
const DEFAULT_USER_AGENT = `cheki-sdk-typescript/${VERSION}`;
/** Initial exponential backoff delay in milliseconds. */
const INITIAL_BACKOFF_MS = 500;
/** Maximum (capped) exponential backoff delay in milliseconds. */
const MAX_BACKOFF_MS = 5000;
/** HTTP status codes that are eligible for automatic retry. */
const RETRYABLE_STATUS_CODES = new Set([429, 500, 502, 503, 504]);
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
class ChekiError extends Error {
    constructor(message) {
        super(message);
        this.name = "ChekiError";
        Object.setPrototypeOf(this, ChekiError.prototype);
    }
}
exports.ChekiError = ChekiError;
/**
 * Error thrown when the cheki API returns a non-2xx HTTP status code.
 *
 * Includes the HTTP status code, the parsed (or raw) response body,
 * and the API endpoint path that was called.
 */
class ChekiAPIError extends ChekiError {
    constructor(message, statusCode, body, endpoint) {
        super(message);
        this.name = "ChekiAPIError";
        this.statusCode = statusCode;
        this.body = body;
        this.endpoint = endpoint;
        Object.setPrototypeOf(this, ChekiAPIError.prototype);
    }
}
exports.ChekiAPIError = ChekiAPIError;
/**
 * Error thrown when a network-level failure occurs (e.g. DNS resolution
 * failure, connection refused, TLS handshake error, or caller-initiated
 * abort). The original underlying error is preserved in {@link cause}.
 */
class ChekiNetworkError extends ChekiError {
    constructor(message, cause) {
        super(message);
        this.name = "ChekiNetworkError";
        this.cause = cause;
        Object.setPrototypeOf(this, ChekiNetworkError.prototype);
    }
}
exports.ChekiNetworkError = ChekiNetworkError;
/**
 * Error thrown when a request exceeds the configured timeout and is
 * aborted. The timeout duration (in milliseconds) is included for
 * diagnostics.
 */
class ChekiTimeoutError extends ChekiError {
    constructor(message, timeoutMs) {
        super(message);
        this.name = "ChekiTimeoutError";
        this.timeoutMs = timeoutMs;
        Object.setPrototypeOf(this, ChekiTimeoutError.prototype);
    }
}
exports.ChekiTimeoutError = ChekiTimeoutError;
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
 *   baseUrl: "https://cheki-pi.vercel.app",
 *   timeoutMs: 10_000,
 *   maxRetries: 5,
 *   apiKey: "sk_live_...",
 * });
 * ```
 */
class Cheki {
    /**
     * Create a new Cheki client.
     *
     * @param config - Base URL string, full configuration object, or
     *   `undefined` to use all defaults (public cheki API).
     */
    constructor(config) {
        const cfg = typeof config === "string" ? { baseUrl: config } : config ?? {};
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
    async verify(bank, reference, options, requestOptions) {
        const body = { bank, reference, ...options };
        return this.request("POST", "/api/verify", body, requestOptions);
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
    async verifyBatch(receipts, requestOptions) {
        return this.request("POST", "/api/verify/batch", { receipts }, requestOptions);
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
    async getBanks(requestOptions) {
        return this.request("GET", "/api/banks", undefined, requestOptions);
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
    async getHealth(requestOptions) {
        return this.request("GET", "/api/health", undefined, requestOptions);
    }
    /**
     * Build the URL for viewing a receipt in the cheki web interface.
     *
     * This is a pure helper — it does **not** make a network request.
     *
     * @param bank - Bank code.
     * @param reference - Transaction reference number.
     * @param accountNumber - Optional account number.
     * @returns The full receipt URL.
     *
     * @example
     * ```ts
     * const url = cheki.getReceiptUrl("cbe", "FT26140P01YB", "1000560536171");
     * // "https://cheki-pi.vercel.app/api/receipt?bank=cbe&reference=FT26140P01YB&account=1000560536171"
     * ```
     */
    getReceiptUrl(bank, reference, accountNumber) {
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
    buildHeaders() {
        const headers = {
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
    joinUrl(path) {
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
    computeBackoff(attempt) {
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
    async sleepWithBackoff(attempt, signal) {
        const delay = this.computeBackoff(attempt);
        await new Promise((resolve, reject) => {
            const timer = setTimeout(resolve, delay);
            if (!signal)
                return;
            if (signal.aborted) {
                clearTimeout(timer);
                reject(new ChekiNetworkError("Request aborted by caller signal"));
                return;
            }
            const onAbort = () => {
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
    async request(method, path, body, options) {
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
            const onExternalAbort = () => {
                externalAborted = true;
                controller.abort();
            };
            if (externalSignal) {
                if (externalSignal.aborted) {
                    externalAborted = true;
                    controller.abort();
                }
                else {
                    externalSignal.addEventListener("abort", onExternalAbort, {
                        once: true,
                    });
                }
            }
            const cleanup = () => {
                clearTimeout(timer);
                if (externalSignal) {
                    externalSignal.removeEventListener("abort", onExternalAbort);
                }
            };
            try {
                // ── Build fetch options ──────────────────────────────────────
                const fetchInit = {
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
                    let errorBody = text;
                    try {
                        errorBody = JSON.parse(text);
                    }
                    catch {
                        // Keep the raw text as the error body.
                    }
                    const apiError = new ChekiAPIError(`cheki API returned ${response.status} ${response.statusText} for ${method} ${path}`, response.status, errorBody, path);
                    // Retry on specific status codes if attempts remain.
                    if (RETRYABLE_STATUS_CODES.has(response.status) &&
                        attempt < maxRetries) {
                        await this.sleepWithBackoff(attempt, externalSignal);
                        continue;
                    }
                    throw apiError;
                }
                // ── Parse and return the JSON response ───────────────────────
                return (await response.json());
            }
            catch (err) {
                cleanup();
                // Re-throw ChekiAPIError (non-retryable, thrown above).
                if (err instanceof ChekiAPIError) {
                    throw err;
                }
                // Re-throw ChekiNetworkError from sleepWithBackoff (caller abort
                // during backoff — thrown from inside the try block).
                if (err instanceof ChekiNetworkError) {
                    throw err;
                }
                // ── Handle fetch-level abort (timeout or external signal) ─────
                if (err instanceof Error && err.name === "AbortError") {
                    if (externalAborted) {
                        throw new ChekiNetworkError(`Request to ${path} aborted by caller signal`, err);
                    }
                    throw new ChekiTimeoutError(`Request to ${path} timed out after ${timeoutMs}ms`, timeoutMs);
                }
                // ── Handle generic network errors ─────────────────────────────
                const message = err instanceof Error ? err.message : String(err);
                const networkError = new ChekiNetworkError(`Network request to ${path} failed: ${message}`, err instanceof Error ? err : undefined);
                // Retry network errors if attempts remain.
                if (attempt < maxRetries) {
                    await this.sleepWithBackoff(attempt, externalSignal);
                    continue;
                }
                throw networkError;
            }
        }
        // Unreachable — the loop always returns or throws on every iteration.
        throw new ChekiError("cheki: unreachable state in request loop");
    }
}
exports.Cheki = Cheki;
exports.default = Cheki;
