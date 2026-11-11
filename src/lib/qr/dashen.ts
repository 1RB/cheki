/**
 * Dashen Bank Super App receipt QR (the QR on the receipt page).
 *
 * The QR is an INPUT, never proof of payment. It carries the transaction
 * reference and nothing else cheki uses: no amount, no names. Whoever has the
 * reference can make one, so a decoded QR only tells cheki which receipt to
 * look up; Dashen's own receipt page decides the verdict, exactly as if the
 * user had typed the reference.
 *
 * Format (worked out from three real receipts, 2026-11; see docs/dashen-qr.md):
 *
 *   superappreceipt_  <32 hex>  .  <32 hex>
 *   └ literal ──────┘ └ payload ┘ └ opaque trailing 32 hex, meaning unknown ┘
 *                            │
 *                            └ XOR each byte with DASHEN_QR_KEY_HEX, bytewise,
 *                               gives the 16-character FT Ref (B22WDTI00SAMPLE1)
 *
 * The endpoint refuses the raw token: it answers HTTP 401
 * ("Use the Right Authentication") for anything containing "_" or ".". Only the
 * decoded FT Ref resolves (HTTP 200). That is why this decoder runs before the
 * reference is ever put in a URL.
 *
 * The key is fixed across every QR and ships in the client bundle, so this is
 * obfuscation and not encryption: one known reference/token pair reveals it,
 * which is how it was derived. It only stops the reference being read by eye.
 * Changing the key breaks every already-printed QR, so it must not change.
 *
 * The trailing 32 hex is NOT a UUID, despite looking like one. Of three
 * observed payloads only one had a version nibble of 4, and none carried
 * RFC 4122 variant bits. cheki checks that it is 32 hex characters and reads
 * nothing else from it.
 *
 * Defensive by construction: hard size caps before any regex or decode, only
 * anchored single character-class regexes (no backtracking), never throws, and
 * rejects anything that does not parse exactly. A decoded value that is not an
 * FT Ref is rejected too, which is what catches a wrong or rotated key.
 */

/** The literal every Dashen Super App receipt QR starts with. */
export const DASHEN_QR_PREFIX = "superappreceipt_";

/** Longest QR text considered at all (the real one is 81 characters). */
export const DASHEN_QR_MAX_INPUT = 256;

/**
 * Bytewise XOR key, as 32 hex characters (16 bytes).
 *
 * Derived from known reference/token pairs; never published by Dashen. Public
 * by necessity: the decoder runs in the browser. Do not rotate it — every QR
 * already printed carries it.
 */
export const DASHEN_QR_KEY_HEX = "a6ad5615fdcc45f1bc8ec322c3db1943";

/** A Dashen FT Ref: 16 letters and digits. Mirrors CASE_RULES.dashen in reference-case.ts. */
export const DASHEN_QR_REF_RE = /^[A-Za-z0-9]{16}$/;

/** Length of `<32 hex>.<32 hex>`, the body after the prefix. */
const BODY_LENGTH = 65;
/** Where the "." separator sits inside the body. */
const PAYLOAD_LENGTH = 32;

export type DashenQrFailure =
  | "notText"
  | "empty"
  | "tooLong"
  | "noPrefix"
  | "structure"
  | "badPayload"
  | "badReference";

export type DashenQrResult =
  | { ok: true; reference: string }
  | { ok: false; reason: DashenQrFailure };

const fail = (reason: DashenQrFailure): DashenQrResult => ({ ok: false, reason });

const HEX_RE = /^[0-9A-Fa-f]+$/;

/** XOR the 32-hex payload with the key, byte by byte, into 16 ASCII characters. */
function xorDecode(payload: string): string {
  let out = "";
  for (let i = 0; i < PAYLOAD_LENGTH; i += 2) {
    const byte = parseInt(payload.slice(i, i + 2), 16) ^ parseInt(DASHEN_QR_KEY_HEX.slice(i, i + 2), 16);
    out += String.fromCharCode(byte);
  }
  return out;
}

/**
 * Read the FT Ref out of a Dashen Super App receipt QR. Never throws.
 * A success only means the QR is well formed: it is not a verification.
 */
export function parseDashenQr(input: unknown): DashenQrResult {
  if (typeof input !== "string") return fail("notText");
  if (input.length > DASHEN_QR_MAX_INPUT * 4) return fail("tooLong");
  // Tolerated: a scanner or copy that wrapped the payload in whitespace.
  const raw = input.replace(/\s+/g, "");
  if (!raw) return fail("empty");
  if (raw.length > DASHEN_QR_MAX_INPUT) return fail("tooLong");
  if (!raw.startsWith(DASHEN_QR_PREFIX)) return fail("noPrefix");

  const body = raw.slice(DASHEN_QR_PREFIX.length);
  if (body.length !== BODY_LENGTH) return fail("structure");
  if (body.indexOf(".") !== PAYLOAD_LENGTH) return fail("structure");

  const payload = body.slice(0, PAYLOAD_LENGTH);
  const trailing = body.slice(PAYLOAD_LENGTH + 1);
  if (!HEX_RE.test(payload) || !HEX_RE.test(trailing)) return fail("badPayload");

  const reference = xorDecode(payload);
  if (!DASHEN_QR_REF_RE.test(reference)) return fail("badReference");
  return { ok: true, reference: reference.toUpperCase() };
}

/** True when the text is a well-formed Dashen Super App receipt QR. */
export function isDashenQrPayload(input: unknown): boolean {
  return parseDashenQr(input).ok;
}
