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
/**
 * Default per-attempt timeout (65 s). The server gives a verification up to
 * 60 s (`maxDuration`), so a shorter client timeout would abandon requests
 * the server is still working on.
 */
export declare const DEFAULT_TIMEOUT_MS = 65000;
/**
 * SDK retries on top of the first attempt. The server already makes up to 2
 * attempts per bank fetch, so the SDK retries at most once: one SDK call
 * reaches a bank at most 2 x 2 = 4 times.
 */
export declare const MAX_RETRIES = 1;
/** Maximum receipts per batch request, enforced client-side. */
export declare const MAX_BATCH_SIZE = 20;
/** Banks `/api/receipt` can download, and the account digits each needs. */
/**
 * Banks `GET /api/receipt` serves. `legacyReference` and `accountDigits` mark
 * a legacy format that needs the receiving account: CBE's older FT reference.
 * The current CBE format (a Receipt ID from a mbreciept.cbe.com.et link)
 * needs no account.
 */
export declare const RECEIPT_DOWNLOAD_BANKS: Readonly<Record<string, {
    accountDigits?: number;
    legacyReference?: RegExp;
}>>;
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
export type BatchItemResult = VerifyResult & {
    index: number;
};
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
    responseType: "pdf" | "html" | "json" | (string & {});
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
export declare function isVerified(result: unknown): result is VerifyResult & {
    verified: true;
};
/** Base class for every error the SDK throws. */
export declare class ChekiError extends Error {
    constructor(message: string);
}
/** Invalid input caught before any request was made (e.g. more than 20 receipts). */
export declare class ChekiValidationError extends ChekiError {
    constructor(message: string);
}
/**
 * The API answered with a non-2xx status. The server's own message is in
 * `serverMessage` (and in `message`); geo-blocked banks add `fallbackUrl`.
 *
 * Status codes: 400 bad input, 404 unsupported bank, 413 body too large,
 * 422 receipt not found / not a valid receipt, 429 rate limited, 502 bank
 * unreachable, 500 internal error.
 */
export declare class ChekiAPIError extends ChekiError {
    readonly statusCode: number;
    /** Parsed JSON body if possible, otherwise the raw text. */
    readonly body: unknown;
    /** API path that was called (e.g. `"/api/verify"`). */
    readonly endpoint: string;
    /** The server's `error` text, when it sent one. */
    readonly serverMessage?: string;
    /** For geo-blocked banks: open this link in a browser in Ethiopia instead. */
    readonly fallbackUrl?: string;
    constructor(message: string, statusCode: number, body: unknown, endpoint: string);
}
/** HTTP 429. `retryAfterSeconds` is the server's Retry-After, when sent. */
export declare class ChekiRateLimitError extends ChekiAPIError {
    readonly retryAfterSeconds?: number;
    constructor(message: string, body: unknown, endpoint: string, retryAfterSeconds?: number);
}
/** HTTP 413: the request body is over the route's cap (verify 16 KB, batch 64 KB). */
export declare class ChekiPayloadTooLargeError extends ChekiAPIError {
    constructor(message: string, body: unknown, endpoint: string);
}
/** Network-level failure (DNS, connection refused, TLS) or a caller abort. */
export declare class ChekiNetworkError extends ChekiError {
    /** The original error, if available. */
    readonly cause?: Error;
    constructor(message: string, cause?: Error);
}
/**
 * An attempt exceeded the timeout. Timeouts are not retried: the server may
 * still be working on the request (and talking to the bank).
 */
export declare class ChekiTimeoutError extends ChekiError {
    readonly timeoutMs: number;
    constructor(message: string, timeoutMs: number);
}
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
/** Parse a Retry-After header (delta-seconds or HTTP-date) into seconds. */
export declare function parseRetryAfter(value: string | null | undefined, now?: number): number | undefined;
export declare class Cheki {
    private readonly config;
    constructor(config?: string | ChekiConfig);
    /**
     * Verify one receipt.
     *
     * Resolves for HTTP 200, which includes unverified decoded-only BOA QR
     * results: check {@link isVerified}. Throws {@link ChekiAPIError} for
     * everything else (422 not found, 404 unsupported bank, ...).
     *
     * @param reference - Reference or receipt link. Pass `""` with `options.qrData` for QR-only.
     */
    verify(bank: string, reference: string, options?: VerifyOptions, requestOptions?: RequestOptions): Promise<VerifyResult>;
    /**
     * Verify up to {@link MAX_BATCH_SIZE} receipts in one request. Each item
     * also counts against the per-IP verify limit (30/min).
     *
     * @throws {ChekiValidationError} For an empty batch or more than 20 receipts (no request is made).
     */
    verifyBatch(receipts: Receipt[], requestOptions?: RequestOptions): Promise<BatchResult>;
    /** List supported banks and wallets. `id` is the value to pass as `bank`. */
    getBanks(requestOptions?: RequestOptions): Promise<BankListResponse>;
    /** Per-bank reachability. The server caches this for up to 5 minutes. */
    getHealth(requestOptions?: RequestOptions): Promise<HealthStatus>;
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
    getReceiptUrl(bank: string, reference: string, accountNumber?: string): string;
    private buildHeaders;
    private sleep;
    /** Delay before the retry: Retry-After when sent, otherwise 1-2 s. */
    private retryDelayMs;
    /**
     * One request with at most one retry.
     *
     * Retried: network errors, 5xx, and 429 when Retry-After is at most 60 s.
     * Never retried: other 4xx, timeouts, caller aborts.
     */
    private request;
}
export default Cheki;
