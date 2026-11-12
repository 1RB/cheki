/**
 * Wegagen Bank parser.
 *
 * Share link (what people share): https://transinfo.wegagenbanksc.com.et:8183/?id={SHARE_ID}
 *   {SHARE_ID} is 24 letters and digits: the 16-character Reference No printed
 *   on the receipt, then the first 4 digits of the account the record is filed
 *   under, the debit/credit flag (D) and the transaction code (FTD, ...).
 *   Checked on three real share links (2026-11-11). The printed 16-character
 *   Reference No on its own is NOT a lookup key: only a full share id answers.
 *
 * Data endpoint (what cheki fetches):
 *   https://transinfo.wegagenbanksc.com.et:8011/sms_wega/txn/{SHARE_ID}
 *   A JSON object for a known id. An unknown one is HTTP 200 with the body
 *   `Transaction not found in Daily or History` (text/plain when the client
 *   sends a wildcard Accept, application/json when it asks for JSON). No
 *   authentication and no
 *   cookie; the certificate is DigiCert for *.wegagenbanksc.com.et (verified
 *   2026-11-11, no -k). The service answers intermittently from a single
 *   network, so the base parser's two attempts apply.
 *
 * Response (one object per receipt; values here are made up):
 *   {"trnRefNo":"000SAMP260000000","txnAmount":160,"currency":"ETB",
 *    "trnDt":"2026-07-06T21:00:00.000Z","drCr":"D","trnCode":"FTD",
 *    "paymentMethod":"Account To Account Transfer","sender_name":"PAYER NAME",
 *    "receiver_name":"PAYEE NAME","sender_account":"1000000000001",
 *    "receiver_account":"2000000000009","accNo":"1000000000001"}
 *
 * Mapping:
 *   - `sender_account` / `receiver_account` are the two sides. Wegagen masks
 *     some of them itself, but not all, so every account (including `accNo`)
 *     is run through Wegagen's own masking rule, the `Ql` function in its
 *     public receipt app, before it reaches a field or `raw`. The literal
 *     "Not_required" and the "---" placeholders mean missing.
 *   - `trnDt` is UTC (it carries a trailing Z). Addis Ababa is UTC+3 all year,
 *     so the receipt date is the date 3 hours later. That is what Wegagen's
 *     own receipt page prints: its QR text uses `new Date(trnDt).toDateString()`
 *     in a browser set to Addis time.
 *   - `messageStatus` is the SMS delivery state ("0: Accepted for delivery"),
 *     not the transaction's state, and the record carries no transaction
 *     status, so `transactionStatus` is left unset rather than guessed.
 *   - `reference` is `trnRefNo`, the printed Reference No. It is a prefix of
 *     the share id the record was looked up by and can never equal it, so the
 *     shared gate treats the share id as an opaque token (core/gate.ts) and
 *     parseRecord checks the prefix instead.
 *   - `charge` and `vat` are not mapped. ParsedReceipt has no field that says
 *     only "fee", and serviceFeeVat would claim a service fee on the amount;
 *     both stay in `raw` instead.
 */
import { BaseParser } from "./base";
import type { ParsedReceipt } from "../core/types";
import type { Checked } from "../security/reference";
import { parseMoney } from "../core/money";

/** Share page host (the only host whose links are read). Port 8183. */
export const WEGAGEN_SHARE_HOST = "transinfo.wegagenbanksc.com.et";
/** JSON endpoint host cheki fetches (allowlisted via banks.json). Port 8011. */
export const WEGAGEN_API_HOST = `${WEGAGEN_SHARE_HOST}:8011`;
/** Path of the transaction lookup on the JSON endpoint. */
export const WEGAGEN_API_PATH = "/sms_wega/txn/";
/** Prefix of every Wegagen share link. */
export const WEGAGEN_SHARE_URL = `https://${WEGAGEN_SHARE_HOST}:8183/?id=`;

/** A share id: exactly 24 letters and digits. No ranges, no paths. */
const WEGAGEN_ID_RE = /^[A-Za-z0-9]{24}$/;

/** What the endpoint answers for a share id it has no record of. */
export const WEGAGEN_NOT_FOUND = "Transaction not found in Daily or History";

/** Fields of the raw record that may be kept in `raw` (no name, no phone). */
const RAW_SAFE_KEYS = [
  "trnRefNo",
  "txnAmount",
  "currency",
  "trnDt",
  "drCr",
  "trnCode",
  "paymentMethod",
  "narrative",
  "event",
  "messageStatus",
  "charge",
  "vat",
  "srNo",
  "module",
] as const;

/** Validate a Wegagen share id. Lowercase is accepted and sent in capitals. */
export function checkWegagenId(input: unknown): Checked<string> {
  if (typeof input !== "string") return { ok: false, message: "Wegagen share id must be text." };
  const id = input.trim();
  if (!id) return { ok: false, message: "Wegagen share id is required." };
  if (!WEGAGEN_ID_RE.test(id)) {
    return {
      ok: false,
      message:
        "A Wegagen share id is the 24 letters and digits after ?id= in the share link (transinfo.wegagenbanksc.com.et:8183/?id=...). It is not the 16-character Reference No printed on the receipt. Paste the whole share link, or just that 24-character id.",
    };
  }
  return { ok: true, value: id.toUpperCase() };
}

/** A non-blank string field; "---" and the literal "NULL" count as missing. */
function text(v: unknown): string | undefined {
  if (typeof v === "number" && Number.isFinite(v)) return String(v);
  if (typeof v !== "string") return undefined;
  const s = v.replace(/\s+/g, " ").trim();
  if (!s || s === "---" || s.toUpperCase() === "NULL") return undefined;
  return s;
}

/**
 * Wegagen's own account mask, copied from the `Ql` function in its public
 * receipt app (transinfo.wegagenbanksc.com.et, observed 2026-11-11): a 13
 * digit account keeps its first digit and last 7, a 12 character one keeps
 * the first 4 and last 2, a 10 character one the first 2 and last 2, and
 * anything else is returned as it came. Shorter or longer values therefore
 * keep their own length; that is the bank's rule, not a cheki choice.
 */
export function maskAccount(v: unknown): string {
  const s = typeof v === "string" ? v.trim() : "";
  if (!s) return "";
  if (s.length === 13) return `${s.substring(0, 1)}*****${s.substring(6, 13)}`;
  if (s.length === 12) return `${s.substring(0, 4)}*****${s.substring(10)}`;
  if (s.length === 10) return `${s.substring(0, 2)}*****${s.substring(8)}`;
  return s;
}

/** An account the record can name: masked, or undefined when it says none. */
function account(v: unknown): string | undefined {
  const s = typeof v === "string" ? v.trim() : "";
  if (!s || s === "Not_required") return undefined;
  const masked = maskAccount(s);
  return masked || undefined;
}

/**
 * The receipt date in Addis Ababa time. `trnDt` is an absolute instant (UTC,
 * observed with a trailing Z) and Addis is UTC+3 with no daylight saving, so
 * the local date is the calendar date of the instant 3 hours later. Anything
 * that is not a date is left out rather than guessed.
 */
function addisDate(v: unknown): string | undefined {
  if (typeof v !== "string") return undefined;
  const s = v.trim();
  if (!s) return undefined;
  // A value without an offset is treated as UTC, which is how the endpoint
  // has always sent it; an explicit offset is honoured as written.
  const ms = Date.parse(/(?:Z|[+-]\d{2}:?\d{2})$/.test(s) ? s : `${s}Z`);
  if (!Number.isFinite(ms)) return undefined;
  const d = new Date(ms + 3 * 3600_000);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())}`;
}

/** Redacted copy of the record for `raw`: no names, no phone, no full account. */
function safeRaw(row: Record<string, unknown>): string {
  const out: Record<string, unknown> = {};
  for (const k of RAW_SAFE_KEYS) if (k in row) out[k] = row[k];
  if ("accNo" in row) out.accNo = maskAccount(row.accNo) || null;
  return JSON.stringify(out).slice(0, 1000);
}

export class WegagenParser extends BaseParser {
  readonly bankId = "wegagen";
  readonly bankName = "Wegagen Bank";
  readonly responseType = "json" as const;
  readonly requiresAccount = false;
  readonly accountDigits?: number = undefined;
  readonly requiresPhone = false;

  normalizeReference(ref: string): Checked<string> {
    return checkWegagenId(ref);
  }

  buildUrl(ref: string): string {
    const id = checkWegagenId(ref);
    if (!id.ok) throw new Error(id.message);
    return `https://${WEGAGEN_API_HOST}${WEGAGEN_API_PATH}${id.value}`;
  }

  /** The public share page for an id (what `sourceUrl` points at). */
  static receiptPageUrl(id: string): string {
    return `${WEGAGEN_SHARE_URL}${encodeURIComponent(id)}`;
  }

  protected requestHeaders(): Record<string, string> {
    return { Accept: "application/json" };
  }

  /**
   * Read one record. `requestedId`, when given, must start with the record's
   * own `trnRefNo`: the share id is that reference plus three more fields, so
   * a record whose reference is not a prefix of the requested id is not the
   * answer for this receipt (the gate cannot do it: the two never compare
   * equal, which is why the share id is an opaque token there).
   */
  static parseRecord(data: string | Buffer, requestedId?: string): { parsed: ParsedReceipt; notFound: boolean } {
    const body = (typeof data === "string" ? data : data.toString("utf8")).trim();
    // Unknown id: HTTP 200 with a plain-text body (the same words come back
    // quoted or as application/json when the request asked for JSON).
    if (body.startsWith(WEGAGEN_NOT_FOUND) || body.startsWith(`"${WEGAGEN_NOT_FOUND}`)) {
      return { parsed: { verified: false }, notFound: true };
    }
    let row: unknown;
    try {
      row = JSON.parse(body);
    } catch {
      return { parsed: { verified: false }, notFound: false };
    }
    if (!row || typeof row !== "object" || Array.isArray(row)) return { parsed: { verified: false }, notFound: false };
    const r = row as Record<string, unknown>;

    const reference = text(r.trnRefNo);
    const requested = requestedId === undefined ? undefined : requestedId.trim().toUpperCase();
    if (!reference || (requested !== undefined && !requested.startsWith(reference.toUpperCase()))) {
      return { parsed: { verified: false, raw: safeRaw(r) }, notFound: false };
    }

    const parsed: ParsedReceipt = {
      verified: true,
      senderName: text(r.sender_name),
      senderAccount: account(r.sender_account),
      receiverName: text(r.receiver_name),
      receiverAccount: account(r.receiver_account),
      amount: parseMoney(text(r.txnAmount)),
      currency: text(r.currency) ?? "ETB",
      date: addisDate(r.trnDt),
      reference,
      transactionType: text(r.paymentMethod),
      raw: safeRaw(r),
    };
    // Drop the keys Wegagen did not fill, so no empty fields reach the API or the UI.
    for (const k of Object.keys(parsed) as (keyof ParsedReceipt)[]) {
      if (parsed[k] === undefined) delete parsed[k];
    }
    return { parsed, notFound: false };
  }

  parse(data: string | Buffer, _contentType: string): ParsedReceipt {
    return WegagenParser.parseRecord(data).parsed;
  }
}
