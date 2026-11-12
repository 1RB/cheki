/**
 * Wegagen Bank receipt QR (the QR printed on the receipt's detail page).
 *
 * The QR is an INPUT, never proof of payment. It is Wegagen's own prose line
 * with a share link inside it, for example:
 *
 *   Amount ETB-160.00 is Transferred From : PAYER NAME ... For more
 *   information, click here: https://transinfo.wegagenbanksc.com.et:8183/?id=000SAMPSAMPLE1000001DFTD
 *   - Wegagen Bank.
 *
 * Only the share id after `?id=` is read out of it. The names, the accounts
 * and the amount in the same text are ignored: they are what the QR happens
 * to carry, not what cheki checks. Whoever holds the receipt can make a QR,
 * so a decoded QR only tells cheki which receipt to look up; Wegagen's own
 * endpoint decides the verdict, exactly as if the id had been pasted.
 *
 * Defensive by construction: a size cap before any regex (the real text is
 * about 400 characters), a single anchored capture, never throws, and it
 * rejects anything that is not exactly one well-formed share id.
 */

/** Longest QR text considered at all. */
export const WEGAGEN_QR_MAX_INPUT = 4096;

/**
 * The share link inside the QR text. The port is optional: the receipt app
 * prints `:8183`, and a link without it still points at the same host. The id
 * must be exactly 24 characters, so a 25th does not silently truncate.
 */
const SHARE_LINK_RE = /https:\/\/transinfo\.wegagenbanksc\.com\.et(?::\d{1,5})?\/\?id=([A-Za-z0-9]{24})(?![A-Za-z0-9])/;

export type WegagenQrFailure = "notText" | "empty" | "tooLong" | "noLink" | "badId";

export type WegagenQrResult =
  | { ok: true; shareId: string }
  | { ok: false; reason: WegagenQrFailure };

const fail = (reason: WegagenQrFailure): WegagenQrResult => ({ ok: false, reason });

/**
 * Read the share id out of a Wegagen receipt QR. Never throws.
 * A success only means a well-formed share link was found: it is not a
 * verification, and nothing else in the text is used.
 */
export function parseWegagenQr(input: unknown): WegagenQrResult {
  if (typeof input !== "string") return fail("notText");
  if (input.length > WEGAGEN_QR_MAX_INPUT * 4) return fail("tooLong");
  const text = input.trim();
  if (!text) return fail("empty");
  if (text.length > WEGAGEN_QR_MAX_INPUT) return fail("tooLong");

  const m = text.match(SHARE_LINK_RE);
  if (!m) return fail("noLink");
  const shareId = m[1];
  if (!/^[A-Za-z0-9]{24}$/.test(shareId)) return fail("badId");
  // The endpoint answers with the full record only for the id in capitals
  // (lowercase comes back without the party fields), so the canonical form
  // is what gets looked up.
  return { ok: true, shareId: shareId.toUpperCase() };
}

/** True when the text carries a well-formed Wegagen share link. */
export function isWegagenQrPayload(input: unknown): boolean {
  return parseWegagenQr(input).ok;
}
