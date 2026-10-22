/**
 * Live detection for the smart input: what was pasted, which bank, which of
 * its receipt formats, and which extra field (if any) that format needs.
 *
 * Pure and synchronous. It never makes a request: the format is chosen from
 * the shape of the input alone, the same rule the verifier uses
 * (src/lib/manifest/formats.ts).
 */
import manifestData from "@/lib/manifest/banks.json";
import { banks, type Bank } from "@/lib/banks";
import { detectBankFromUrl, isUrl } from "@/lib/adapters/url-detector";
import { formatAccountDigits, formatNeeds, matchesFormat, primaryFormat, supportedFormats } from "@/lib/manifest/formats";
import type { ReceiptFormat } from "@/lib/core/types";
import { isBoaQrPayload } from "@/lib/qr/decode";
import { parseTelebirrQr } from "@/lib/qr/telebirr";
import { canonicalReference } from "@/lib/reference-case";

/**
 * "telebirrQr": a Telebirr receipt QR payload. Only its transaction number is
 * used (as `value`); it is then checked exactly like a typed reference.
 */
export type InputKind = "empty" | "url" | "unknownUrl" | "reference" | "boaQr" | "telebirrQr";

export interface Detection {
  kind: InputKind;
  /**
   * The trimmed input. For a typed reference: the bank's canonical form of it
   * ("ft26sample01" -> "FT26SAMPLE01", see src/lib/reference-case.ts). For a
   * Telebirr receipt QR: the transaction number read out of it.
   */
  value: string;
  /** The bank the check will go to (locked, chosen, or detected). */
  bank?: Bank;
  /** Every live bank whose reference pattern matches, for an ambiguous reference. */
  candidates: Bank[];
  /** True when the user picked the bank instead of it being detected. */
  overridden: boolean;
  /** Reference read out of a receipt link. */
  urlReference?: string;
  format?: ReceiptFormat;
  /** The input matches an older format than the bank's current one (e.g. a CBE FT reference). */
  olderFormat: boolean;
  needsAccount: boolean;
  needsPhone: boolean;
  accountDigits?: number;
  /** The bank's receipt host only answers Ethiopian networks: check from the browser first. */
  browserFirst: boolean;
  /** Manifest `beta` flag (M-Pesa until a real receipt confirms the parser; ZamZam until more receipt shapes are seen). */
  beta: boolean;
  betaNote?: string;
}

export const liveBanks: Bank[] = banks.filter((b) => b.status === "live");

type BetaFields = { id: string; beta?: unknown; betaNote?: unknown };
/**
 * Read `beta` defensively: the flag arrives with PR #34 and may not exist in
 * this manifest yet, and `Bank` may or may not carry it.
 */
export function betaInfo(bank: Bank | undefined): { beta: boolean; note?: string } {
  if (!bank) return { beta: false };
  const fromBank = bank as Bank & { beta?: unknown; betaNote?: unknown };
  const fromManifest = (manifestData as BetaFields[]).find((b) => b.id === bank.code);
  const beta = fromBank.beta === true || fromManifest?.beta === true;
  const note = [fromBank.betaNote, fromManifest?.betaNote].find((n): n is string => typeof n === "string" && n.length > 0);
  return { beta, note: beta ? note : undefined };
}

function bankByCode(code: string | undefined | null): Bank | undefined {
  if (!code) return undefined;
  const c = code === "cbe-new" ? "cbe" : code;
  return liveBanks.find((b) => b.code === c);
}

export function referenceCandidates(ref: string): Bank[] {
  const upper = ref.trim().toUpperCase();
  if (!upper) return [];
  return liveBanks.filter((b) => {
    try {
      return b.refPattern ? b.refPattern.test(upper) : false;
    } catch {
      return false;
    }
  });
}

export function detectInput(raw: string, opts: { lockedBank?: string; overrideBank?: string } = {}): Detection {
  const value = raw.trim();
  const locked = bankByCode(opts.lockedBank);
  const chosen = locked ?? bankByCode(opts.overrideBank);
  const base: Detection = {
    kind: "empty",
    value,
    bank: chosen,
    candidates: [],
    overridden: Boolean(!locked && chosen),
    olderFormat: false,
    needsAccount: false,
    needsPhone: false,
    browserFirst: false,
    beta: false,
  };

  const finish = (d: Detection): Detection => {
    const b = betaInfo(d.bank);
    return { ...d, beta: b.beta, betaNote: b.note, browserFirst: Boolean(d.bank?.geoBlocked) && d.kind !== "empty" && d.kind !== "unknownUrl" };
  };

  if (!value) return finish(base);

  // Telebirr receipt QR before BOA: its CRC-checked structure cannot match a
  // BOA ciphertext, while a Telebirr payload can be a multiple of 16 bytes.
  // Like a link, the QR names its own bank, so a locked page reports it
  // instead of sending the transaction number to another bank.
  const telebirrQr = parseTelebirrQr(value);
  if (telebirrQr.ok) {
    const telebirr = bankByCode("telebirr");
    if (telebirr) {
      return finish({
        ...base,
        kind: "telebirrQr",
        value: telebirrQr.reference,
        bank: telebirr,
        candidates: [telebirr],
        overridden: false,
        format: primaryFormat(telebirr),
        needsAccount: false,
        needsPhone: false,
      });
    }
  }

  if (isBoaQrPayload(value)) {
    const boa = bankByCode("boa");
    return finish({ ...base, kind: "boaQr", bank: locked ?? boa, candidates: boa ? [boa] : [], overridden: false });
  }

  if (isUrl(value)) {
    const hit = detectBankFromUrl(value);
    const fromUrl = bankByCode(hit?.bank);
    if (!hit || !fromUrl) return finish({ ...base, kind: "unknownUrl" });
    // A link names its own bank, so the chooser does not override it. On a
    // locked bank page a link for another bank is reported, not re-routed.
    const bank = fromUrl;
    const primary = primaryFormat(bank);
    const format = (hit.reference ? supportedFormats(bank).find((f) => matchesFormat(f, hit.reference)) : undefined) ?? primary;
    // A full link usually carries the account suffix or token. A BOA slip
    // link without the 5-digit suffix (trx={reference} only) does not, so
    // the account field opens instead of sending a check that must fail.
    const linkNeedsAccount = Boolean(format && formatNeeds(format, "account") && !hit.accountNumber);
    // A CBE Birr link or QR carries the payer phone (PH); one without it
    // opens the phone field instead of sending a check that must fail.
    const linkNeedsPhone = !linkNeedsAccount && Boolean(format && formatNeeds(format, "phone") && !hit.phoneNumber);
    return finish({
      ...base,
      kind: "url",
      bank,
      overridden: false,
      candidates: [bank],
      urlReference: hit.reference,
      format,
      olderFormat: Boolean(format && primary && format !== primary),
      needsAccount: linkNeedsAccount,
      needsPhone: linkNeedsPhone,
      ...(linkNeedsAccount ? { accountDigits: formatAccountDigits(format) ?? bank.accountDigits } : {}),
    });
  }

  const candidates = referenceCandidates(value);
  const bank = chosen ?? candidates[0];
  if (!bank) return finish({ ...base, kind: "reference", candidates });
  // The form of the reference the bank prints (and cheki sends): capitals,
  // no spaces or dashes, for banks whose references are uppercase-only.
  const reference = canonicalReference(bank.code, value);
  const primary = primaryFormat(bank);
  const format = supportedFormats(bank).find((f) => matchesFormat(f, reference)) ?? primary;
  const needsAccount = format ? formatNeeds(format, "account") : bank.requiresAccount;
  const needsPhone = format ? formatNeeds(format, "phone") : Boolean(bank.requiresPhone);
  return finish({
    ...base,
    kind: "reference",
    value: reference,
    bank,
    candidates,
    format,
    olderFormat: Boolean(format && primary && format !== primary),
    needsAccount,
    needsPhone,
    accountDigits: formatAccountDigits(format) ?? bank.accountDigits,
  });
}

/**
 * Whether the field should be rewritten to the reference as the bank prints
 * it. Only for a typed reference whose bank was chosen (locked page or the
 * chooser), or for input that is not mixed case: a detected bank can be wrong
 * for a mixed-case token (a CBE Receipt ID that starts like a Telebirr
 * number), and rewriting the field would lose the user's casing.
 */
export function shouldShowCanonical(d: Pick<Detection, "kind" | "value" | "overridden">, typed: string, locked: boolean): boolean {
  const raw = typed.trim();
  if (d.kind !== "reference" || !d.value || d.value === raw) return false;
  const mixedCase = /[a-z]/.test(raw) && /[A-Z]/.test(raw);
  return locked || d.overridden || !mixedCase;
}

/**
 * Banks whose account suffix is not always the receiving account. BOA looks a
 * receipt up by one account's last 5 digits, and on a fee receipt with no
 * receiver that is the source account. The field is labelled "account on the
 * receipt" there instead of "receiving account".
 */
const ACCOUNT_ON_RECEIPT_BANKS = new Set(["boa"]);

/** i18n keys for the account field's label and its "too short" error. */
export function accountFieldKeys(d: Pick<Detection, "bank">): { label: string; missing: string } {
  return d.bank && ACCOUNT_ON_RECEIPT_BANKS.has(d.bank.code)
    ? { label: "verify.extra.accountOnReceipt", missing: "verify.extra.accountOnReceiptMissing" }
    : { label: "verify.extra.account", missing: "verify.extra.accountMissing" };
}

/** What the extra field must hold before a check can go out, or null when it is fine. */
export function extraFieldProblem(d: Detection, extra: string): "phone" | "account" | null {
  const digits = extra.replace(/\D/g, "");
  if (d.needsPhone && !/^(251|0)?[79]\d{8}$/.test(digits)) return "phone";
  if (d.needsAccount && digits.length < (d.accountDigits ?? 5)) return "account";
  return null;
}

/** The bank's own receipt page for a geo-blocked bank, opened from the user's browser. */
export function browserReceiptUrl(d: Detection): string | undefined {
  if (!d.bank || !d.browserFirst) return undefined;
  if (d.kind === "url" && /^https:\/\//i.test(d.value)) return d.value;
  const ref = encodeURIComponent(d.value);
  if (d.bank.code === "telebirr") return `https://transactioninfo.ethiotelecom.et/receipt/${ref}`;
  if (d.bank.code === "mpesa") return `https://m-pesabusiness.safaricom.et/api/receipt/getReceipt?trxNo=${ref}`;
  return undefined;
}
