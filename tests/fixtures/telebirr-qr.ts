/**
 * SYNTHETIC Telebirr receipt QR payloads, built with the same structure as a
 * real receipt's "Payment QR Code" (docs/telebirr-qr.md) but fake transaction
 * numbers. Never put a real payload here.
 */
import { crc16CcittFalse } from "@/lib/qr/telebirr";

/** Tag 80 exactly as observed (meaning unknown). */
export const TAG80_VALUE = "000206010291020131";

export interface BuildOptions {
  /** Tag 80 value (hex chars); "" drops the tag. */
  tag80?: string;
  /** Lowercase the transaction-number hex, as the real receipt does (default true). */
  lowerRef?: boolean;
  /** Replace the computed CRC (4 hex chars). */
  crc?: string;
  /** Raw bytes for tag 81's inner TLV instead of 00 0A <ref>. */
  innerHex?: string;
}

const pad2 = (n: number) => String(n).padStart(2, "0");
const hex2 = (n: number) => n.toString(16).toUpperCase().padStart(2, "0");

/** The hex string inside the QR. */
export function telebirrQrHex(ref: string, o: BuildOptions = {}): string {
  const refHex = Buffer.from(ref, "latin1").toString("hex");
  const inner = o.innerHex ?? `00${hex2(ref.length)}${o.lowerRef === false ? refHex.toUpperCase() : refHex}`;
  const tag80 = o.tag80 ?? TAG80_VALUE;
  const body = `${tag80 ? `80${pad2(tag80.length)}${tag80}` : ""}81${pad2(inner.length)}${inner}6304`;
  const crc = o.crc ?? crc16CcittFalse(body).toString(16).toUpperCase().padStart(4, "0");
  return body + crc;
}

/** The QR text: base64 of the hex string. */
export function telebirrQr(ref: string, o: BuildOptions = {}): string {
  return Buffer.from(telebirrQrHex(ref, o), "latin1").toString("base64");
}

/** The fake transaction number used across the tests and docs. */
export const SYNTHETIC_REF = "ABC1D2E3F4";
/** Its QR text, as documented in docs/telebirr-qr.md. */
export const SYNTHETIC_QR = "ODAxODAwMDIwNjAxMDI5MTAyMDEzMTgxMjQwMDBBNDE0MjQzMzE0NDMyNDUzMzQ2MzQ2MzA0RTk2OQ==";
/** A fake number whose hex has letters, so the payload is mixed case like the real one. */
export const MIXED_CASE_REF = "XKJ0L9N8M7";
