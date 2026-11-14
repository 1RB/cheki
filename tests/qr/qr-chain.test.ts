/**
 * One chain reads a QR payload (src/lib/qr/chain.ts), so the check that goes
 * out for a payload is the same whether the panel read it (paste, camera) or
 * an API client posted the payload itself as qrData: the detector, the
 * verifier, the panel's paste handling and the image OCR all ask the chain
 * what a payload is, in the order it fixes.
 *
 * The parity below is end to end: for each payload, the fetch the panel's
 * request triggers and the fetch the raw qrData request triggers have to be
 * the same URL, or the two sides would be checking different receipts.
 */
import { describe, it, expect, afterEach, vi } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { Verifier } from "@/lib";
import "@/lib/parsers";
import { isQrPayload, readQrPayload } from "@/lib/qr/chain";
import { detectInput } from "@/lib/verify/detect";
import { SYNTHETIC_QR as TELEBIRR_QR, SYNTHETIC_REF as TELEBIRR_REF } from "../fixtures/telebirr-qr";
import { SYNTHETIC_QR as DASHEN_QR, SYNTHETIC_REF as DASHEN_REF } from "../fixtures/dashen-qr";
import { SYNTH_WEGAGEN_QR, SYNTH_WEGAGEN_ID } from "../fixtures/wegagen/records";

const read = (p: string) => readFileSync(join(__dirname, "..", "..", p), "utf8");

/** A receipt link, which is not a QR: it is read as a link on both sides. */
const CBE_BIRR_LINK = "https://cbepay1.cbe.com.et/aureceipt?TID=DTS41AB2C90&PH=251911004321";
/**
 * A BOA receipt QR payload (synthetic, from tests/security/boa-qr.test.ts):
 * ciphertext only the BOA branch can decrypt, so it is the one format the
 * panel sends on as qrData instead of reading a reference out of it.
 */
const BOA_QR =
  "KPHO0k4YlK/5s61BrKNnjG8dcbVjm5WqkNeCv93+8UYEinGOPAL1+Wpq6cy8McTYhpdXUgKvK4qFFcGhM0Yi+ZgrqD8G3UKsoUNwSiKqWXilJTG+1yIE+KEEK7IuoZl7";

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

/** fetch that records the URLs it was asked for and answers "not found". */
function fetchUrls(): string[] {
  const urls: string[] = [];
  vi.stubGlobal(
    "fetch",
    vi.fn(async (input: unknown) => {
      urls.push(String(input instanceof Request ? input.url : input));
      return new Response("not found", { status: 404 });
    })
  );
  return urls;
}

describe("readQrPayload", () => {
  it("reads each format, in the order the callers rely on", () => {
    expect(readQrPayload(TELEBIRR_QR)).toEqual({ format: "telebirr", reference: TELEBIRR_REF });
    expect(readQrPayload(DASHEN_QR)).toEqual({ format: "dashen", reference: DASHEN_REF });
    expect(readQrPayload(SYNTH_WEGAGEN_QR)).toEqual({ format: "wegagen", reference: SYNTH_WEGAGEN_ID });
    expect(readQrPayload(BOA_QR)).toEqual({ format: "boa" });
  });

  it("a receipt link or a plain reference is not a QR", () => {
    expect(readQrPayload(CBE_BIRR_LINK).format).toBeNull();
    expect(readQrPayload("FT26SAMPLE01").format).toBeNull();
    expect(readQrPayload("").format).toBeNull();
    expect(readQrPayload("a sentence someone typed").format).toBeNull();
  });

  it("is what paste checks: a QR the chain reads, or a link", () => {
    for (const payload of [TELEBIRR_QR, DASHEN_QR, SYNTH_WEGAGEN_QR, BOA_QR]) {
      expect(isQrPayload(payload), payload.slice(0, 24)).toBe(true);
    }
    expect(isQrPayload(CBE_BIRR_LINK)).toBe(false); // isUrl covers links
    expect(isQrPayload("FT26SAMPLE01")).toBe(false);
  });
});

/**
 * The panel posts what detectInput read ({bank, reference}, or the payload
 * itself for a BOA QR); an API client may post the payload as qrData and let
 * the server read it. Both have to reach the same bank with the same
 * reference, so both have to fetch the same URL.
 */
describe("the panel's check and the qrData check are one check", () => {
  const rows: { name: string; payload: string; kind: string; bank: string }[] = [
    { name: "a Telebirr receipt QR", payload: TELEBIRR_QR, kind: "telebirrQr", bank: "telebirr" },
    { name: "a Dashen Super App receipt QR", payload: DASHEN_QR, kind: "dashenQr", bank: "dashen" },
    { name: "a Wegagen receipt QR", payload: SYNTH_WEGAGEN_QR, kind: "wegagenQr", bank: "wegagen" },
    { name: "a CBE Birr receipt QR (its receipt link)", payload: CBE_BIRR_LINK, kind: "url", bank: "cbebirr" },
  ];

  it.each(rows)("$name: one fetch either way", async ({ payload, kind, bank }) => {
    const d = detectInput(payload);
    expect(d.kind).toBe(kind);
    expect(d.bank?.code).toBe(bank);

    const fromPanel = fetchUrls();
    await new Verifier().verify({ bank: d.bank!.code, reference: d.value });
    expect(fromPanel, "the panel's request never reached the bank").toHaveLength(1);

    const fromQr = fetchUrls();
    await new Verifier().verify({ bank: "", qrData: payload });
    expect(fromQr[0]).toBe(fromPanel[0]);
  });

  it("a BOA payload is BOA on both sides, and is sent unchanged", () => {
    const d = detectInput(BOA_QR);
    expect(d.kind).toBe("boaQr");
    expect(readQrPayload(BOA_QR).format).toBe("boa");
    // The panel posts the payload itself, with bank "boa": nothing is read
    // out of it here, because only the BOA branch can decrypt it.
    expect(d.value).toBe(BOA_QR);
    expect(d.bank?.code).toBe("boa");
  });

  it("a QR naming another bank is reported by both, never re-routed", async () => {
    for (const [payload, named] of [
      [TELEBIRR_QR, "dashen"],
      [DASHEN_QR, "wegagen"],
      [SYNTH_WEGAGEN_QR, "cbe"],
    ] as const) {
      const r = await new Verifier().verify({ bank: named, qrData: payload });
      expect(r.ok, named).toBe(false);
      if (!r.ok) expect(r.error.kind).toBe("MISSING_INPUT");
      // The panel's own guard: detectInput names the QR's bank, so a locked
      // page to `named` refuses the check instead of sending it.
      expect(detectInput(payload).bank?.code).not.toBe(named);
    }
  });
});

describe("no caller keeps its own chain", () => {
  it("the detector, the verifier, the panel and the OCR read payloads through the chain", () => {
    const ownParse = /parseTelebirrQr|parseDashenQr|parseWegagenQr|isBoaQrPayload|isTelebirrQrPayload|isDashenQrPayload|isWegagenQrPayload/;
    for (const file of [
      "src/lib/verify/detect.ts",
      "src/lib/core/verifier.ts",
      "src/lib/server-ocr.ts",
      "src/components/verify/VerifyPanel.tsx",
    ]) {
      const src = read(file);
      expect(src, file).toMatch(/qr\/chain/);
      expect(src, file).not.toMatch(ownParse);
    }
  });

  it("both paste handlers ask the chain, so paste cannot drift from the camera", () => {
    const panel = read("src/components/verify/VerifyPanel.tsx");
    expect(panel.match(/isQrPayload\(text\)/g)).toHaveLength(2);
    expect(panel).toMatch(/readQrPayload\(text\)/);
  });
});
