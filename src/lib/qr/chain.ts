/**
 * Which receipt QR a payload is, and what to check from it: the one place
 * that tries the formats, in the order every caller has to try them.
 *
 * The order is the whole point. A Telebirr payload is CRC-checked, so it
 * cannot be a BOA ciphertext (a Telebirr payload can be a multiple of 16
 * bytes); Dashen's and Wegagen's shapes are unambiguous, so they are matched
 * before the BOA and link branches. Every caller reads a payload through
 * here (the input detector, the verifier's qrData branch, the panel's paste
 * and camera handling, the image OCR), so a new QR format is added once and
 * cannot be recognised in one place and missed in another.
 *
 * A receipt link inside a QR is not a QR format: it is read by
 * src/lib/reference-input.ts, which every caller reaches after this chain
 * says "not a QR". Likewise a bare Wegagen share link is a link, not a QR.
 */
import { isUrl } from "../adapters/url-detector";
import { isBoaQrPayload } from "./decode";
import { parseDashenQr } from "./dashen";
import { parseTelebirrQr } from "./telebirr";
import { parseWegagenQr } from "./wegagen";

/** The QR formats this chain recognises, in the order they are tried. */
export type QrFormat = "telebirr" | "dashen" | "wegagen" | "boa";

/**
 * What a payload is. The three named formats carry the reference to check
 * (a Telebirr transaction number, a Dashen FT Ref, a Wegagen share id); a BOA
 * payload is ciphertext that only the BOA branch can decrypt, so it carries
 * nothing to check here. `format: null` means "not a QR cheki reads": a
 * typed reference, a receipt link, or something else entirely.
 */
export type QrRead =
  | { format: "telebirr"; reference: string }
  | { format: "dashen"; reference: string }
  | { format: "wegagen"; reference: string }
  | { format: "boa" }
  | { format: null };

/** Read a QR payload, or report that it is not a QR cheki reads. */
export function readQrPayload(raw: string): QrRead {
  const value = raw.trim();

  const telebirr = parseTelebirrQr(value);
  if (telebirr.ok) return { format: "telebirr", reference: telebirr.reference };

  const dashen = parseDashenQr(value);
  if (dashen.ok) return { format: "dashen", reference: dashen.reference };

  // A Wegagen receipt QR is prose with its share link inside it; a bare
  // share link is a link, not a QR, and is left to the URL branch.
  if (!isUrl(value)) {
    const wegagen = parseWegagenQr(value);
    if (wegagen.ok) return { format: "wegagen", reference: wegagen.shareId };
  }

  if (isBoaQrPayload(value)) return { format: "boa" };
  return { format: null };
}

/** True when a payload is a QR this chain reads (so it can be checked as one). */
export function isQrPayload(raw: string): boolean {
  return readQrPayload(raw).format !== null;
}
