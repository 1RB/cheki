/**
 * Input resolution for the verifier, as one pure classification.
 *
 * A request carries a QR payload, a receipt link or a reference, and the
 * verifier needs to know which before it touches a bank. This used to be a
 * recursive `resolve(request, depth, fromLink)`: each QR kind re-entered
 * `resolve` with a rewritten request, guarded by a `depth > 2` counter that
 * no input could reach, with `fromLink` threaded through as a loose boolean.
 * Here the same rules are two plain stages and one result type:
 *
 *   QR stage         qrData  -> a reference request, a BOA QR, or an error
 *   reference stage  request -> a (bank, reference, account, phone, fromLink)
 *                               target, or an error
 *
 * The QR stage only ever hands over to the reference stage, never to itself,
 * so there is no recursion and no depth to count. No I/O: the verifier does
 * the fetching after this has decided what to fetch.
 */
import type { ChekiError, VerifyRequest } from "./types";
import { detectBankFromUrl, isUrl, looksLikeUrl } from "../adapters/url-detector";
import { parseTelebirrQr } from "../qr/telebirr";
import { parseDashenQr } from "../qr/dashen";

export const MAX_QR_LENGTH = 4096;

/** What the verifier looks up: one reference at one bank. */
export interface ReferenceTarget {
  bank?: string;
  reference: string;
  accountNumber?: string;
  phoneNumber?: string;
  /**
   * The reference was read out of a receipt link or a QR: it is
   * case-normalised but never compacted (see canonicalReference).
   */
  fromLink: boolean;
}

export type ResolvedInput =
  | { kind: "reference"; target: ReferenceTarget }
  /** A BOA QR: decrypted and looked up by the verifier (verifyBoaQr). */
  | { kind: "boaQr"; qrData: string }
  | { kind: "invalid"; error: ChekiError };

function asOptionalString(v: unknown): string | undefined {
  return typeof v === "string" ? v : undefined;
}

const invalid = (field: string, message: string): ResolvedInput => ({ kind: "invalid", error: { kind: "MISSING_INPUT", field, message } });

/** A QR that names its own bank, checked with another bank named. */
function otherBank(named: string | undefined, own: string, label: string): ResolvedInput | null {
  const n = (named || "").trim().toLowerCase();
  return n && n !== own ? invalid("qrData", `This QR code is from a ${label} receipt. Check it with bank "${own}".`) : null;
}

/**
 * The reference stage: a typed reference or a receipt link becomes the
 * target to look up. Links are only used to extract their parts; the bank URL
 * is always rebuilt from a fixed host later.
 */
export function resolveReference(
  request: { bank?: unknown; reference?: unknown; accountNumber?: unknown; phoneNumber?: unknown },
  fromLink = false
): ResolvedInput {
  const bank = asOptionalString(request.bank);
  const reference = asOptionalString(request.reference)?.trim();
  const accountNumber = asOptionalString(request.accountNumber)?.trim() || undefined;
  const phoneNumber = asOptionalString(request.phoneNumber)?.trim() || undefined;

  if (!reference) return invalid("reference", "Reference number, receipt URL, or QR data is required.");

  // Receipt links. Anything with URL syntax must be a proper http(s) link
  // to a known bank host; "http:/x", "http:evil.com", "//x" are rejected.
  if (looksLikeUrl(reference)) {
    const detected = isUrl(reference) ? detectBankFromUrl(reference) : null;
    if (!detected) return invalid("reference", "Could not detect bank from URL. Please paste the reference number manually.");
    return {
      kind: "reference",
      target: {
        bank: detected.bank,
        reference: detected.reference,
        accountNumber: accountNumber || detected.accountNumber || undefined,
        phoneNumber: phoneNumber || detected.phoneNumber || undefined,
        fromLink: true,
      },
    };
  }

  return { kind: "reference", target: { bank, reference, accountNumber, phoneNumber, fromLink } };
}

/** Classify a verify request. A non-empty `qrData` wins over `reference`. */
export function resolveInput(request: VerifyRequest): ResolvedInput {
  const qrData = asOptionalString(request.qrData)?.trim();
  if (!qrData) return resolveReference(request);

  const bank = asOptionalString(request.bank);
  const accountNumber = asOptionalString(request.accountNumber)?.trim() || undefined;
  const phoneNumber = asOptionalString(request.phoneNumber)?.trim() || undefined;

  if (qrData.length > MAX_QR_LENGTH) return invalid("qrData", "QR data is too long.");

  // A Telebirr receipt QR (CRC-checked, so it can't be mistaken for a BOA
  // ciphertext). Only the transaction number inside is used.
  const telebirr = parseTelebirrQr(qrData);
  if (telebirr.ok) return otherBank(bank, "telebirr", "Telebirr") ?? resolveReference({ bank: "telebirr", reference: telebirr.reference }, true);

  // A Dashen Super App receipt QR: the FT Ref XOR a fixed key. The endpoint
  // refuses the raw token (HTTP 401), so the reference must be decoded
  // before any URL is built. The prefix is unambiguous, so it is matched
  // before the BOA and URL branches below.
  const dashen = parseDashenQr(qrData);
  if (dashen.ok) return otherBank(bank, "dashen", "Dashen") ?? resolveReference({ bank: "dashen", reference: dashen.reference }, true);

  if ((bank || "").toLowerCase() === "boa") return { kind: "boaQr", qrData };

  if (looksLikeUrl(qrData)) {
    // Only a receipt link cheki recognises. An unknown URL is rejected,
    // never fetched or used as a reference.
    const detected = isUrl(qrData) ? detectBankFromUrl(qrData) : null;
    if (!detected) return invalid("qrData", "This QR code is not a receipt link cheki recognises.");
    // A CBE Birr receipt QR is its own receipt link: the receipt number and
    // the payer phone it was issued for (TID + PH). Like a Telebirr QR it
    // names its bank, and the pair in it wins over a typed phone, since CBE
    // Birr only answers for the pair that belongs together.
    if (detected.bank === "cbebirr") {
      return (
        otherBank(bank, "cbebirr", "CBE Birr") ??
        resolveReference({ bank: "cbebirr", reference: detected.reference, phoneNumber: detected.phoneNumber ?? phoneNumber }, true)
      );
    }
    return resolveReference({ bank: bank ?? "", reference: qrData, accountNumber, phoneNumber });
  }

  // Plain reference inside the QR, for the bank the caller named.
  return resolveReference({ bank: bank ?? "", reference: qrData, accountNumber, phoneNumber }, true);
}
