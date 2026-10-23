/**
 * Bunna Bank parser.
 *
 * Receipt link (what people share):
 *   https://online.bunnabanksc.com/receipt/#/{token}
 *   {token} is an opaque base64 string (44 characters, 32 bytes, on the
 *   receipts seen so far), URL-encoded in the link (S%2B...%3D). It lives in
 *   the URL fragment, so the page's HTML carries no receipt data: an Angular
 *   app reads the token and asks the JSON service below.
 * Receipt QR (what the receipt page draws on the slip):
 *   https://online.bunnabanksc.com/#/receipt-v2/{encodeURIComponent(token)}
 *   The app routes "#/{token}", "#/receipt/{token}" and "#/receipt-v2/{token}"
 *   to the same receipt view, joining any extra path segments with "/" (an
 *   unencoded token can contain "/").
 * Data endpoint (what cheki fetches):
 *   https://online.bunnabanksc.com/st_backend/api/v1/advice?data={token}
 *   No credential. HTTP 200 JSON either way:
 *     {"status":"SUCCESS","receipt":{...}}   a receipt
 *     {"status":"FAILURE","message":"Something went wrong!"}   anything else
 *   Bunna gives the same FAILURE for an unknown token, a malformed one and,
 *   most likely, its own errors, so FAILURE is "not confirmed", never proof
 *   that a receipt is fake.
 *
 * Record (values here are made up):
 *   {"drAccountName":"TEST PAYER ONE","drAccount":"1000*****0001",
 *    "crAccountName":"TEST RECEIVER","crAccount":"9000*****0002",
 *    "currency":"ETB","tranType":null,"typeOfService":null,
 *    "serviceCharge":0.0,"totalAmount":0.0,"vat":0.0,"disasterAmount":0.0,
 *    "netAmount":0.0,"tranId":"BB00001","tranDate":"2026-10-01 00:00:00",
 *    "amount":1250.0}
 *
 * Mapping:
 *   - drAccountName / drAccount: the debited account, the payer.
 *   - crAccountName / crAccount: the credited account, the receiver (for a
 *     wallet transfer Bunna names the wallet, e.g. "Telebirr").
 *   - Bunna masks the account numbers itself (first 4, last 4). An account
 *     that arrives without a "*" is masked here (first digit and last 4)
 *     before it reaches any field, so a change upstream cannot leak one.
 *   - tranDate carries a date only (time 00:00:00), so only the date is kept.
 *   - tranId is Bunna's transaction reference. It is not the token the
 *     record is looked up by, so the gate treats the token as an opaque key
 *     (core/gate.ts). The record does not echo the token back.
 *   - serviceCharge, vat, totalAmount, netAmount and disasterAmount are not
 *     mapped: on the one receipt seen they were all 0.0, including the total,
 *     so they look unfilled rather than zero.
 *
 * The token is not decoded or derived: cheki only passes on a token taken
 * from a receipt link or QR, one per check, under the usual per-IP limits.
 */
import { BaseParser } from "./base";
import type { ParsedReceipt } from "../core/types";
import type { Checked } from "../security/reference";
import { canonicalBunnaToken } from "../reference-case";

import { BUNNA_HOST } from "../adapters/url-detector";

export { BUNNA_HOST };

/** Token length in bytes, decoded. 32 seen; a little room either side. */
const MIN_TOKEN_BYTES = 16;
const MAX_TOKEN_BYTES = 256;

/** Fields of the raw record kept in `raw` (no names, no account numbers). */
const RAW_SAFE_KEYS = ["tranId", "tranDate", "amount", "currency", "tranType", "typeOfService"] as const;

const BUNNA_TOKEN_HELP =
  "Paste the whole Bunna Bank receipt link (online.bunnabanksc.com/receipt/#/...) or scan the receipt QR. The transaction number printed on the receipt does not work on its own.";

/**
 * Validate a Bunna receipt token and return it in one canonical form:
 * standard base64 with padding, as the receipt page sends it.
 *
 * Accepted on the way in: the URL-encoded form from a link (%2B, %2F, %3D),
 * a "+" that became a space, base64url ("-" and "_") and missing padding.
 * Anything that is not base64, or decodes to fewer than 16 or more than 256
 * bytes, is rejected without a request (a typed transaction number such as
 * "BB12345" is 7 characters, so it never reaches Bunna).
 */
export function checkBunnaToken(input: unknown): Checked<string> {
  if (typeof input !== "string") return { ok: false, message: "Receipt link must be text." };
  if (!input.trim()) return { ok: false, message: "Receipt link is required." };
  if (input.length > 1024) return { ok: false, message: BUNNA_TOKEN_HELP };
  const padded = canonicalBunnaToken(input);
  if (!/^[A-Za-z0-9+/]+={0,2}$/.test(padded) || padded.length % 4 !== 0) return { ok: false, message: BUNNA_TOKEN_HELP };
  const bytes = Buffer.from(padded, "base64");
  if (bytes.length < MIN_TOKEN_BYTES || bytes.length > MAX_TOKEN_BYTES) {
    return { ok: false, message: BUNNA_TOKEN_HELP };
  }
  // Round-trip: the canonical form is exactly what base64 encoding gives back
  // (rejects stray bits in the last character that Buffer silently drops).
  if (bytes.toString("base64") !== padded) return { ok: false, message: BUNNA_TOKEN_HELP };
  return { ok: true, value: padded };
}

/** A non-blank string field (numbers become strings); "null" counts as missing. */
function text(v: unknown): string | undefined {
  if (typeof v === "number" && Number.isFinite(v)) return String(v);
  if (typeof v !== "string") return undefined;
  const s = v.trim();
  if (!s || s.toLowerCase() === "null") return undefined;
  return s;
}

/**
 * An account number as it may be shown. Bunna's own mask ("1000*****0001",
 * at most 4 characters either side of one run of stars) is kept. Anything
 * else, unmasked or partly masked ("1000123*450001"), keeps its first
 * character and last 4.
 */
export function maskBunnaAccount(v: unknown): string | undefined {
  const s = text(v)?.replace(/\s+/g, "");
  if (!s) return undefined;
  // Bunna's own mask: at most 4 characters either side of the stars. Kept.
  if (/^[^*]{0,4}\*+[^*]{0,4}$/.test(s)) return s;
  if (s.length <= 5) return "*".repeat(s.length);
  // Unmasked, or masked some other way that may show more: first character and last 4.
  return `${s[0]}${"*".repeat(s.length - 5)}${s.slice(-4)}`;
}

/** "2026-10-01 00:00:00" → "2026-10-01". Anything else is returned as Bunna wrote it. */
function dateOnly(v: unknown): string | undefined {
  const s = text(v);
  if (!s) return undefined;
  const m = /^(\d{4}-\d{2}-\d{2})(?:[ T]00:00(?::00(?:\.0+)?)?)?$/.exec(s);
  return m ? m[1] : s;
}

/** A positive amount from a number or a numeric string. */
function amountOf(v: unknown): number | undefined {
  const n = typeof v === "number" ? v : typeof v === "string" && /^\d+(\.\d+)?$/.test(v.trim()) ? Number(v) : NaN;
  return Number.isFinite(n) && n > 0 ? n : undefined;
}

/** Redacted copy of the record for `raw`: no names, accounts masked. */
function safeRaw(row: Record<string, unknown>): string {
  const out: Record<string, unknown> = {};
  for (const k of RAW_SAFE_KEYS) if (k in row) out[k] = row[k];
  if ("drAccount" in row) out.drAccount = maskBunnaAccount(row.drAccount) ?? null;
  if ("crAccount" in row) out.crAccount = maskBunnaAccount(row.crAccount) ?? null;
  return JSON.stringify(out).slice(0, 1000);
}

export class BunnaParser extends BaseParser {
  readonly bankId = "bunna";
  readonly bankName = "Bunna International Bank";
  readonly responseType = "json" as const;
  readonly requiresAccount = false;
  readonly accountDigits?: number = undefined;
  readonly requiresPhone = false;

  normalizeReference(ref: string): Checked<string> {
    return checkBunnaToken(ref);
  }

  buildUrl(ref: string): string {
    const token = checkBunnaToken(ref);
    if (!token.ok) throw new Error(token.message);
    return `https://${BUNNA_HOST}/st_backend/api/v1/advice?data=${encodeURIComponent(token.value)}`;
  }

  /** The public receipt page for a token (what `sourceUrl` and `checkedUrl` point at). */
  static receiptPageUrl(token: string): string {
    return `https://${BUNNA_HOST}/receipt/#/${encodeURIComponent(token)}`;
  }

  protected requestHeaders(): Record<string, string> {
    return { Accept: "application/json" };
  }

  /**
   * Read Bunna's answer. `notFound` is true for its FAILURE envelope (Bunna
   * has no receipt for the token, or could not say), false for anything that
   * is not Bunna's JSON at all.
   */
  static parseAdvice(data: string | Buffer): { parsed: ParsedReceipt; notFound: boolean } {
    const body = (typeof data === "string" ? data : data.toString("utf8")).trim();
    let doc: unknown;
    try {
      doc = JSON.parse(body);
    } catch {
      return { parsed: { verified: false }, notFound: false };
    }
    if (!doc || typeof doc !== "object" || Array.isArray(doc)) return { parsed: { verified: false }, notFound: false };
    const d = doc as Record<string, unknown>;
    const status = typeof d.status === "string" ? d.status.trim().toUpperCase() : "";
    if (status === "FAILURE") return { parsed: { verified: false }, notFound: true };
    if (status !== "SUCCESS") return { parsed: { verified: false }, notFound: false };
    const row = d.receipt;
    if (!row || typeof row !== "object" || Array.isArray(row)) return { parsed: { verified: false }, notFound: false };
    const r = row as Record<string, unknown>;

    const parsed: ParsedReceipt = {
      verified: true,
      senderName: text(r.drAccountName),
      senderAccount: maskBunnaAccount(r.drAccount),
      receiverName: text(r.crAccountName),
      receiverAccount: maskBunnaAccount(r.crAccount),
      amount: amountOf(r.amount),
      currency: text(r.currency) ?? "ETB",
      date: dateOnly(r.tranDate),
      reference: text(r.tranId),
      transactionType: text(r.typeOfService) ?? text(r.tranType),
      raw: safeRaw(r),
    };
    // Drop the keys Bunna did not fill, so no empty fields reach the API or the UI.
    for (const k of Object.keys(parsed) as (keyof ParsedReceipt)[]) {
      if (parsed[k] === undefined) delete parsed[k];
    }
    return { parsed, notFound: false };
  }

  parse(data: string | Buffer, _contentType: string): ParsedReceipt {
    return BunnaParser.parseAdvice(data).parsed;
  }
}
