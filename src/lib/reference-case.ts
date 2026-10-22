/**
 * Typed references: one canonical form per bank.
 *
 * People type references the way they read them: "ft26sample01", "DET 0SAMPLE",
 * "CHQ-0SAMPLE". Where a bank's reference is letters and digits only and the
 * bank prints it in capitals, cheki trims it, drops spaces and dashes, and
 * uppercases it before anything else reads it (format choice, validation, the
 * URL, the cache key, the receipt link a browser opens).
 *
 * Only the banks listed in CASE_RULES are touched. Everything else is trimmed
 * and nothing more, because its lookup key is case-sensitive or not a plain
 * reference:
 *   - CBE Receipt IDs (fHCx..., v2-...) are opaque mbreciept tokens. Only an
 *     older CBE FT reference is uppercased.
 *   - Awash share tokens are base36 txID + counter, read from the link.
 *   - eBirr white-label (Siinqee, Nib, Wegagen, Ahadu, Kaafi) {token} URL
 *     path segments are case-sensitive.
 *   - ZamZam receipt ids are digits; spaces are dropped, nothing else.
 *   - The Telebirr receipt QR payload is never passed through here: its CRC
 *     covers the raw characters. Only the transaction number read out of it is.
 *   - URLs are never changed. A link is parsed first and only the reference
 *     taken out of it comes through here.
 *
 * Pure and dependency-free, so the verifier, /api/receipt, the receipt cache
 * and the browser form all use the same rule.
 */

/** Spaces (incl. NBSP), zero-width characters and dashes people copy along with a reference. */
const SEPARATORS_RE = /[\s\u200B-\u200D\u2060\uFEFF\-\u2010-\u2015\u2212]/g;
const ALNUM_RE = /^[A-Za-z0-9]+$/;

interface CaseRule {
  /** The canonical shape, tested on the uppercased compact form. */
  shape: RegExp;
  /**
   * Only references that already have this shape (case-insensitively) are
   * changed. Used where a bank has a second, case-sensitive format (CBE).
   */
  only?: RegExp;
  /** Start of a real reference, for the hint ("like FT26…"). */
  example: string;
}

/**
 * Banks whose typed reference is letters and digits printed in capitals, so
 * lowercase input can only be a typing difference. Keys are manifest bank ids.
 * See the decision table in the PR that added this file (fix/reference-case).
 */
const CASE_RULES: Readonly<Record<string, CaseRule>> = Object.freeze({
  // Older CBE FT reference (core-banking id). Receipt IDs are left alone.
  cbe: { shape: /^FT[A-Z0-9]{8,12}$/, only: /^FT[A-Z0-9]{8,12}$/i, example: "FT26…" },
  // BOA: two letters then digits/letters (FT25SAMPLE06 for transfers).
  boa: { shape: /^[A-Z]{2}[A-Z0-9]{4,30}$/, example: "FT25…" },
  // Telebirr transaction number: 10 capitals and digits (DET…, CHQ…, DJA…).
  telebirr: { shape: /^[A-Z0-9]{10}$/, example: "DET0…" },
  // M-Pesa transaction id (the parser only accepts [A-Z0-9]{6,20}).
  mpesa: { shape: /^[A-Z0-9]{6,20}$/, example: "SE12…" },
  // Dashen FT Ref: 16 capitals and digits.
  dashen: { shape: /^[A-Z0-9]{16}$/, example: "B22W…" },
  // CBE Birr TID from the receipt link: 10 or 11 capitals and digits.
  cbebirr: { shape: /^[A-Z0-9]{10,11}$/, example: "DTS4…" },
});

/** Banks whose receipt id is digits only: spaces are dropped, there is no case. */
const DIGIT_BANKS = new Set(["zamzam"]);

/** The manifest id a UI or API code maps to for these rules ("cbe-new" is CBE's current format). */
function ruleKey(bank: string | undefined | null): string {
  const id = String(bank ?? "").trim().toLowerCase();
  return id === "cbe-new" ? "cbe" : id;
}

/** True when cheki uppercases this bank's typed references. */
export function isCaseInsensitiveBank(bank: string | undefined | null): boolean {
  return Object.hasOwn(CASE_RULES, ruleKey(bank));
}

/** Banks cheki uppercases references for (manifest ids). */
export const CASE_INSENSITIVE_BANKS: readonly string[] = Object.freeze(Object.keys(CASE_RULES));

function compact(value: string): string {
  return value.replace(SEPARATORS_RE, "");
}

export interface CanonicalOptions {
  /**
   * Drop spaces and dashes inside the reference (typed input). Off for a
   * reference read out of a receipt link or QR: the bank wrote it, so a
   * separator in it is not a typing habit and the validators must see it.
   */
  compact?: boolean;
}

/**
 * The canonical form of a typed or extracted reference for `bank`.
 *
 * Always trimmed. For a case-insensitive bank:
 *   - typed input (`compact`, the default) that only differs from the bank's
 *     shape by case, spaces or dashes is compacted and uppercased
 *     ("ft26 sample01" -> "FT26SAMPLE01");
 *   - otherwise a value of letters and digits only is uppercased, nothing
 *     more ("det0sampl" -> "DET0SAMPL", which the bank then reports as not
 *     found).
 * Anything else (a URL, a path, a token with other characters, "a b") comes
 * back trimmed and unchanged, so the validators still see it and give their
 * own error. ZamZam ids lose spaces between digit groups.
 */
export function canonicalReference(bank: string | undefined | null, reference: string, opts: CanonicalOptions = {}): string {
  if (typeof reference !== "string") return reference;
  const trimmed = reference.trim();
  if (!trimmed) return trimmed;
  const key = ruleKey(bank);
  const doCompact = opts.compact !== false;
  if (DIGIT_BANKS.has(key)) {
    if (!doCompact) return trimmed;
    const c = compact(trimmed);
    return /^\d+$/.test(c) ? c : trimmed;
  }
  const rule = Object.hasOwn(CASE_RULES, key) ? CASE_RULES[key] : undefined;
  if (!rule) return trimmed;
  if (doCompact) {
    const c = compact(trimmed).toUpperCase();
    if (c !== trimmed.toUpperCase() && rule.shape.test(c)) return c;
  }
  if (!ALNUM_RE.test(trimmed)) return trimmed;
  if (rule.only && !rule.only.test(trimmed)) return trimmed;
  return trimmed.toUpperCase();
}

/**
 * Whether a "not found" (or a rejected reference) deserves the hint that
 * references are capitals and digits: the user typed lowercase letters,
 * spaces or dashes, or the reference does not have the bank's usual shape.
 * Only for case-insensitive banks and typed text (never a link or a QR).
 */
export function referenceLooksOff(bank: string | undefined | null, typed: string | undefined | null): boolean {
  const key = ruleKey(bank);
  const rule = Object.hasOwn(CASE_RULES, key) ? CASE_RULES[key] : undefined;
  if (!rule || typeof typed !== "string") return false;
  const trimmed = typed.trim();
  if (!trimmed || /^[a-z][a-z0-9+.-]*:/i.test(trimmed) || trimmed.includes("/")) return false;
  const c = compact(trimmed);
  // A CBE Receipt ID is mixed case by design: no hint for it.
  if (rule.only && !rule.only.test(c)) return false;
  if (/[a-z]/.test(trimmed) || c !== trimmed) return true;
  return !rule.shape.test(c);
}

/** The start of a real reference for the hint ("FT26…"), or undefined. */
export function referenceExample(bank: string | undefined | null): string | undefined {
  const key = ruleKey(bank);
  return Object.hasOwn(CASE_RULES, key) ? CASE_RULES[key].example : undefined;
}
