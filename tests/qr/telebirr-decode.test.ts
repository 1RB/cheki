/**
 * Telebirr receipt QR decoder (src/lib/qr/telebirr.ts). All payloads are
 * synthetic (tests/fixtures/telebirr-qr.ts): same structure as a real
 * receipt, fake transaction numbers.
 */
import { describe, it, expect } from "vitest";
import { crc16CcittFalse, isTelebirrQrPayload, parseTelebirrQr } from "@/lib/qr/telebirr";
import { isBoaQrPayload } from "@/lib/qr/decode";
import { MIXED_CASE_REF, SYNTHETIC_QR, SYNTHETIC_REF, TAG80_VALUE, telebirrQr, telebirrQrHex } from "../fixtures/telebirr-qr";

const b64 = (s: string) => Buffer.from(s, "latin1").toString("base64");

describe("CRC-16/CCITT-FALSE", () => {
  it("matches the standard check value (\"123456789\" → 0x29B1)", () => {
    expect(crc16CcittFalse("123456789")).toBe(0x29b1);
  });
});

describe("parseTelebirrQr: well-formed payloads", () => {
  it("the documented synthetic payload is what the builder makes", () => {
    expect(telebirrQr(SYNTHETIC_REF)).toBe(SYNTHETIC_QR);
    expect(telebirrQrHex(SYNTHETIC_REF)).toBe("80180002060102910201318124000A414243314432453346346304E969");
  });

  it("reads the transaction number from tag 81 → 00, CRC valid", () => {
    expect(parseTelebirrQr(SYNTHETIC_QR)).toEqual({ ok: true, reference: SYNTHETIC_REF, crc: "valid" });
    expect(isTelebirrQrPayload(SYNTHETIC_QR)).toBe(true);
  });

  it("mixed-case hex, like the real receipt (lowercase ref bytes, uppercase lengths and CRC)", () => {
    const hex = telebirrQrHex(MIXED_CASE_REF);
    expect(hex).toMatch(/[a-f]/);
    expect(hex).toMatch(/[A-F]/);
    expect(parseTelebirrQr(b64(hex))).toMatchObject({ ok: true, reference: MIXED_CASE_REF });
    // Upper-case ref bytes with a CRC computed over that form also parse.
    expect(parseTelebirrQr(telebirrQr(MIXED_CASE_REF, { lowerRef: false }))).toMatchObject({ ok: true, reference: MIXED_CASE_REF });
  });

  it("tolerates whitespace, newlines, URL-safe base64 and missing padding", () => {
    const urlSafe = SYNTHETIC_QR.replace(/=+$/, "").replace(/\+/g, "-").replace(/\//g, "_");
    expect(parseTelebirrQr(urlSafe)).toMatchObject({ ok: true, reference: SYNTHETIC_REF });
    expect(parseTelebirrQr(`  ${SYNTHETIC_QR.slice(0, 30)}\n ${SYNTHETIC_QR.slice(30)}\t`)).toMatchObject({ ok: true });
  });

  it("accepts the hex string itself (a scanner that already decoded the base64)", () => {
    expect(parseTelebirrQr(telebirrQrHex(SYNTHETIC_REF))).toMatchObject({ ok: true, reference: SYNTHETIC_REF });
  });

  it("does not need tag 80 (unknown meaning) and ignores its content", () => {
    expect(parseTelebirrQr(telebirrQr(SYNTHETIC_REF, { tag80: "" }))).toMatchObject({ ok: true });
    expect(parseTelebirrQr(telebirrQr(SYNTHETIC_REF, { tag80: "0102" }))).toMatchObject({ ok: true });
  });
});

describe("parseTelebirrQr: malformed input never throws and is rejected", () => {
  const bad: [string, unknown, string][] = [
    ["not a string", 42, "notText"],
    ["null", null, "notText"],
    ["empty", "   ", "empty"],
    ["not base64 or hex", "hello world!", "notBase64"],
    ["base64 of non-hex text", b64("this is not hex at all"), "notHex"],
    ["odd-length hex", b64(telebirrQrHex(SYNTHETIC_REF).slice(0, -1)), "notHex"],
    ["odd-length raw hex", telebirrQrHex(SYNTHETIC_REF).slice(0, -1), "notHex"],
    ["length past the end", b64("8099" + TAG80_VALUE), "structure"],
    ["non-decimal top-level length", b64("801A" + TAG80_VALUE), "structure"],
    ["no CRC tag", b64(telebirrQrHex(SYNTHETIC_REF).slice(0, -8)), "structure"],
    ["truncated CRC", b64(telebirrQrHex(SYNTHETIC_REF).slice(0, -2)), "structure"],
    ["wrong CRC", telebirrQr(SYNTHETIC_REF, { crc: "0000" }), "crc"],
    ["one character changed", b64(telebirrQrHex(SYNTHETIC_REF).replace("414243", "414244")), "crc"],
    ["case changed after the CRC was computed (CRC is case-sensitive)", b64(telebirrQrHex(MIXED_CASE_REF).toUpperCase()), "crc"],
    ["reference too short", telebirrQr("ABC123"), "badReference"],
    ["reference too long", telebirrQr("ABC1D2E3F4G"), "badReference"],
    ["lowercase reference", telebirrQr("abc1d2e3f4"), "badReference"],
    ["punctuation in reference", telebirrQr("ABC1D2E3F/"), "badReference"],
    ["control bytes in reference", telebirrQr("ABC1D2E3F\u0000"), "badReference"],
    ["no tag 00 inside 81", telebirrQr(SYNTHETIC_REF, { innerHex: "010A" + Buffer.from(SYNTHETIC_REF).toString("hex") }), "noReference"],
    ["inner length past the end", telebirrQr(SYNTHETIC_REF, { innerHex: "0010" + Buffer.from(SYNTHETIC_REF).toString("hex") }), "structure"],
    ["inner long-form length", telebirrQr(SYNTHETIC_REF, { innerHex: "0081" + "0A" + Buffer.from(SYNTHETIC_REF).toString("hex") }), "structure"],
  ];
  for (const [name, input, reason] of bad) {
    it(name, () => {
      expect(() => parseTelebirrQr(input)).not.toThrow();
      expect(parseTelebirrQr(input)).toEqual({ ok: false, reason });
      expect(isTelebirrQrPayload(input)).toBe(false);
    });
  }

  it("no tag 81 at all", () => {
    const body = `80${String(TAG80_VALUE.length).padStart(2, "0")}${TAG80_VALUE}6304`;
    const hex = body + crc16CcittFalse(body).toString(16).toUpperCase().padStart(4, "0");
    expect(parseTelebirrQr(b64(hex))).toEqual({ ok: false, reason: "noReference" });
  });

  it("two tag 81 containers are ambiguous and rejected", () => {
    const inner = "000A" + Buffer.from(SYNTHETIC_REF).toString("hex");
    const body = `8124${inner}8124${inner}6304`;
    const hex = body + crc16CcittFalse(body).toString(16).toUpperCase().padStart(4, "0");
    expect(parseTelebirrQr(b64(hex))).toEqual({ ok: false, reason: "noReference" });
  });

  it("ordinary references and links are not Telebirr QRs", () => {
    for (const s of ["DET8FJGUJ4", "FT26SAMPLE01", "https://transactioninfo.ethiotelecom.et/receipt/DET8FJGUJ4", "B22WDTI2619100WH", "0123456789abcdef"]) {
      expect(isTelebirrQrPayload(s), s).toBe(false);
    }
  });
});

describe("parseTelebirrQr: size caps and no ReDoS", () => {
  it("rejects oversized input quickly, before decoding", () => {
    const t0 = performance.now();
    expect(parseTelebirrQr("A".repeat(1_000_000))).toEqual({ ok: false, reason: "tooLong" });
    expect(parseTelebirrQr(" ".repeat(3000) + "A".repeat(1025))).toEqual({ ok: false, reason: "tooLong" });
    expect(parseTelebirrQr(b64("8".repeat(600)))).toEqual({ ok: false, reason: "tooLong" });
    expect(performance.now() - t0).toBeLessThan(200);
  });

  it("adversarial near-miss inputs at the cap stay fast", () => {
    const inputs = [
      "A".repeat(1024),
      "=".repeat(1024),
      "8".repeat(512),
      b64("80".repeat(192)),
      b64("8102".repeat(96)),
      ("ab".repeat(511) + "!"),
    ];
    const t0 = performance.now();
    for (let i = 0; i < 50; i++) for (const s of inputs) parseTelebirrQr(s);
    expect(performance.now() - t0).toBeLessThan(500);
  });

  it("caps the number of TLV entries", () => {
    const many = "0102AB".repeat(20);
    const body = `${many}8124000A${Buffer.from(SYNTHETIC_REF).toString("hex")}6304`;
    const hex = body + crc16CcittFalse(body).toString(16).toUpperCase().padStart(4, "0");
    expect(parseTelebirrQr(b64(hex))).toEqual({ ok: false, reason: "structure" });
  });
});

describe("precedence against BOA QR detection", () => {
  it("a BOA ciphertext payload is never a Telebirr QR", () => {
    const boa = Buffer.alloc(96, 7).toString("base64");
    expect(isBoaQrPayload(boa)).toBe(true);
    expect(isTelebirrQrPayload(boa)).toBe(false);
  });

  it("a Telebirr payload can look like BOA ciphertext by size alone", () => {
    // 64 hex characters = 64 decoded bytes, a multiple of 16.
    const tag80 = TAG80_VALUE + "000000";
    const qr = telebirrQr(SYNTHETIC_REF, { tag80 });
    expect(Buffer.from(qr, "base64").length % 16).toBe(0);
    expect(isBoaQrPayload(qr)).toBe(true);
    expect(parseTelebirrQr(qr)).toMatchObject({ ok: true, reference: SYNTHETIC_REF });
  });
});
