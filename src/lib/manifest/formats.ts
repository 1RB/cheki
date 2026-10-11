/**
 * Receipt formats: which of a bank's formats a given input belongs to.
 *
 * Each manifest bank lists its formats in order, current first. A bank switch
 * (new host, new reference shape) is a data edit in banks.json plus a parser;
 * nothing else in the app hard-codes which format comes first.
 *
 * Picking a format never costs a bank request. The format is chosen from the
 * shape of the input alone (refPattern + the fields supplied), so every
 * verification fetches exactly one format. There is no "try the current host,
 * then the legacy one" cascade: that would double the bank hits per receipt.
 * Pure and dependency-free, so the UI can use it as well as the verifier.
 */
import type { BankManifestEntry, BankRefPattern, ReceiptFormat, ReceiptFormatInputName } from "../core/types";

const compiled = new Map<string, RegExp | null>();

function compile(p: BankRefPattern | undefined): RegExp | null {
  if (!p) return null;
  const key = `${p.flags}/${p.source}`;
  if (!compiled.has(key)) {
    try {
      compiled.set(key, new RegExp(p.source, p.flags));
    } catch {
      compiled.set(key, null);
    }
  }
  return compiled.get(key) ?? null;
}

export function formatsOf(bank: Pick<BankManifestEntry, "formats"> | undefined): ReceiptFormat[] {
  return bank?.formats ?? [];
}

/** A format cheki can fetch: it has a parser and the bank has not retired it. */
export function isSupportedFormat(f: ReceiptFormat): boolean {
  return Boolean(f.parser) && f.status !== "deprecated";
}

/**
 * An input-only format (`via` set, no parser): a receipt QR that only names
 * the reference. It is checked through the `via` format and never fetched.
 */
export function isInputOnlyFormat(f: ReceiptFormat): boolean {
  return Boolean(f.via) && !f.parser;
}

/** The bank's input-only formats (e.g. Telebirr's receipt QR), in manifest order. */
export function inputOnlyFormats(bank: Pick<BankManifestEntry, "formats"> | undefined): ReceiptFormat[] {
  return formatsOf(bank).filter(isInputOnlyFormat);
}

/** cheki can check a receipt given in this format: directly, or through the format an input-only one resolves to. */
export function isCheckableFormat(bank: Pick<BankManifestEntry, "formats"> | undefined, f: ReceiptFormat): boolean {
  if (isSupportedFormat(f)) return true;
  if (!isInputOnlyFormat(f)) return false;
  const target = formatsOf(bank).find((x) => x.id === f.via);
  return Boolean(target && isSupportedFormat(target));
}

export function supportedFormats(bank: Pick<BankManifestEntry, "formats"> | undefined): ReceiptFormat[] {
  return formatsOf(bank).filter(isSupportedFormat);
}

/** The format to lead with: the first supported one (formats are ordered current first). */
export function primaryFormat(bank: Pick<BankManifestEntry, "formats"> | undefined): ReceiptFormat | undefined {
  return supportedFormats(bank)[0];
}

/**
 * Every receipt format except the primary one, in manifest order (legacy and
 * deprecated included). Input-only formats are not receipt formats of their
 * own, so they are left out (see inputOnlyFormats).
 */
export function secondaryFormats(bank: Pick<BankManifestEntry, "formats"> | undefined): ReceiptFormat[] {
  const primary = primaryFormat(bank);
  return formatsOf(bank).filter((f) => f !== primary && !isInputOnlyFormat(f));
}

export function formatNeeds(f: ReceiptFormat | undefined, name: ReceiptFormatInputName): boolean {
  return Boolean(f?.inputs.some((i) => i.name === name));
}

export function formatAccountDigits(f: ReceiptFormat | undefined): number | undefined {
  return f?.inputs.find((i) => i.name === "account")?.digits;
}

export function matchesFormat(f: ReceiptFormat, reference: string): boolean {
  const re = compile(f.refPattern);
  return re ? re.test(reference.trim()) : true;
}

export type FormatSelection =
  | { ok: true; format: ReceiptFormat | undefined }
  | { ok: false; format: ReceiptFormat; field: "accountNumber" | "phoneNumber"; message: string };

/**
 * Choose the format for a reference. Supported formats are tried in manifest
 * order (current first); the first whose pattern matches and whose required
 * fields are present wins. When the reference matches a format but a field is
 * missing (an FT reference without the account), the caller gets that
 * format's hint instead of a request to the wrong host. A reference that
 * matches no pattern goes to the primary format, whose parser then validates
 * it. Banks without formats return `format: undefined` (top-level fields).
 */
export function selectFormat(
  bank: Pick<BankManifestEntry, "formats"> | undefined,
  input: { reference: string; accountNumber?: string; phoneNumber?: string }
): FormatSelection {
  const usable = supportedFormats(bank);
  if (usable.length === 0) return { ok: true, format: undefined };
  const matching = usable.filter((f) => matchesFormat(f, input.reference));
  if (matching.length === 0) return { ok: true, format: usable[0] };
  const has = (f: ReceiptFormat) =>
    (!formatNeeds(f, "account") || Boolean(input.accountNumber?.trim())) &&
    (!formatNeeds(f, "phone") || Boolean(input.phoneNumber?.trim()));
  const ready = matching.find(has);
  if (ready) return { ok: true, format: ready };
  const f = matching[0];
  const field = formatNeeds(f, "account") && !input.accountNumber?.trim() ? "accountNumber" : "phoneNumber";
  const digits = formatAccountDigits(f);
  const message =
    f.missingHint ??
    (field === "accountNumber"
      ? `This receipt needs the receiving account number${digits ? ` (at least the last ${digits} digits)` : ""}.`
      : "This receipt needs the payer's phone number.");
  return { ok: false, format: f, field, message };
}

/** Hosts of a URL template ("{...}" placeholders are not valid in a hostname). */
export function templateHost(template: string | undefined): string | null {
  if (!template || !/^https:\/\//i.test(template)) return null;
  try {
    return new URL(template.replace(/\{[^}]*\}/g, "x")).host.toLowerCase();
  } catch {
    return null;
  }
}

/** Fill a format URL template. Values are URL-encoded; unknown placeholders stay. */
export function fillTemplate(template: string, values: { ref: string; account?: string; phone?: string }): string {
  return template
    .replace(/\{ref\}/g, encodeURIComponent(values.ref))
    .replace(/\{account\}/g, encodeURIComponent(values.account ?? ""))
    .replace(/\{phone\}/g, encodeURIComponent(values.phone ?? ""));
}
