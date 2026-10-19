/**
 * CBE Birr receipt QR. On the real receipts (3 checked on 2026-10-16) the QR
 * at the bottom right is the receipt's own link:
 *   https://cbepay1.cbe.com.et/aureceipt?TID={receipt number}&PH={251XXXXXXXXX}
 * so a scan supplies both the receipt number and the payer phone. Like any QR
 * it is only an input: CBE Birr's receipt decides the verdict.
 *
 * Everything here is synthetic. tests/fixtures/cbebirr/synthetic-qr.png
 * encodes SYNTHETIC_LINK below as a version 4 QR, the version the real
 * receipts use (made with segno: version=4, error="l", scale=6, border=4).
 */
import { describe, it, expect, afterEach, vi } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { NextRequest } from "next/server";
import { Verifier } from "@/lib";
import { POST as verifyPOST } from "@/app/api/verify/route";
import { POST as ocrPOST } from "@/app/api/ocr/route";
import { decodeQrFromImage } from "@/lib/server-ocr";
import { detectInput, extraFieldProblem } from "@/lib/verify/detect";
import { getBank } from "@/lib/manifest/loader";
import { inputOnlyFormats } from "@/lib/manifest/formats";
import { buildSyntheticCbeBirrPdf } from "../fixtures/cbebirr/synthetic-receipt";
import "@/lib/parsers";

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

const SYNTHETIC_LINK = "https://cbepay1.cbe.com.et/aureceipt?TID=DTS41AB2C90&PH=251911004321";
const QR_PNG = readFileSync(join(__dirname, "../fixtures/cbebirr/synthetic-qr.png"));

const pdf = () =>
  vi.fn(async () => new Response(new Uint8Array(buildSyntheticCbeBirrPdf()), { status: 200, headers: { "content-type": "application/pdf" } }));

let ip = 0;
const freshIp = () => `10.66.${Math.floor(++ip / 250)}.${ip % 250}`;

describe("the synthetic QR image", () => {
  it("decodes to the receipt link with the server's QR reader", async () => {
    const code = await decodeQrFromImage(QR_PNG);
    expect(code?.data).toBe(SYNTHETIC_LINK);
    expect(code?.version).toBe(4);
  });

  it("/api/ocr returns CBE Birr, the receipt number and the payer phone", async () => {
    const form = new FormData();
    form.append("image", new File([new Uint8Array(QR_PNG)], "qr.png", { type: "image/png" }));
    const res = await ocrPOST(new NextRequest("http://localhost/api/ocr", { method: "POST", headers: { "x-real-ip": freshIp() }, body: form }));
    const json = await res.json();
    expect(json).toMatchObject({ success: true, source: "qr", bank: "cbebirr", reference: "DTS41AB2C90", phoneNumber: "251911004321" });
  });
});

describe("detection in the verify panel", () => {
  it("a scanned CBE Birr QR is the link flow: CBE Birr, receipt number from TID, no phone to type", () => {
    const d = detectInput(SYNTHETIC_LINK);
    expect(d.kind).toBe("url");
    expect(d.bank?.code).toBe("cbebirr");
    expect(d.urlReference).toBe("DTS41AB2C90");
    expect(d.needsPhone).toBe(false);
    expect(d.browserFirst).toBe(false);
    expect(d.beta).toBe(true);
  });

  it("a link without PH asks for the payer phone instead of sending a check that must fail", () => {
    const d = detectInput("https://cbepay1.cbe.com.et/aureceipt?TID=DTS41AB2C90");
    expect(d.bank?.code).toBe("cbebirr");
    expect(d.needsPhone).toBe(true);
    expect(extraFieldProblem(d, "")).toBe("phone");
    expect(extraFieldProblem(d, "0911004321")).toBeNull();
    // Safaricom numbers are CBE Birr wallets too.
    expect(extraFieldProblem(d, "0711004321")).toBeNull();
  });

  it("the manifest lists the QR as an input-only format checked through the receipt link", () => {
    const [qr] = inputOnlyFormats(getBank("cbebirr"));
    expect(qr).toMatchObject({ id: "cbebirr-receipt-qr", via: "cbebirr-aureceipt", confidence: "verified" });
  });
});

describe("qrData in the verifier and /api/verify", () => {
  it("with no bank and no phone, reads both from the QR and verifies against the receipt", async () => {
    const fetchMock = pdf();
    vi.stubGlobal("fetch", fetchMock);
    const r = await new Verifier().verify({ bank: "", qrData: SYNTHETIC_LINK });
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.value).toMatchObject({ verified: true, bankCode: "cbebirr", reference: "DTS41AB2C90", amount: 1250.5, senderAccount: "09****4321" });
    expect(String((fetchMock.mock.calls[0] as unknown[])[0])).toBe(SYNTHETIC_LINK);
  });

  it("the pair in the QR wins over a typed phone", async () => {
    const fetchMock = pdf();
    vi.stubGlobal("fetch", fetchMock);
    await new Verifier().verify({ bank: "cbebirr", qrData: SYNTHETIC_LINK, phoneNumber: "0922000000" });
    expect(String((fetchMock.mock.calls[0] as unknown[])[0])).toBe(SYNTHETIC_LINK);
  });

  it("a CBE Birr QR sent with another bank is reported, never re-routed or fetched", async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
    const r = await new Verifier().verify({ bank: "cbe", qrData: SYNTHETIC_LINK });
    expect(r.ok).toBe(false);
    if (!r.ok) {
      expect(r.error.kind).toBe("MISSING_INPUT");
      expect(r.error.kind === "MISSING_INPUT" && r.error.message).toMatch(/CBE Birr receipt/);
    }
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("a look-alike host or a bad receipt number or phone never reaches the network", async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
    const v = new Verifier();
    for (const qrData of [
      "https://cbepay1.cbe.com.et.evil.example/aureceipt?TID=DTS41AB2C90&PH=251911004321",
      "https://cbepay1.cbe.com.et/aureceipt?TID=DTS41-AB2C90&PH=251911004321",
      "https://cbepay1.cbe.com.et/aureceipt?TID=DTS41AB2C90&PH=251811004321",
    ]) {
      expect((await v.verify({ bank: "", qrData })).ok, qrData).toBe(false);
    }
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("only the receipt number and phone are taken from the QR: the fetch always goes to cheki's own https URL", async () => {
    const fetchMock = pdf();
    vi.stubGlobal("fetch", fetchMock);
    await new Verifier().verify({ bank: "", qrData: "http://cbepay2.cbe.com.et/aureceipt?TID=DTS41AB2C90&PH=0911004321&x=1" });
    expect(String((fetchMock.mock.calls[0] as unknown[])[0])).toBe(SYNTHETIC_LINK);
  });

  it("the QR alone is not proof: a receipt for another number or a failed transfer is not verified", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => new Response(new Uint8Array(buildSyntheticCbeBirrPdf({ status: "Failed" })), { status: 200, headers: { "content-type": "application/pdf" } })));
    expect((await new Verifier().verify({ bank: "", qrData: SYNTHETIC_LINK })).ok).toBe(false);
  });

  it("POST /api/verify accepts the QR as qrData", async () => {
    vi.stubGlobal("fetch", pdf());
    const res = await verifyPOST(
      new NextRequest("https://cheki.et/api/verify", {
        method: "POST",
        headers: { "content-type": "application/json", "x-real-ip": freshIp() },
        body: JSON.stringify({ bank: "cbebirr", qrData: SYNTHETIC_LINK }),
      }),
    );
    expect(res.status).toBe(200);
    expect(await res.json()).toMatchObject({ success: true, verified: true, bankCode: "cbebirr", reference: "DTS41AB2C90" });
  });
});
