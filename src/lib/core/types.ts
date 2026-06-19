/**
 * cheki core — Result types, Receipt entity, errors.
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

export type ChekiError =
  | { kind: "BANK_NOT_SUPPORTED"; bank: string; suggestion?: string }
  | { kind: "REF_ERROR"; bank: string; message: string }
  | { kind: "ENDPOINT_ERROR"; bank: string; message: string; fallbackUrl?: string }
  | { kind: "EXTRACTION_ERROR"; bank: string; message: string }
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
      return `Unsupported bank: ${error.bank}.${error.suggestion ? ` Did you mean ${error.suggestion}?` : ""}`;
    case "REF_ERROR":
      return `[${error.bank}] ${error.message}`;
    case "ENDPOINT_ERROR":
      return error.message;
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
}

// ─── Verify Request (input) ─────────────────────────────────────────

export interface VerifyRequest {
  bank: string;
  reference?: string;
  accountNumber?: string;
  phoneNumber?: string;
  qrData?: string;
}

// ─── Parser Port (interface that bank parsers implement) ────────────

export interface ParserPort {
  readonly bankId: string;
  readonly bankName: string;
  readonly responseType: "pdf" | "html" | "json";
  readonly requiresAccount: boolean;
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

export interface BankManifestEntry {
  id: string;
  name: string;
  swift?: string;
  type: "bank" | "wallet";
  status: "live" | "in-development";
  parser: string;
  responseType: "pdf" | "html" | "json";
  requiresAccount: boolean;
  accountDigits?: number;
  requiresPhone: boolean;
  endpoint: string;
  sslVerify: boolean;
  headers?: Record<string, string>;
  notes?: string;
  color: string;
  initials: string;
}
