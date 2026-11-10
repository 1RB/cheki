/**
 * Dashen Super App receipt QR decoder (src/lib/qr/dashen.ts). All payloads are
 * synthetic (tests/fixtures/dashen-qr.ts): same structure as a real receipt,
 * fake FT Refs. Never a real token, which resolves to a real person's receipt.
 */
import { describe, it, expect } from "vitest";
import { DASHEN_QR_MAX_INPUT, DASHEN_QR_PREFIX, isDashenQrPayload, parseDashenQr } from "@/lib/qr/dashen";
import { isBoaQrPayload } from "@/lib/qr/decode";
import { isTelebirrQrPayload } from "@/lib/qr/telebirr";
import { looksLikeUrl } from "@/lib/adapters/url-detector";
import {
  SYNTHETIC_NONCE,
  SYNTHETIC_QR,
  SYNTHETIC_REF,
  SYNTHETIC_REF_2,
  dashenQr,
  dashenQrPayload,
} from "../fixtures/dashen-qr";
import { SYNTHETIC_QR as TELEBIRR_QR } from "../fixtures/telebirr-qr";

/** The payload half of the documented synthetic QR. Pins the XOR key. */
const SYNTHETIC_PAYLOAD = "e49f6442b9980cc18cdd826f93975c72";

describe("parseDashenQr: well-formed payloads", () => {
  it("the documented synthetic payload is what the builder makes", () => {
    expect(dashenQr()).toBe(SYNTHETIC_QR);
    expect(dashenQrPayload(SYNTHETIC_REF)).toBe(SYNTHETIC_PAYLOAD);
    expect(SYNTHETIC_QR).toBe(`${DASHEN_QR_PREFIX}${SYNTHETIC_PAYLOAD}.${SYNTHETIC_NONCE}`);
  });

  it("reads the FT Ref out of the payload", () => {
    expect(parseDashenQr(SYNTHETIC_QR)).toEqual({ ok: true, reference: SYNTHETIC_REF });
    expect(isDashenQrPayload(SYNTHETIC_QR)).toBe(true);
  });

  it("round-trips a second reference, so the key is not ref-specific", () => {
    expect(parseDashenQr(dashenQr(SYNTHETIC_REF_2))).toEqual({ ok: true, reference: SYNTHETIC_REF_2 });
    expect(dashenQrPayload(SYNTHETIC_REF_2)).not.toBe(dashenQrPayload(SYNTHETIC_REF));
  });

  it("is deterministic: the same reference always gives the same QR text", () => {
    expect(dashenQr(SYNTHETIC_REF)).toBe(dashenQr(SYNTHETIC_REF));
    expect(parseDashenQr(dashenQr(SYNTHETIC_REF))).toEqual(parseDashenQr(SYNTHETIC_QR));
  });

  it("tolerates whitespace, newlines and tabs around the payload", () => {
    expect(parseDashenQr(`  ${SYNTHETIC_QR}\n`)).toEqual({ ok: true, reference: SYNTHETIC_REF });
    expect(parseDashenQr(`\t${SYNTHETIC_QR.slice(0, 30)}\n ${SYNTHETIC_QR.slice(30)}  `)).toEqual({
      ok: true,
      reference: SYNTHETIC_REF,
    });
  });

  it("uppercases the reference, matching CASE_RULES.dashen", () => {
    const lower = dashenQr("b22wdti00sample1");
    expect(parseDashenQr(lower)).toEqual({ ok: true, reference: "B22WDTI00SAMPLE1" });
  });

  it("ignores the trailing 32 hex: its meaning is unknown, only its shape is checked", () => {
    for (const nonce of [SYNTHETIC_NONCE, "ffffffffffffffffffffffffffffffff", "00000000000000000000000000000000"]) {
      expect(parseDashenQr(dashenQr(SYNTHETIC_REF, nonce))).toEqual({ ok: true, reference: SYNTHETIC_REF });
    }
    // Varying only the trailing half never changes the decoded reference.
    expect(dashenQrPayload(SYNTHETIC_REF)).toBe(dashenQrPayload(SYNTHETIC_REF));
  });

  it("accepts upper-case hex in both halves", () => {
    const upper = `${DASHEN_QR_PREFIX}${SYNTHETIC_PAYLOAD.toUpperCase()}.${SYNTHETIC_NONCE.toUpperCase()}`;
    expect(parseDashenQr(upper)).toEqual({ ok: true, reference: SYNTHETIC_REF });
  });
});

describe("parseDashenQr: malformed input never throws and is rejected", () => {
  const bad: [string, unknown, string][] = [
    ["not a string", 42, "notText"],
    ["number zero", 0, "notText"],
    ["boolean", true, "notText"],
    ["null", null, "notText"],
    ["undefined", undefined, "notText"],
    ["object", {}, "notText"],
    ["array", ["x"], "notText"],
    ["symbol", Symbol("qr"), "notText"],
    ["empty", "", "empty"],
    ["whitespace only", "   \n\t", "empty"],
    ["not a Dashen QR", "hello world!", "noPrefix"],
    ["a plain reference", SYNTHETIC_REF, "noPrefix"],
    ["a receipt link", "https://receipts.dashenbanksc.com/receipt/B22WDTI00SAMPLE1", "noPrefix"],
    ["the prefix without the underscore", "superappreceipt", "noPrefix"],
    ["prefix only", DASHEN_QR_PREFIX, "structure"],
    ["no separator", DASHEN_QR_PREFIX + dashenQrPayload(SYNTHETIC_REF) + SYNTHETIC_NONCE, "structure"],
    [
      "body one character short",
      DASHEN_QR_PREFIX + dashenQrPayload(SYNTHETIC_REF) + "." + SYNTHETIC_NONCE.slice(0, -1),
      "structure",
    ],
    ["body one character long", DASHEN_QR_PREFIX + dashenQrPayload(SYNTHETIC_REF) + "." + SYNTHETIC_NONCE + "0", "structure"],
    [
      "separator in the wrong place",
      DASHEN_QR_PREFIX + "0".repeat(10) + "." + dashenQrPayload(SYNTHETIC_REF) + SYNTHETIC_NONCE.slice(10),
      "structure",
    ],
    ["two separators", DASHEN_QR_PREFIX + dashenQrPayload(SYNTHETIC_REF) + "." + SYNTHETIC_NONCE + ".", "structure"],
    ["non-hex payload", DASHEN_QR_PREFIX + "z".repeat(32) + "." + SYNTHETIC_NONCE, "badPayload"],
    ["non-hex trailing half", DASHEN_QR_PREFIX + dashenQrPayload(SYNTHETIC_REF) + "." + "z".repeat(32), "badPayload"],
    ["punctuation in the decoded reference", dashenQr("ABC1D2E3F4/XXXXX"), "badReference"],
    ["control byte in the decoded reference", dashenQr("ABC1D2E3F4\u0000XXXXX"), "badReference"],
    ["a reference whose decoded bytes are not all printable", dashenQr("ÿÿÿÿÿÿÿÿÿÿÿÿÿÿÿÿ"), "badReference"],
  ];
  for (const [name, input, reason] of bad) {
    it(name, () => {
      expect(() => parseDashenQr(input)).not.toThrow();
      expect(parseDashenQr(input)).toEqual({ ok: false, reason });
      expect(isDashenQrPayload(input)).toBe(false);
    });
  }

  it("rejects a payload encrypted with a different key (key rotation)", () => {
    const rotated = [...Buffer.from(SYNTHETIC_REF)]
      .map((b, i) => (b ^ (0x5a + i)).toString(16).padStart(2, "0"))
      .join("");
    const qr = DASHEN_QR_PREFIX + rotated + "." + SYNTHETIC_NONCE;
    expect(parseDashenQr(qr)).toEqual({ ok: false, reason: "badReference" });
  });

  it("ordinary references, links and other banks' QRs are not Dashen QRs", () => {
    for (const s of [
      SYNTHETIC_REF,
      SYNTHETIC_REF_2,
      "FT26SAMPLE01",
      "https://receipts.dashenbanksc.com/receipt/B22WDTI00SAMPLE1",
      "receipt.dashensuperapp.com/receipt/B22WDTI00SAMPLE1",
      TELEBIRR_QR,
      SYNTHETIC_NONCE,
      "0123456789abcdef",
    ]) {
      expect(isDashenQrPayload(s), s).toBe(false);
    }
  });
});

describe("parseDashenQr: size caps and no ReDoS", () => {
  it("rejects oversized input quickly, before decoding", () => {
    const t0 = performance.now();
    expect(parseDashenQr("A".repeat(1_000_000))).toEqual({ ok: false, reason: "tooLong" });
    expect(parseDashenQr(" ".repeat(3000) + SYNTHETIC_QR)).toEqual({ ok: false, reason: "tooLong" });
    expect(parseDashenQr("A".repeat(DASHEN_QR_MAX_INPUT * 4 + 1))).toEqual({ ok: false, reason: "tooLong" });
    expect(performance.now() - t0).toBeLessThan(200);
  });

  it("caps the stripped payload, so whitespace padding cannot smuggle past the prefix", () => {
    expect(parseDashenQr(" ".repeat(300) + "A".repeat(300))).toEqual({ ok: false, reason: "tooLong" });
    // The documented cap: exactly at it is checked, one past is rejected.
    expect(parseDashenQr("A".repeat(DASHEN_QR_MAX_INPUT))).toEqual({ ok: false, reason: "noPrefix" });
    expect(parseDashenQr("A".repeat(DASHEN_QR_MAX_INPUT + 1))).toEqual({ ok: false, reason: "tooLong" });
  });

  it("adversarial near-miss inputs at the cap stay fast", () => {
    const inputs = [
      "A".repeat(DASHEN_QR_MAX_INPUT),
      " ".repeat(DASHEN_QR_MAX_INPUT),
      DASHEN_QR_PREFIX + "0".repeat(240),
      DASHEN_QR_PREFIX + "g".repeat(64) + "." + "h".repeat(64),
      DASHEN_QR_PREFIX + dashenQrPayload(SYNTHETIC_REF).toUpperCase() + "." + "z".repeat(32),
      SYNTHETIC_QR.replace(".", ".."),
      `${DASHEN_QR_PREFIX}${SYNTHETIC_PAYLOAD} `.repeat(1),
    ];
    const t0 = performance.now();
    for (let i = 0; i < 50; i++) for (const s of inputs) parseDashenQr(s);
    expect(performance.now() - t0).toBeLessThan(500);
  });
});

describe("precedence against the other QR detectors", () => {
  it("a Dashen QR is never read as Telebirr, BOA or a URL", () => {
    expect(isTelebirrQrPayload(SYNTHETIC_QR)).toBe(false);
    // Base64 charset rejects "_" and "." before any decode runs.
    expect(isBoaQrPayload(SYNTHETIC_QR)).toBe(false);
    // No ":", "//" or "\" — it is not URL syntax, so the URL branch never takes it.
    expect(looksLikeUrl(SYNTHETIC_QR)).toBe(false);
  });

  it("a Telebirr payload is never read as a Dashen QR", () => {
    expect(isDashenQrPayload(TELEBIRR_QR)).toBe(false);
    expect(parseDashenQr(TELEBIRR_QR)).toEqual({ ok: false, reason: "noPrefix" });
  });

  it("a Dashen QR cannot be mistaken for a CBE reference inside it", () => {
    // CBE matches /\bFT[A-Z0-9]{10}\b/; "T" is not a hex character, so the
    // payload can never carry it, and the prefix has no "FT".
    expect(SYNTHETIC_QR).not.toMatch(/\bFT[A-Z0-9]{10}\b/);
  });
});
