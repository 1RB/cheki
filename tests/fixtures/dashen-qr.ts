/**
 * SYNTHETIC Dashen Super App receipt QR payloads, built with the same
 * structure as a real receipt's QR (docs/dashen-qr.md) but fake FT Refs.
 * Never put a real payload here: a real token resolves to a real person's
 * receipt.
 */
import { DASHEN_QR_KEY_HEX, DASHEN_QR_PREFIX } from "@/lib/qr/dashen";

/** The fake FT Ref used across the tests and docs. */
export const SYNTHETIC_REF = "B22WDTI00SAMPLE1";
/** A second fake FT Ref, so tests can show two payloads differing only in the ref. */
export const SYNTHETIC_REF_2 = "A10LTWI00SAMPLE0";
/** The opaque trailing 32 hex. Synthetic; the real value's meaning is unknown. */
export const SYNTHETIC_NONCE = "0123456789abcdef0123456789abcdef";

/** The payload half of the QR: the FT Ref XOR the key, as 32 hex characters. */
export function dashenQrPayload(ref: string): string {
  let out = "";
  for (let i = 0; i < ref.length; i++) {
    const byte = ref.charCodeAt(i) ^ parseInt(DASHEN_QR_KEY_HEX.slice(i * 2, i * 2 + 2), 16);
    out += byte.toString(16).padStart(2, "0");
  }
  return out;
}

/** The QR text: `superappreceipt_<payload>.<trailing>`. */
export function dashenQr(ref: string = SYNTHETIC_REF, nonce: string = SYNTHETIC_NONCE): string {
  return `${DASHEN_QR_PREFIX}${dashenQrPayload(ref)}.${nonce}`;
}

/** The QR text for SYNTHETIC_REF, as documented in docs/dashen-qr.md. */
export const SYNTHETIC_QR =
  "superappreceipt_e49f6442b9980cc18cdd826f93975c72.0123456789abcdef0123456789abcdef";
