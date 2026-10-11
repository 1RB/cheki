"use strict";
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
 * const result = await cheki.verify("cbe", "FT26140P01YB", {
 *   accountNumber: "1000560536171",
 * });
 * if (isVerified(result)) console.log(result.amount, result.senderName);
 * ```
 *
 * @module cheki
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.Cheki = exports.ChekiTimeoutError = exports.ChekiNetworkError = exports.ChekiPayloadTooLargeError = exports.ChekiRateLimitError = exports.ChekiAPIError = exports.ChekiValidationError = exports.ChekiError = exports.RECEIPT_DOWNLOAD_BANKS = exports.MAX_BATCH_SIZE = exports.MAX_RETRIES = exports.DEFAULT_TIMEOUT_MS = void 0;
exports.isVerified = isVerified;
exports.parseRetryAfter = parseRetryAfter;
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
exports.DEFAULT_TIMEOUT_MS = 65000;
/**
 * SDK retries on top of the first attempt. The server already makes up to 2
 * attempts per bank fetch, so the SDK retries at most once: one SDK call
 * reaches a bank at most 2 x 2 = 4 times.
 */
exports.MAX_RETRIES = 1;
/** Maximum receipts per batch request, enforced client-side. */
exports.MAX_BATCH_SIZE = 20;
/** A Retry-After longer than this is not waited out; the 429 is thrown. */
const MAX_RETRY_AFTER_MS = 60000;
/** Base delay before a retry when the server sends no Retry-After. */
const RETRY_BASE_DELAY_MS = 1000;
/** Banks `/api/receipt` can download, and the account digits each needs. */
exports.RECEIPT_DOWNLOAD_BANKS = Object.freeze({
    cbe: { accountDigits: 8 },
    zemen: {},
    dashen: {},
});
const SAFE_REFERENCE_RE = /^[A-Za-z0-9][A-Za-z0-9_.-]{0,63}$/;
/** True only when the bank confirmed the receipt. `success`, `decodedOnly` and `parsed` are not proof. */
function isVerified(result) {
    return typeof result === "object" && result !== null && result.verified === true;
}
// ============================================================================
// Error Hierarchy
// ============================================================================
/** Base class for every error the SDK throws. */
class ChekiError extends Error {
    constructor(message) {
        super(message);
        this.name = "ChekiError";
        Object.setPrototypeOf(this, ChekiError.prototype);
    }
}
exports.ChekiError = ChekiError;
/** Invalid input caught before any request was made (e.g. more than 20 receipts). */
class ChekiValidationError extends ChekiError {
    constructor(message) {
        super(message);
        this.name = "ChekiValidationError";
        Object.setPrototypeOf(this, ChekiValidationError.prototype);
    }
}
exports.ChekiValidationError = ChekiValidationError;
/**
 * The API answered with a non-2xx status. The server's own message is in
 * `serverMessage` (and in `message`); geo-blocked banks add `fallbackUrl`.
 *
 * Status codes: 400 bad input, 404 unsupported bank, 413 body too large,
 * 422 receipt not found / not a valid receipt, 429 rate limited, 502 bank
 * unreachable, 500 internal error.
 */
class ChekiAPIError extends ChekiError {
    constructor(message, statusCode, body, endpoint) {
        super(message);
        this.name = "ChekiAPIError";
        this.statusCode = statusCode;
        this.body = body;
        this.endpoint = endpoint;
        const obj = body && typeof body === "object" ? body : undefined;
        if (typeof obj?.error === "string")
            this.serverMessage = obj.error;
        if (typeof obj?.fallbackUrl === "string")
            this.fallbackUrl = obj.fallbackUrl;
        Object.setPrototypeOf(this, ChekiAPIError.prototype);
    }
}
exports.ChekiAPIError = ChekiAPIError;
/** HTTP 429. `retryAfterSeconds` is the server's Retry-After, when sent. */
class ChekiRateLimitError extends ChekiAPIError {
    constructor(message, body, endpoint, retryAfterSeconds) {
        super(message, 429, body, endpoint);
        this.name = "ChekiRateLimitError";
        this.retryAfterSeconds = retryAfterSeconds;
        Object.setPrototypeOf(this, ChekiRateLimitError.prototype);
    }
}
exports.ChekiRateLimitError = ChekiRateLimitError;
/** HTTP 413: the request body is over the route's cap (verify 16 KB, batch 64 KB). */
class ChekiPayloadTooLargeError extends ChekiAPIError {
    constructor(message, body, endpoint) {
        super(message, 413, body, endpoint);
        this.name = "ChekiPayloadTooLargeError";
        Object.setPrototypeOf(this, ChekiPayloadTooLargeError.prototype);
    }
}
exports.ChekiPayloadTooLargeError = ChekiPayloadTooLargeError;
/** Network-level failure (DNS, connection refused, TLS) or a caller abort. */
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
 * An attempt exceeded the timeout. Timeouts are not retried: the server may
 * still be working on the request (and talking to the bank).
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
const clampRetries = (n, fallback) => {
    const v = n ?? fallback;
    if (!Number.isFinite(v) || v <= 0)
        return 0;
    return Math.min(Math.floor(v), exports.MAX_RETRIES);
};
/** Parse a Retry-After header (delta-seconds or HTTP-date) into seconds. */
function parseRetryAfter(value, now = Date.now()) {
    if (!value)
        return undefined;
    const trimmed = value.trim();
    if (/^\d+$/.test(trimmed))
        return Number(trimmed);
    const date = Date.parse(trimmed);
    if (Number.isNaN(date))
        return undefined;
    return Math.max(0, Math.ceil((date - now) / 1000));
}
// ============================================================================
// Cheki Client
// ============================================================================
class Cheki {
    constructor(config) {
        const cfg = typeof config === "string" ? { baseUrl: config } : config ?? {};
        this.config = {
            baseUrl: (cfg.baseUrl ?? DEFAULT_BASE_URL).replace(/\/+$/, ""),
            timeoutMs: cfg.timeoutMs ?? exports.DEFAULT_TIMEOUT_MS,
            maxRetries: clampRetries(cfg.maxRetries, exports.MAX_RETRIES),
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
    async verify(bank, reference, options, requestOptions) {
        return this.request("POST", "/api/verify", cleanReceipt({ bank, reference, ...options }), requestOptions);
    }
    /**
     * Verify up to {@link MAX_BATCH_SIZE} receipts in one request. Each item
     * also counts against the per-IP verify limit (30/min).
     *
     * @throws {ChekiValidationError} For an empty batch or more than 20 receipts (no request is made).
     */
    async verifyBatch(receipts, requestOptions) {
        if (!Array.isArray(receipts) || receipts.length === 0) {
            throw new ChekiValidationError("verifyBatch needs at least one receipt.");
        }
        if (receipts.length > exports.MAX_BATCH_SIZE) {
            throw new ChekiValidationError(`verifyBatch accepts at most ${exports.MAX_BATCH_SIZE} receipts (got ${receipts.length}). Split the list into chunks of ${exports.MAX_BATCH_SIZE}.`);
        }
        const raw = await this.request("POST", "/api/verify/batch", { receipts: receipts.map(cleanReceipt) }, requestOptions);
        const results = (raw.results ?? []).map((r, index) => ({ ...r, index }));
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
    async getBanks(requestOptions) {
        const raw = await this.request("GET", "/api/banks", undefined, requestOptions);
        const banks = (raw.banks ?? []).map((b) => {
            const id = String(b.id ?? b.code ?? "");
            return { ...b, id, code: id, requiresPhone: b.requiresPhone === true };
        });
        return { banks };
    }
    /** Per-bank reachability. The server caches this for up to 5 minutes. */
    async getHealth(requestOptions) {
        const raw = await this.request("GET", "/api/health", undefined, requestOptions);
        return {
            status: raw.status ?? "unknown",
            checkedAt: raw.checkedAt ?? "",
            cached: raw.cached === true,
            banks: raw.banks ?? [],
        };
    }
    /**
     * URL of `GET /api/receipt`, which downloads the bank's receipt file.
     * Only CBE (needs the account number, at least its last 8 digits), Zemen
     * and Dashen are supported. Pure helper, no request is made.
     *
     * @throws {ChekiValidationError} For an unsupported bank, a bad reference or a missing CBE account.
     */
    getReceiptUrl(bank, reference, accountNumber) {
        const id = String(bank ?? "").trim().toLowerCase();
        const spec = Object.prototype.hasOwnProperty.call(exports.RECEIPT_DOWNLOAD_BANKS, id) ? exports.RECEIPT_DOWNLOAD_BANKS[id] : undefined;
        if (!spec) {
            throw new ChekiValidationError(`Receipt download is only supported for: ${Object.keys(exports.RECEIPT_DOWNLOAD_BANKS).join(", ")}.`);
        }
        const ref = String(reference ?? "").trim();
        if (!SAFE_REFERENCE_RE.test(ref) || ref.includes("..")) {
            throw new ChekiValidationError("reference must be 1-64 letters, digits, dots, dashes or underscores.");
        }
        const params = new URLSearchParams({ bank: id, reference: ref });
        if (spec.accountDigits) {
            const digits = String(accountNumber ?? "").replace(/[\s-]/g, "");
            if (!/^\d+$/.test(digits) || digits.length < spec.accountDigits) {
                throw new ChekiValidationError(`${id} needs the receiving account number (at least the last ${spec.accountDigits} digits).`);
            }
            params.set("account", digits);
        }
        return `${this.config.baseUrl}/api/receipt?${params.toString()}`;
    }
    // ───────────────────────────────────────────────────────────────────────
    // Internal helpers
    // ───────────────────────────────────────────────────────────────────────
    buildHeaders(hasBody) {
        const headers = {
            Accept: "application/json",
            "User-Agent": this.config.userAgent,
        };
        // Only send Content-Type with a body, so GETs stay "simple" requests.
        if (hasBody)
            headers["Content-Type"] = "application/json";
        if (this.config.apiKey)
            headers["Authorization"] = `Bearer ${this.config.apiKey}`;
        return { ...headers, ...this.config.defaultHeaders };
    }
    sleep(ms, signal) {
        return new Promise((resolve, reject) => {
            if (signal?.aborted) {
                reject(new ChekiNetworkError("Request aborted by caller signal"));
                return;
            }
            const onAbort = () => {
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
    retryDelayMs(retryAfterSeconds) {
        if (retryAfterSeconds !== undefined)
            return retryAfterSeconds * 1000;
        return RETRY_BASE_DELAY_MS + Math.random() * RETRY_BASE_DELAY_MS;
    }
    /**
     * One request with at most one retry.
     *
     * Retried: network errors, 5xx, and 429 when Retry-After is at most 60 s.
     * Never retried: other 4xx, timeouts, caller aborts.
     */
    async request(method, path, body, options) {
        const maxRetries = clampRetries(options?.retries, this.config.maxRetries);
        const timeoutMs = options?.timeoutMs ?? this.config.timeoutMs;
        const externalSignal = options?.signal;
        const url = `${this.config.baseUrl}${path}`;
        const headers = this.buildHeaders(body !== undefined);
        for (let attempt = 0;; attempt++) {
            const canRetry = attempt < maxRetries;
            if (externalSignal?.aborted)
                throw new ChekiNetworkError("Request aborted by caller signal");
            const controller = new AbortController();
            let timedOut = false;
            const timer = setTimeout(() => {
                timedOut = true;
                controller.abort();
            }, timeoutMs);
            const onExternalAbort = () => controller.abort();
            externalSignal?.addEventListener("abort", onExternalAbort, { once: true });
            const cleanup = () => {
                clearTimeout(timer);
                externalSignal?.removeEventListener("abort", onExternalAbort);
            };
            let response;
            let text;
            try {
                response = await fetch(url, {
                    method,
                    headers,
                    signal: controller.signal,
                    ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
                });
                text = await response.text();
            }
            catch (err) {
                cleanup();
                if (timedOut) {
                    throw new ChekiTimeoutError(`Request to ${path} timed out after ${timeoutMs}ms`, timeoutMs);
                }
                if (externalSignal?.aborted) {
                    throw new ChekiNetworkError(`Request to ${path} aborted by caller signal`, err instanceof Error ? err : undefined);
                }
                const networkError = new ChekiNetworkError(`Network request to ${path} failed: ${err instanceof Error ? err.message : String(err)}`, err instanceof Error ? err : undefined);
                if (canRetry) {
                    await this.sleep(this.retryDelayMs(), externalSignal);
                    continue;
                }
                throw networkError;
            }
            cleanup();
            let parsed = text;
            try {
                parsed = text ? JSON.parse(text) : undefined;
            }
            catch {
                // Keep the raw text.
            }
            if (response.ok) {
                if (parsed === undefined || typeof parsed !== "object") {
                    throw new ChekiAPIError(`cheki API returned a non-JSON body for ${method} ${path}`, response.status, parsed, path);
                }
                return parsed;
            }
            const status = response.status;
            const serverMessage = parsed && typeof parsed === "object" && typeof parsed.error === "string"
                ? parsed.error
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
            if (status === 413)
                throw new ChekiPayloadTooLargeError(message, parsed, path);
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
exports.Cheki = Cheki;
/** Drop empty optional fields so the server sees exactly what was given. */
function cleanReceipt(r) {
    const out = { bank: r.bank };
    if (r.reference)
        out.reference = r.reference;
    if (r.accountNumber)
        out.accountNumber = r.accountNumber;
    if (r.phoneNumber)
        out.phoneNumber = r.phoneNumber;
    if (r.qrData)
        out.qrData = r.qrData;
    return out;
}
exports.default = Cheki;
