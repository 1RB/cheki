/**
 * Telebirr receipt QR ("Payment QR Code" on the in-app receipt).
 *
 * The QR is an INPUT, never proof of payment. It carries the transaction
 * number and nothing else cheki uses: no amount, no names. Whoever has the
 * transaction number can make one, so a decoded QR only tells cheki which
 * receipt to look up; Telebirr's own receipt record decides the verdict,
 * exactly as if the user had typed the transaction number.
 *
 * Format (worked out from one real receipt, 2026-10; see docs/telebirr-qr.md):
 *
 *   QR text      base64 (standard or URL-safe; whitespace tolerated)
 *   └ decodes to ASCII hex characters, mixed case (e.g. "...000A584b4a...6304D22B")
 *     └ read as EMVCo-style TLV over those characters:
 *         2 hex chars tag, 2 DECIMAL digits length (counted in characters),
 *         then the value. Observed top level: 80 (18) · 81 (24) · 63 (04).
 *       - 63: CRC-16/CCITT-FALSE (poly 0x1021, init 0xFFFF, no reflection,
 *         no final xor) over every character before the CRC value, "6304"
 *         included, in the case they were emitted (it is case-sensitive:
 *         upper-casing the string first gives a different CRC). Verified on
 *         the real receipt, so it is enforced here as an integrity check.
 *       - 81: hex bytes holding a byte-level TLV (1-byte tag, 1-byte length
 *         in bytes). Tag 0x00 = the transaction number in ASCII.
 *       - 80: 9 bytes (00 02 06 01 02 91 02 01 31) that parse cleanly under
 *         neither rule. Meaning unknown; cheki ignores it.
 *
 * Defensive by construction: hard size caps before any regex or decode,
 * only anchored single character-class regexes (no backtracking), never
 * throws, and rejects anything that does not parse exactly.
 */

/** Longest QR text considered at all (the real one is 80 characters). */
export const TELEBIRR_QR_MAX_INPUT = 1024;
/** Longest hex string accepted after base64 decoding. */
const MAX_HEX = 512;
/** Top-level TLV entries allowed. */
const MAX_ENTRIES = 16;

/** A Telebirr transaction number: 10 uppercase letters and digits. */
export const TELEBIRR_QR_REF_RE = /^[A-Z0-9]{10}$/;

export type TelebirrQrFailure =
  | "notText"
  | "empty"
  | "tooLong"
  | "notBase64"
  | "notHex"
  | "structure"
  | "crc"
  | "noReference"
  | "badReference";

export type TelebirrQrResult =
  | { ok: true; reference: string; crc: "valid" }
  | { ok: false; reason: TelebirrQrFailure };

const fail = (reason: TelebirrQrFailure): TelebirrQrResult => ({ ok: false, reason });

const HEX_RE = /^[0-9A-Fa-f]+$/;
const B64_RE = /^[A-Za-z0-9+/]+={0,2}$/;

/** CRC-16/CCITT-FALSE over the char codes of an ASCII string. */
export function crc16CcittFalse(text: string): number {
  let crc = 0xffff;
  for (let i = 0; i < text.length; i++) {
    crc ^= (text.charCodeAt(i) & 0xff) << 8;
    for (let b = 0; b < 8; b++) {
      crc = crc & 0x8000 ? ((crc << 1) ^ 0x1021) & 0xffff : (crc << 1) & 0xffff;
    }
  }
  return crc;
}

function base64ToText(s: string): string | null {
  let t = s.replace(/-/g, "+").replace(/_/g, "/");
  if (!B64_RE.test(t)) return null;
  const rem = t.length % 4;
  if (rem === 1) return null;
  if (rem) {
    if (t.includes("=")) return null;
    t += "=".repeat(4 - rem);
  }
  try {
    return atob(t);
  } catch {
    return null;
  }
}

function hexToBytes(hex: string): number[] | null {
  if (hex.length % 2 !== 0 || (hex.length > 0 && !HEX_RE.test(hex))) return null;
  const out: number[] = [];
  for (let i = 0; i < hex.length; i += 2) out.push(parseInt(hex.slice(i, i + 2), 16));
  return out;
}

interface Entry {
  tag: string;
  value: string;
  /** Offset of the value in the hex string. */
  at: number;
}

/** EMVCo-style: 2-char tag, 2 decimal digits = value length in characters. */
function parseTopLevel(hex: string): Entry[] | null {
  const entries: Entry[] = [];
  let i = 0;
  while (i < hex.length) {
    if (entries.length >= MAX_ENTRIES || i + 4 > hex.length) return null;
    const tag = hex.slice(i, i + 2).toUpperCase();
    const lenText = hex.slice(i + 2, i + 4);
    if (!/^\d\d$/.test(lenText)) return null;
    const len = Number(lenText);
    const at = i + 4;
    if (len === 0 || at + len > hex.length) return null;
    entries.push({ tag, value: hex.slice(at, at + len), at });
    i = at + len;
  }
  return entries;
}

/** Byte TLV inside tag 81: 1-byte tag, 1-byte length (short form only). */
function parseInner(bytes: number[]): Map<number, number[]> | null {
  const out = new Map<number, number[]>();
  let i = 0;
  while (i < bytes.length) {
    if (out.size >= MAX_ENTRIES || i + 2 > bytes.length) return null;
    const tag = bytes[i];
    const len = bytes[i + 1];
    if (len >= 0x80 || i + 2 + len > bytes.length || out.has(tag)) return null;
    out.set(tag, bytes.slice(i + 2, i + 2 + len));
    i += 2 + len;
  }
  return out;
}

/** The hex string inside the QR text, or a reason it has none. */
function hexPayload(raw: string): { hex: string } | { reason: TelebirrQrFailure } {
  const decoded = base64ToText(raw);
  let reason: TelebirrQrFailure = "notBase64";
  if (decoded !== null) {
    if (decoded.length > MAX_HEX) return { reason: "tooLong" };
    if (decoded.length % 2 === 0 && HEX_RE.test(decoded)) return { hex: decoded };
    reason = "notHex";
  }
  // Tolerated: the hex string itself (a scanner app that already decoded it).
  // Hex characters are also valid base64, so this is tried after base64.
  if (HEX_RE.test(raw)) {
    if (raw.length > MAX_HEX) return { reason: "tooLong" };
    if (raw.length % 2 === 0) return { hex: raw };
    return { reason: "notHex" };
  }
  return { reason };
}

/**
 * Read the transaction number out of a Telebirr receipt QR. Never throws.
 * A success only means the QR is well formed: it is not a verification.
 */
export function parseTelebirrQr(input: unknown): TelebirrQrResult {
  if (typeof input !== "string") return fail("notText");
  if (input.length > TELEBIRR_QR_MAX_INPUT * 4) return fail("tooLong");
  const raw = input.replace(/\s+/g, "");
  if (!raw) return fail("empty");
  if (raw.length > TELEBIRR_QR_MAX_INPUT) return fail("tooLong");

  const payload = hexPayload(raw);
  if ("reason" in payload) return fail(payload.reason);
  const { hex } = payload;

  const entries = parseTopLevel(hex);
  if (!entries || entries.length < 2) return fail("structure");
  const crcEntry = entries[entries.length - 1];
  if (crcEntry.tag !== "63" || crcEntry.value.length !== 4 || !HEX_RE.test(crcEntry.value)) return fail("structure");
  const expected = parseInt(crcEntry.value, 16);
  if (crc16CcittFalse(hex.slice(0, crcEntry.at)) !== expected) return fail("crc");

  const container = entries.filter((e) => e.tag === "81");
  if (container.length !== 1) return fail("noReference");
  const bytes = hexToBytes(container[0].value);
  if (!bytes) return fail("structure");
  const inner = parseInner(bytes);
  if (!inner) return fail("structure");
  const refBytes = inner.get(0x00);
  if (!refBytes) return fail("noReference");
  const reference = String.fromCharCode(...refBytes);
  if (!TELEBIRR_QR_REF_RE.test(reference)) return fail("badReference");
  return { ok: true, reference, crc: "valid" };
}

/** True when the text is a well-formed Telebirr receipt QR. */
export function isTelebirrQrPayload(input: unknown): boolean {
  return parseTelebirrQr(input).ok;
}
