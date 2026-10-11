/**
 * A Telebirr receipt QR only supplies the transaction number. Everywhere it
 * enters (detection, verifier, API, batch) it must behave exactly like the
 * typed number, and the QR alone must never produce a verified result.
 * Payloads are synthetic (tests/fixtures/telebirr-qr.ts).
 */
import { describe, it, expect, afterEach, vi } from "vitest";
import { NextRequest } from "next/server";
import { Verifier } from "@/lib";
import { detectInput, browserReceiptUrl } from "@/lib/verify/detect";
import { verificationState } from "@/lib/banks";
import { getBank } from "@/lib/manifest/loader";
import { inputOnlyFormats, isCheckableFormat, isInputOnlyFormat, primaryFormat, secondaryFormats, selectFormat, supportedFormats } from "@/lib/manifest/formats";
import { getAllBanks } from "@/lib";
import { POST as verifyPOST } from "@/app/api/verify/route";
import { POST as batchPOST } from "@/app/api/verify/batch/route";
import { GET as banksGET } from "@/app/api/banks/route";
import { SYNTHETIC_QR, SYNTHETIC_REF, TAG80_VALUE, telebirrQr } from "../fixtures/telebirr-qr";

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

const RECEIPT_URL = (ref: string) => `https://transactioninfo.ethiotelecom.et/receipt/${ref}`;

/** A Telebirr receipt page for `ref` (synthetic). */
const receiptHtml = (ref: string, status = "Completed") =>
  `<html><title>telebirr receipt</title><table>` +
  `<tr><td>Payer Name</td><td>Test Payer</td></tr>` +
  `<tr><td>Credited Party name</td><td>Test Shop</td></tr>` +
  `<tr><td>transaction status</td><td>${status}</td></tr>` +
  `<tr><td>Invoice No.</td><td>${ref}</td></tr>` +
  `<tr><td>Settled Amount</td><td>101.00 Birr</td></tr>` +
  `</table></html>`;

let ip = 0;
const req = (url: string, body: unknown) =>
  new NextRequest(`https://cheki.et${url}`, {
    method: "POST",
    headers: { "content-type": "application/json", "x-real-ip": `10.88.${Math.floor(++ip / 250)}.${ip % 250}` },
    body: JSON.stringify(body),
  });

describe("detectInput", () => {
  it("a Telebirr receipt QR becomes its transaction number, Telebirr, browser-first", () => {
    const d = detectInput(SYNTHETIC_QR);
    expect(d.kind).toBe("telebirrQr");
    expect(d.value).toBe(SYNTHETIC_REF);
    expect(d.bank?.code).toBe("telebirr");
    expect(d.browserFirst).toBe(true);
    expect(d.needsAccount).toBe(false);
    expect(d.needsPhone).toBe(false);
    expect(browserReceiptUrl(d)).toBe(RECEIPT_URL(SYNTHETIC_REF));
  });

  it("is the same check as typing the number on the Telebirr page", () => {
    const fromQr = detectInput(SYNTHETIC_QR, { lockedBank: "telebirr" });
    const typed = detectInput(SYNTHETIC_REF, { lockedBank: "telebirr" });
    expect(fromQr.bank?.code).toBe(typed.bank?.code);
    expect(fromQr.value).toBe(typed.value);
    expect(fromQr.browserFirst).toBe(typed.browserFirst);
    expect(fromQr.format?.id).toBe(typed.format?.id);
    expect(browserReceiptUrl(fromQr)).toBe(browserReceiptUrl(typed));
  });

  it("names its own bank: on another bank's page it is reported, not re-routed", () => {
    const d = detectInput(SYNTHETIC_QR, { lockedBank: "boa" });
    expect(d.bank?.code).toBe("telebirr");
    expect(d.kind).toBe("telebirrQr");
  });

  it("a chosen bank does not override it", () => {
    expect(detectInput(SYNTHETIC_QR, { overrideBank: "cbe" }).bank?.code).toBe("telebirr");
  });

  it("precedence: Telebirr QR before BOA QR, BOA QR and links unchanged", () => {
    const boaSized = telebirrQr(SYNTHETIC_REF, { tag80: TAG80_VALUE + "000000" }); // 64 bytes: BOA-sized
    expect(detectInput(boaSized).kind).toBe("telebirrQr");
    expect(detectInput(Buffer.alloc(96, 7).toString("base64")).kind).toBe("boaQr");
    expect(detectInput(RECEIPT_URL("DET8FJGUJ4")).kind).toBe("url");
    expect(detectInput("https://mbreciept.cbe.com.et/fHCxyV4mg5pRIwEkJO").kind).toBe("url");
  });

  it("a malformed Telebirr QR is not treated as one", () => {
    const d = detectInput(telebirrQr(SYNTHETIC_REF, { crc: "0000" }));
    expect(d.kind).not.toBe("telebirrQr");
    expect(d.bank?.code).not.toBe("telebirr");
  });

  it("a typed DJA transaction number is a Telebirr candidate", () => {
    expect(detectInput("DJA0CHEKI1").candidates.map((b) => b.code)).toContain("telebirr");
  });
});

describe("Verifier: qrData", () => {
  const v = new Verifier();

  it("looks the transaction number up at Telebirr, like a typed reference", async () => {
    const fetchMock = vi.fn(async () => new Response(receiptHtml(SYNTHETIC_REF), { status: 200, headers: { "content-type": "text/html" } }));
    vi.stubGlobal("fetch", fetchMock);
    const r = await v.verify({ bank: "telebirr", qrData: SYNTHETIC_QR });
    expect(String((fetchMock.mock.calls[0] as unknown[])[0])).toBe(RECEIPT_URL(SYNTHETIC_REF));
    // Verified because Telebirr's own page confirmed it, through the normal gate.
    expect(r.ok && r.value.verified).toBe(true);
    if (r.ok) {
      expect(r.value.reference).toBe(SYNTHETIC_REF);
      expect(r.value.sourceUrl).toBe(RECEIPT_URL(SYNTHETIC_REF));
      expect(r.value.decodedOnly).toBeUndefined();
    }
  });

  it("no bank named: the QR still goes to Telebirr", async () => {
    const fetchMock = vi.fn(async () => { throw new Error("ETIMEDOUT"); });
    vi.stubGlobal("fetch", fetchMock);
    await v.verify({ bank: "", qrData: SYNTHETIC_QR });
    expect(String((fetchMock.mock.calls[0] as unknown[])[0])).toBe(RECEIPT_URL(SYNTHETIC_REF));
  });

  it("the QR alone never verifies: Telebirr unreachable (geo-block) is a failure, not decodedOnly", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => { throw new Error("ETIMEDOUT"); }));
    const r = await v.verify({ bank: "telebirr", qrData: SYNTHETIC_QR });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error.kind).toBe("ENDPOINT_ERROR");
  });

  it("the QR alone never verifies: Telebirr has no such receipt", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => new Response("<html><body>This request is not correct</body></html>", { status: 200, headers: { "content-type": "text/html" } })));
    const r = await v.verify({ bank: "telebirr", qrData: SYNTHETIC_QR });
    expect(r.ok && r.value.verified).toBeFalsy();
  });

  it("a receipt for a different transaction number does not pass the gate", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => new Response(receiptHtml("ZZZ9Y8X7W6"), { status: 200, headers: { "content-type": "text/html" } })));
    const r = await v.verify({ bank: "telebirr", qrData: SYNTHETIC_QR });
    expect(r.ok && r.value.verified).toBeFalsy();
  });

  it("a failed transaction does not pass the gate", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => new Response(receiptHtml(SYNTHETIC_REF, "Failed"), { status: 200, headers: { "content-type": "text/html" } })));
    const r = await v.verify({ bank: "telebirr", qrData: SYNTHETIC_QR });
    expect(r.ok && r.value.verified).toBeFalsy();
  });

  it("with another bank named it is rejected before any fetch (never sent to BOA's decryptor)", async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
    for (const bank of ["boa", "cbe", "mpesa"]) {
      const r = await v.verify({ bank, qrData: SYNTHETIC_QR });
      expect(r.ok).toBe(false);
      if (!r.ok) {
        expect(r.error.kind).toBe("MISSING_INPUT");
        expect(r.error.message).toMatch(/Telebirr receipt/);
      }
    }
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("a malformed Telebirr QR is not resolved to a Telebirr reference", async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
    const r = await v.verify({ bank: "telebirr", qrData: telebirrQr(SYNTHETIC_REF, { crc: "0000" }) });
    expect(r.ok).toBe(false);
    expect(fetchMock).not.toHaveBeenCalled();
  });
});

describe("API", () => {
  it("/api/verify: Telebirr unreachable → not verified, error shown, nothing cached", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => { throw new Error("ETIMEDOUT"); }));
    const ref = "QRT0A1B2C3";
    const res = await verifyPOST(req("/api/verify", { bank: "telebirr", qrData: telebirrQr(ref) }));
    const body = await res.json();
    expect(res.status).toBe(502);
    expect(body.success).toBe(false);
    expect(body.verified).toBeUndefined();
    expect(body.fallbackUrl).toBe(RECEIPT_URL(ref));
    expect(verificationState(body)).not.toBe("verified");
  });

  it("/api/verify: a QR for the wrong bank is a 400", async () => {
    const res = await verifyPOST(req("/api/verify", { bank: "boa", qrData: SYNTHETIC_QR }));
    expect(res.status).toBe(400);
  });

  it("/api/verify: the response never carries anything from the QR but the reference", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => new Response("<html><body>This request is not correct</body></html>", { status: 200, headers: { "content-type": "text/html" } })));
    const res = await verifyPOST(req("/api/verify", { bank: "telebirr", qrData: telebirrQr("QRT1A1B2C3") }));
    const body = await res.json();
    expect(body.verified === true).toBe(false);
    expect(body.amount).toBeUndefined();
    expect(body.senderName).toBeUndefined();
    expect(body.receiverName).toBeUndefined();
    expect(body.decodedOnly).toBeUndefined();
  });

  it("/api/verify/batch: a Telebirr QR item counts as failed unless Telebirr confirms it", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => { throw new Error("ETIMEDOUT"); }));
    const res = await batchPOST(req("/api/verify/batch", { receipts: [{ bank: "telebirr", qrData: telebirrQr("QRT2A1B2C3") }] }));
    const body = await res.json();
    expect(body.verified).toBe(0);
    expect(body.failed).toBe(1);
  });

  it("/api/banks lists the receipt QR as a checkable input-only format", async () => {
    const body = await (await banksGET()).json();
    const tb = body.banks.find((b: { id: string }) => b.id === "telebirr");
    const qr = tb.formats.find((f: { id: string }) => f.id === "telebirr-receipt-qr");
    expect(qr).toMatchObject({ status: "current", inputs: ["qr"], supported: true, confidence: "verified" });
    expect(tb.formats[0].id).toBe("telebirr-receipt-html");
  });
});

describe("manifest: input-only formats", () => {
  const telebirr = getBank("telebirr")!;

  it("Telebirr's receipt QR is input-only, via the HTML receipt, never fetched", () => {
    const qr = telebirr.formats!.find((f) => f.id === "telebirr-receipt-qr")!;
    expect(isInputOnlyFormat(qr)).toBe(true);
    expect(qr.parser).toBeUndefined();
    expect(qr.endpoint).toBeUndefined();
    expect(qr.linkHosts).toBeUndefined();
    expect(supportedFormats(telebirr).map((f) => f.id)).toEqual(["telebirr-receipt-html"]);
    expect(primaryFormat(telebirr)?.id).toBe("telebirr-receipt-html");
    expect(secondaryFormats(telebirr)).toEqual([]);
    expect(inputOnlyFormats(telebirr).map((f) => f.id)).toEqual(["telebirr-receipt-qr"]);
    expect(selectFormat(telebirr, { reference: SYNTHETIC_REF })).toMatchObject({ ok: true, format: { id: "telebirr-receipt-html" } });
  });

  it("every input-only format points at a supported format of the same bank", () => {
    for (const bank of getAllBanks()) {
      for (const f of inputOnlyFormats(bank)) {
        const target = bank.formats!.find((x) => x.id === f.via);
        expect(target, `${bank.id}:${f.id} via ${f.via}`).toBeTruthy();
        expect(isCheckableFormat(bank, f), `${bank.id}:${f.id}`).toBe(true);
        expect(target && isInputOnlyFormat(target)).toBe(false);
      }
    }
  });

  it("the QR format has a dated changelog entry", () => {
    expect(telebirr.endpointHistory?.some((e) => e.formatId === "telebirr-receipt-qr")).toBe(true);
  });
});
