/**
 * ZamZam Bank parser.
 *
 * Receipt link (what people share): https://receipt.zamzambank.com.et/receipt/{id}
 *   {id} is a numeric receipt id (8 digits on the receipts seen so far). The
 *   page is a React single-page app with no receipt data in its HTML.
 * Data endpoint (what cheki fetches):
 *   https://receipt-backend.zamzambank.com.et/api/v1/invoice/{id}
 *   JSON object for a known id, HTTP 200 with the body `null` for an unknown
 *   one, HTTP 401 without the Authorization header below.
 *
 * Authorization:
 *   The endpoint expects HTTP Basic auth. The credential is hardcoded in
 *   ZamZam's own public receipt web app
 *   (receipt.zamzambank.com.et/assets/index-*.js), which every visitor's
 *   browser downloads and sends, so it identifies the receipt app, not a
 *   person, and grants nothing beyond what the public receipt page shows.
 *   Same precedent as BOA's QR key (parsers/boa.ts). It is sent as a request
 *   header only: never in a URL, a response, the cache or `sourceUrl` (which
 *   is the public receipt page link).
 *
 * Response (one object per receipt; values here are made up):
 *   {"name":"JOHN DOE TEST","reference":"000TEST00000001","id":12345678,
 *    "amount":"50","vat":"0.75","dt":"2026-08-26 00:00:00",
 *    "acc_NUM":"0012345670101","drcr":"D","other_NAME":"NULL",
 *    "trn_DESCRIPTION":"TELE BIRR OUT GOING","deposited_BY":null,
 *    "currency":"ETB","code":"TBO","check":null,"parameter":"NULL"}
 *
 * Mapping (party sides are INFERRED, not documented by ZamZam):
 *   - `name` / `acc_NUM` are the ZamZam account holder. `drcr` is the
 *     debit/credit flag from that account's point of view: on "D" (debit) the
 *     holder paid, so they are the sender; on "C" (credit) they received, so
 *     they are the receiver. `other_NAME`, when present, is the counterparty
 *     on the other side. Any other `drcr` value leaves the holder's side
 *     unknown and the receipt is not confirmed (no party).
 *   - `acc_NUM` is the FULL, unmasked account number. It is masked here
 *     (first digit and last 4, like CBE's 1****1234) before it reaches any
 *     field, and the full number is kept out of `raw` as well.
 *   - `dt` carries a date only (time is always 00:00:00), so only the date is
 *     returned.
 *   - The literal string "NULL" (other_NAME, parameter) means missing.
 *   - `vat` is not mapped. It may be VAT on a fee rather than on the amount
 *     (0.75 on a 50 ETB Telebirr transfer), and ParsedReceipt has no field that
 *     says only "VAT"; serviceFeeVat would claim a service fee nobody returned.
 *   - `reference` is ZamZam's transaction reference. It differs from the
 *     receipt id the record is looked up by, so the shared gate treats the id
 *     as an opaque lookup key (core/gate.ts) and parseRecord checks instead
 *     that the record's own `id` equals the id requested.
 *
 * The ids are sequential. cheki only accepts one id (or one link) per check,
 * never a range, and the per-IP rate limits apply as for every bank.
 */
import { BaseParser } from "./base";
import type { ParsedReceipt } from "../core/types";
import type { Checked } from "../security/reference";
import { parseMoney } from "../core/money";

/** Host of the public receipt page (the only host whose links are read). */
export const ZAMZAM_RECEIPT_HOST = "receipt.zamzambank.com.et";
/** Host of the JSON endpoint cheki fetches (allowlisted via banks.json). */
export const ZAMZAM_API_HOST = "receipt-backend.zamzambank.com.et";

/**
 * Basic credential from ZamZam's public receipt web app bundle
 * (receipt.zamzambank.com.et/assets/index-*.js, observed 2026-10-12):
 * base64("zzbmob:zzb@12#2024"). Public by construction; see the header.
 */
const ZAMZAM_BASIC_CREDENTIAL = Buffer.from("zzbmob:zzb@12#2024", "utf8").toString("base64");

/** A receipt id: digits only, at most 12 (8 observed). No ranges, no paths. */
const ZAMZAM_ID_RE = /^\d{1,12}$/;

/** Fields of the raw record that may be kept in `raw` (no account number, no names). */
const RAW_SAFE_KEYS = ["id", "reference", "amount", "vat", "dt", "drcr", "currency", "code", "trn_DESCRIPTION"] as const;

/** Validate a ZamZam receipt id. */
export function checkZamzamId(input: unknown): Checked<string> {
  if (typeof input !== "string") return { ok: false, message: "Receipt id must be text." };
  const id = input.trim();
  if (!id) return { ok: false, message: "Receipt id is required." };
  if (!ZAMZAM_ID_RE.test(id)) {
    return {
      ok: false,
      message: "A ZamZam receipt id is the number at the end of the receipt link (digits only). Paste the full receipt.zamzambank.com.et link or just that number.",
    };
  }
  // ZamZam's ids are integers: "012345678" is record 12345678.
  return { ok: true, value: id.replace(/^0+(?=\d)/, "") };
}

/** A non-blank string field; the literal "NULL" (and "null") counts as missing. */
function text(v: unknown): string | undefined {
  if (typeof v === "number" && Number.isFinite(v)) return String(v);
  if (typeof v !== "string") return undefined;
  const s = v.trim();
  if (!s || s.toUpperCase() === "NULL") return undefined;
  return s;
}

/**
 * Mask an account number: the first digit and the last 4 stay, every other
 * character becomes "*" (0012345670101 → 0********0101). Numbers too short to
 * mask meaningfully (5 characters or fewer) are fully starred.
 */
export function maskAccount(v: unknown): string | undefined {
  const s = text(v)?.replace(/\s+/g, "");
  if (!s) return undefined;
  if (s.length <= 5) return "*".repeat(s.length);
  return `${s[0]}${"*".repeat(s.length - 5)}${s.slice(-4)}`;
}

/** "2026-08-26 00:00:00" → "2026-08-26". Anything else is returned as ZamZam wrote it. */
function dateOnly(v: unknown): string | undefined {
  const s = text(v);
  if (!s) return undefined;
  const m = /^(\d{4}-\d{2}-\d{2})(?:[ T]00:00(?::00(?:\.0+)?)?)?$/.exec(s);
  return m ? m[1] : s;
}

/** Redacted copy of the record for `raw`: no names, no account number. */
function safeRaw(row: Record<string, unknown>): string {
  const out: Record<string, unknown> = {};
  for (const k of RAW_SAFE_KEYS) if (k in row) out[k] = row[k];
  if ("acc_NUM" in row) out.acc_NUM = maskAccount(row.acc_NUM) ?? null;
  return JSON.stringify(out).slice(0, 1000);
}

export class ZamZamParser extends BaseParser {
  readonly bankId = "zamzam";
  readonly bankName = "ZamZam Bank";
  readonly responseType = "json" as const;
  readonly requiresAccount = false;
  readonly accountDigits?: number = undefined;
  readonly requiresPhone = false;

  normalizeReference(ref: string): Checked<string> {
    return checkZamzamId(ref);
  }

  buildUrl(ref: string): string {
    const id = checkZamzamId(ref);
    if (!id.ok) throw new Error(id.message);
    return `https://${ZAMZAM_API_HOST}/api/v1/invoice/${id.value}`;
  }

  /** The public receipt page for an id (what `sourceUrl` points at). */
  static receiptPageUrl(id: string): string {
    return `https://${ZAMZAM_RECEIPT_HOST}/receipt/${encodeURIComponent(id)}`;
  }

  protected requestHeaders(): Record<string, string> {
    return { Accept: "application/json", Authorization: `Basic ${ZAMZAM_BASIC_CREDENTIAL}` };
  }

  /**
   * Read one record. `requestedId`, when given, must equal the record's own
   * `id`: the record is looked up by that id, so a different id means the
   * answer is not for this receipt.
   */
  static parseRecord(data: string | Buffer, requestedId?: string): { parsed: ParsedReceipt; notFound: boolean } {
    const body = (typeof data === "string" ? data : data.toString("utf8")).trim();
    let row: unknown;
    try {
      row = JSON.parse(body);
    } catch {
      return { parsed: { verified: false }, notFound: false };
    }
    // Unknown id: HTTP 200 with the body `null`.
    if (row === null) return { parsed: { verified: false }, notFound: true };
    if (!row || typeof row !== "object" || Array.isArray(row)) return { parsed: { verified: false }, notFound: false };
    const r = row as Record<string, unknown>;

    const recordId = text(r.id);
    if (!recordId || (requestedId !== undefined && recordId !== requestedId.trim())) {
      return { parsed: { verified: false, raw: safeRaw(r) }, notFound: false };
    }

    const holder = { name: text(r.name), account: maskAccount(r.acc_NUM) };
    const other = text(r.other_NAME);
    const side = text(r.drcr)?.toUpperCase();
    const sender = side === "D" ? holder : side === "C" ? { name: other, account: undefined } : undefined;
    const receiver = side === "C" ? holder : side === "D" ? { name: other, account: undefined } : undefined;

    const parsed: ParsedReceipt = {
      verified: true,
      senderName: sender?.name,
      senderAccount: sender?.account,
      receiverName: receiver?.name,
      receiverAccount: receiver?.account,
      amount: parseMoney(text(r.amount)),
      currency: text(r.currency) ?? "ETB",
      date: dateOnly(r.dt),
      reference: text(r.reference),
      transactionType: text(r.trn_DESCRIPTION),
      raw: safeRaw(r),
    };
    // Drop the keys ZamZam did not fill, so no empty fields reach the API or the UI.
    for (const k of Object.keys(parsed) as (keyof ParsedReceipt)[]) {
      if (parsed[k] === undefined) delete parsed[k];
    }
    return { parsed, notFound: false };
  }

  parse(data: string | Buffer, _contentType: string): ParsedReceipt {
    return ZamZamParser.parseRecord(data).parsed;
  }
}
