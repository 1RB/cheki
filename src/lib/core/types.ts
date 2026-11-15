/**
 * cheki core - Result types, Receipt entity, errors.
 *
 * This module has ZERO runtime dependencies. It defines the domain model
 * and the contracts (ports) that adapters implement.
 *
 * Architecture: Hexagonal / Ports & Adapters
 *   - Core defines interfaces (ports)
 *   - Parsers, HTTP client, URL detector implement those interfaces (adapters)
 *   - API routes and CLI are driving adapters that call the Verifier
 */

// ─── Result Type (discriminated union, Matt Pocock style) ───────────

export type Result<T, E = ChekiError> =
  | { ok: true; value: T }
  | { ok: false; error: E };

export const ok = <T>(value: T): Result<T, never> => ({ ok: true, value });
export const err = <E>(error: E): Result<never, E> => ({ ok: false, error });

// ─── Branded Types for domain safety ────────────────────────────────

export type Brand<T, B> = T & { readonly __brand: B };
export type BankId = Brand<string, "BankId">;
export type Reference = Brand<string, "Reference">;

// ─── Error Hierarchy (discriminated unions, not classes) ────────────

/**
 * Why a check failed, as data. Every surface that has to *decide* what a
 * failure means (the verdict card, a test, an SDK) reads this code; the
 * `message` is copy for humans and must never be pattern-matched: rewording
 * a message may not change what a result means.
 *
 *   gate:*     the bank answered, cheki's gate refused to confirm it:
 *              amount / reference / party / status map 1:1 to GateFailure.
 *   notFound   the bank has no such receipt.
 *   notFound:otherAccount  BOA files some receipts under the payer's
 *              account, so a miss says which other account to try.
 *   unreadable the bank (or the QR) answered, but not in a shape cheki can
 *              read; it is not a claim that the receipt does not exist.
 *   qrMismatch the QR's own numbers contradict the bank's record.
 */
export type ChekiErrorCode =
  | "gate:amount"
  | "gate:reference"
  | "gate:party"
  | "gate:status"
  | "notFound"
  | "notFound:otherAccount"
  | "unreadable"
  | "qrMismatch";

/** True for the codes that mean "the bank has no such receipt". */
export function isNotFoundCode(code: ChekiErrorCode | undefined): boolean {
  return code === "notFound" || code === "notFound:otherAccount";
}

export type ChekiError =
  | { kind: "BANK_NOT_SUPPORTED"; bank: string; suggestion?: string; message?: string }
  | { kind: "REF_ERROR"; bank: string; message: string }
  | { kind: "ENDPOINT_ERROR"; bank: string; message: string; fallbackUrl?: string }
  | {
      kind: "EXTRACTION_ERROR";
      bank: string;
      message: string;
      /** What this failure means (see ChekiErrorCode). Set by every producer. */
      code?: ChekiErrorCode;
      /** Bank-supplied detail for a code, e.g. the status word a gate:status shows. */
      detail?: string;
      /**
       * The bank page cheki asked, when the bank answered but did not confirm
       * the receipt, so anyone can open it and see the bank's answer.
       */
      checkedUrl?: string;
    }
  | { kind: "MISSING_INPUT"; field: string; message: string }
  | { kind: "INTERNAL_ERROR"; message: string };

export function errorToHttpStatus(error: ChekiError): number {
  switch (error.kind) {
    case "BANK_NOT_SUPPORTED": return 404;
    case "REF_ERROR": return 400;
    case "MISSING_INPUT": return 400;
    case "ENDPOINT_ERROR": return 502;
    case "EXTRACTION_ERROR": return 422;
    case "INTERNAL_ERROR": return 500;
    default: {
      const _exhaustive: never = error;
      return 500;
    }
  }
}

export function errorToMessage(error: ChekiError): string {
  switch (error.kind) {
    case "BANK_NOT_SUPPORTED":
      if (error.message) return error.message;
      return `Unsupported bank: ${error.bank}.${error.suggestion ? ` Did you mean ${error.suggestion}?` : ""}`;
    case "REF_ERROR":
      return `[${error.bank}] ${error.message}`;
    case "ENDPOINT_ERROR":
      // The message ends with "Open the receipt directly:" when there is a link.
      return `[${error.bank}] ${error.message}${error.fallbackUrl ? ` ${error.fallbackUrl}` : ""}`;
    case "EXTRACTION_ERROR":
      return `[${error.bank}] ${error.message}`;
    case "MISSING_INPUT":
      return error.message;
    case "INTERNAL_ERROR":
      return error.message;
    default: {
      const _exhaustive: never = error;
      return "Unknown error";
    }
  }
}

/**
 * The JSON body of a failed check, for both verify routes. `code` / `detail`
 * / `field` are what the verdict card switches on; `error` is copy for
 * humans. Built here so a new field is added once and the two routes can
 * never drift apart.
 */
export function errorPayload(error: ChekiError): Record<string, unknown> {
  return {
    success: false,
    error: errorToMessage(error),
    ...(error.kind === "EXTRACTION_ERROR"
      ? { ...(error.code ? { code: error.code } : {}), ...(error.detail ? { detail: error.detail } : {}) }
      : {}),
    ...(error.kind === "MISSING_INPUT" ? { field: error.field } : {}),
    ...(error.kind === "ENDPOINT_ERROR" && error.fallbackUrl ? { fallbackUrl: error.fallbackUrl } : {}),
    ...(error.kind === "EXTRACTION_ERROR" && error.checkedUrl ? { checkedUrl: error.checkedUrl } : {}),
  };
}

// ─── Receipt Entity ─────────────────────────────────────────────────

export interface Receipt {
  verified: boolean;
  bank: string;
  bankCode: string;
  reference: string;
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
  durationMs?: number;
  // Telebirr / wallet-specific
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
  orderId?: string;
  /**
   * True when the data was decoded from a BOA QR code but could not be
   * confirmed with the bank (it was unreachable). Always paired with
   * verified: false. A QR payload can be forged, so this is never proof.
   */
  decodedOnly?: boolean;
}

// ─── Verify Request (input) ─────────────────────────────────────────

export interface VerifyRequest {
  bank: string;
  reference?: string;
  accountNumber?: string;
  phoneNumber?: string;
  qrData?: string;
  /**
   * The reference came from a receipt link or a QR payload rather than a
   * keyboard, so it is uppercased but never compacted (see
   * src/lib/reference-input.ts). Not an API field: both verify routes build
   * this object field by field from JSON, so only the verifier's QR branches
   * ever set it.
   */
  fromLink?: boolean;
}

// ─── Parser Port (interface that bank parsers implement) ────────────

export interface ParserPort {
  readonly bankId: string;
  readonly bankName: string;
  readonly responseType: "pdf" | "html" | "json";
  readonly accountDigits?: number;
  readonly requiresPhone: boolean;

  buildUrl(ref: string, account?: string, phone?: string): string;
  parse(data: string | Buffer, contentType: string): ParsedReceipt;
}

export interface ParsedReceipt {
  verified: boolean;
  senderName?: string;
  senderAccount?: string;
  receiverName?: string;
  receiverAccount?: string;
  amount?: number;
  currency?: string;
  date?: string;
  reference?: string;
  branch?: string;
  reason?: string;
  transactionType?: string;
  raw?: string;
  // Telebirr / wallet-specific fields
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
  orderId?: string;
}

// ─── HTTP Port (interface for fetching from banks) ──────────────────

export interface HttpPort {
  fetch(
    url: string,
    options: HttpFetchOptions
  ): Promise<Result<HttpResult>>;
}

export interface HttpFetchOptions {
  method?: "GET" | "POST";
  headers?: Record<string, string>;
  timeoutMs?: number;
  maxRetries?: number;
  geoBlocked?: boolean;
  fallbackUrl?: string;
}

export interface HttpResult {
  status: number;
  data: string | Buffer;
  contentType: string;
}

// ─── Bank Manifest Entry ────────────────────────────────────────────

export interface BankFaqEntry {
  q: string;
  a: string;
}

export interface BankSeoEntry {
  title: string;
  description: string;
  keywords: string[];
}

export interface BankRefPattern {
  source: string;
  flags: string;
}

/**
 * One receipt format a bank has used. A bank's `formats` are ordered: current
 * formats first, then legacy (still accepted and fetched), then deprecated
 * (links still recognised for their reference, never fetched).
 */
export type ReceiptFormatStatus = "current" | "legacy" | "deprecated";

/** What a format needs from the user. "qr": a receipt QR code (scanned, uploaded or pasted). */
export type ReceiptFormatInputName = "reference" | "receiptId" | "link" | "account" | "phone" | "qr";

export interface ReceiptFormatInput {
  name: ReceiptFormatInputName;
  label: string;
  example?: string;
  /** For `account`: how many trailing digits the bank uses. */
  digits?: number;
}

/**
 * What a receipt endpoint answers with, as recorded in banks.json.
 * "pdf-in-json": a JSON envelope whose field holds the receipt as a
 * base64-encoded PDF (M-Pesa's getReceipt). Parsers still declare the wire
 * format ("json") as their own responseType.
 */
export type ManifestResponseType = "pdf" | "html" | "json" | "pdf-in-json";

export interface ReceiptFormat {
  id: string;
  status: ReceiptFormatStatus;
  label: string;
  /** Registered parser that fetches this format. Absent: cheki does not fetch it (not supported yet, or deprecated). */
  parser?: string;
  /**
   * Input-only format: cheki reads the reference out of it (on the device or
   * the server) and checks it through the format with this id, exactly as if
   * the reference had been typed. Never fetched, never proof on its own.
   * Telebirr's receipt QR is one.
   */
  via?: string;
  /** URL template cheki fetches. Its host is allowlisted when the format has a parser and is not deprecated. */
  endpoint?: string;
  /** URL template of the receipt page people share or open. */
  link?: string;
  /**
   * Hosts this format's receipt pages are served from, shown on /endpoints
   * when the format has no `link`/`endpoint` template and in the "Reported
   * host" line for evidence-only rows. It documents; it does not recognise:
   * whether a pasted URL counts as this format's receipt is decided in
   * src/lib/adapters/url-detector.ts, and tests/manifest/link-hosts.test.ts
   * pins the two against each other.
   */
  linkHosts?: string[];
  inputs: ReceiptFormatInput[];
  /** References this format accepts. Used to pick a format by the shape of the input. */
  refPattern?: BankRefPattern;
  responseType: ManifestResponseType;
  headers?: Record<string, string>;
  /** How GET /api/receipt serves it: a 302 to `link`, or the bank's PDF proxied. */
  receiptPage?: "redirect" | "pdf";
  /** YYYY-MM or YYYY-MM-DD, when known. */
  since?: string;
  deprecatedAt?: string;
  replacedBy?: string;
  /** "verified": observed by cheki; "inferred": from another source, see evidence. */
  confidence: "verified" | "inferred";
  evidence: string;
  notes?: string;
  /** Shown when the input matches this format but a required field is missing. */
  missingHint?: string;
}

export interface EndpointHistoryEntry {
  date: string;
  formatId?: string;
  change: string;
  source?: string;
}

/**
 * A bank's head-office SWIFT/BIC, shown on its page as reference info.
 * `registry: "confirmed"` means SWIFT's own BIC search returned this code and
 * it matches the bank's website. `"not-checked"` means the SWIFT registry was
 * not searched: the code comes from the bank's website or the National Bank
 * of Ethiopia plus one independent cross-check, and the page says so. A code
 * without two agreeing sources is left out rather than guessed.
 */
export interface BankSwift {
  /** 8-character head-office BIC (11 with XXX is the same office). */
  bic: string;
  /** Source pages: the bank's own site (or NBE) first, then the cross-check. */
  sources: string[];
  /** ISO date (YYYY-MM-DD) the sources were last read. */
  checkedAt: string;
  /** Whether SWIFT's BIC search itself confirmed the code. */
  registry: "confirmed" | "not-checked";
}

export interface BankManifestEntry {
  id: string;
  name: string;
  shortName?: string;
  /** Head-office SWIFT/BIC, reference only (see BankSwift). Absent for wallets and unconfirmed codes. */
  swift?: BankSwift;
  type: "bank" | "wallet" | "mobile";
  status: "live" | "in-development";
  /**
   * Live, but the parser is only partly confirmed: not yet confirmed with a
   * real receipt (M-Pesa, whose parser follows other verifiers' source), or
   * confirmed with a single receipt shape and an inferred field mapping
   * (ZamZam). Copy and clients should label it beta; `betaNote` says why.
   * Cleared once real receipts settle it.
   */
  beta?: boolean;
  betaNote?: string;
  parser: string;
  responseType: ManifestResponseType;
  requiresAccount: boolean;
  accountLabel?: string;
  accountDigits?: number;
  requiresPhone: boolean;
  endpoint: string;
  endpointFormat?: string;
  /**
   * How the receipt endpoint authenticates, when it does (ZamZam: a public
   * Basic credential from the bank's own web app, kept in the parser).
   * Absent: the endpoint needs no authentication.
   */
  endpointAuth?: string;
  headers?: Record<string, string>;
  geoBlocked?: boolean;
  notes?: string;
  color: string;
  initials: string;
  refPattern?: BankRefPattern | string;
  refPrefixes?: string[];
  description?: string;
  referenceFormat?: string;
  referenceExample?: string;
  howToVerify?: string[];
  useCases?: string[];
  faq?: BankFaqEntry[];
  seo?: BankSeoEntry;
  /** Receipt formats, current first. Top-level endpoint fields describe the first supported one. */
  formats?: ReceiptFormat[];
  /** Dated endpoint changes (host moves, format switches, observed outages). */
  endpointHistory?: EndpointHistoryEntry[];
}
