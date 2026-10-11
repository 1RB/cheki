/**
 * M-Pesa Ethiopia: getReceipt answers with a JSON envelope carrying a base64
 * PDF. All receipts here are SYNTHETIC (tests/fixtures/mpesa/synthetic-receipt.ts):
 * cheki has never observed a real M-Pesa receipt because the endpoint is
 * geo-blocked; the envelope and the labels are inferred from other verifiers.
 */
import { describe, it, expect, afterEach, vi } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { NextRequest } from "next/server";
import { Verifier } from "@/lib";
import { POST as parsePOST } from "@/app/api/parse/route";
import { ok } from "@/lib/core/types";
import { MpesaParser, MAX_BASE64_CHARS, MAX_ENVELOPE_BYTES } from "@/lib/parsers/mpesa";
import { getParser } from "@/lib/parsers/registry";
import { verificationGate } from "@/lib/core/gate";
import { MAX_PDF_BYTES } from "@/lib/http/safe-fetch";
import { buildSyntheticMpesaPdf, syntheticMpesaEnvelope, SYNTHETIC_MPESA } from "../fixtures/mpesa/synthetic-receipt";
import "@/lib/parsers";

afterEach(() => {
  vi.restoreAllMocks();
});

const REF = SYNTHETIC_MPESA.transactionId;

describe("synthetic fixture", () => {
  it("the committed PDF is the builder's output and says it is synthetic", () => {
    const committed = readFileSync(join(__dirname, "../fixtures/mpesa/synthetic-receipt.pdf"));
    expect(committed.equals(buildSyntheticMpesaPdf())).toBe(true);
    expect(committed.toString("latin1")).toContain("SYNTHETIC TEST FIXTURE - NOT A REAL M-PESA RECEIPT");
  });
});

describe("MpesaParser.decodeEnvelope", () => {
  it("accepts the documented envelope and returns the PDF bytes", () => {
    const env = MpesaParser.decodeEnvelope(syntheticMpesaEnvelope());
    expect(env.ok).toBe(true);
    if (env.ok) expect(env.pdf.subarray(0, 5).toString("latin1")).toBe("%PDF-");
  });

  it("accepts base64 wrapped with line breaks", () => {
    const b64 = buildSyntheticMpesaPdf().toString("base64").replace(/(.{76})/g, "$1\r\n");
    expect(MpesaParser.decodeEnvelope(JSON.stringify({ responseCode: "0", base64Data: b64 })).ok).toBe(true);
  });

  it("treats a non-zero responseCode as no receipt, and keeps a cleaned description", () => {
    const env = MpesaParser.decodeEnvelope(JSON.stringify({ responseCode: "1", responseDescription: "Transaction not found\u0000" }));
    expect(env).toMatchObject({ ok: false, reason: "upstream-error", description: "Transaction not found" });
  });

  it.each([
    ["not JSON", "<html>Forbidden</html>", "not-json"],
    ["an array", "[]", "not-object"],
    ["{}", "{}", "upstream-error"],
    ["a gateway error", '{"message":"Forbidden","status":403}', "upstream-error"],
    ["no base64Data", '{"responseCode":"0"}', "missing-pdf"],
    ["base64Data not a string", '{"responseCode":"0","base64Data":12}', "missing-pdf"],
  ])("rejects %s", (_name, body, reason) => {
    expect(MpesaParser.decodeEnvelope(body)).toMatchObject({ ok: false, reason });
  });

  it.each([
    ["characters outside the alphabet", "JVBERi0x!!==", "bad-base64"],
    ["a length that is not a multiple of 4", "JVBERi0", "bad-base64"],
    ["padding in the middle", "JV==BERi0xLjQK", "bad-base64"],
    ["base64url characters", "JVBERi0x_-4K", "bad-base64"],
    ["valid base64 that is not a PDF", Buffer.from("<html>nope</html>").toString("base64"), "not-pdf"],
  ])("rejects malformed base64: %s", (_name, base64Data, reason) => {
    expect(MpesaParser.decodeEnvelope(JSON.stringify({ responseCode: "0", base64Data }))).toMatchObject({ ok: false, reason });
  });

  it("rejects an oversized payload before decoding (envelope cap and PDF cap)", () => {
    expect(MAX_BASE64_CHARS).toBe(Math.ceil(MAX_PDF_BYTES / 3) * 4);
    const tooLongB64 = "A".repeat(MAX_BASE64_CHARS + 4);
    expect(MpesaParser.decodeEnvelope(JSON.stringify({ responseCode: "0", base64Data: tooLongB64 }))).toMatchObject({
      ok: false,
      reason: "too-large",
    });
    const hugeBody = Buffer.alloc(MAX_ENVELOPE_BYTES + 1, 0x20);
    expect(MpesaParser.decodeEnvelope(hugeBody)).toMatchObject({ ok: false, reason: "too-large" });
  });

  it("the fetch cap fits a 5 MB PDF in base64, and no more than the envelope cap", () => {
    class Probe extends MpesaParser {
      cap() {
        return this.maxBytes;
      }
      headers() {
        return this.requestHeaders();
      }
    }
    const p = new Probe();
    expect(p.cap()).toBe(MAX_ENVELOPE_BYTES);
    expect(p.cap()).toBeGreaterThan(MAX_BASE64_CHARS);
    expect(p.headers()).toMatchObject({ Referer: "https://m-pesabusiness.safaricom.et/" });
  });
});

describe("MpesaParser PDF fields", () => {
  it("reads every field from the synthetic receipt PDF", async () => {
    const { parsed, envelope } = await MpesaParser.parseEnvelope(syntheticMpesaEnvelope());
    expect(envelope.ok).toBe(true);
    expect(parsed).toMatchObject({
      verified: true,
      reference: REF,
      invoiceNumber: SYNTHETIC_MPESA.receiptNo,
      amount: 1500,
      settledAmount: 1500,
      totalPaid: 1500,
      serviceFee: 0,
      serviceFeeVat: 0,
      currency: "ETB",
      date: "2026-09-14 10:21:33",
      senderName: "SYNTHETIC TEST PAYER",
      senderAccount: "251700000001",
      receiverName: "SYNTHETIC TEST MERCHANT",
      receiverAccount: "251700000002",
      transactionType: "Pay Merchant",
      paymentChannel: "APP",
    });
    expect(parsed.transactionStatus).toBeUndefined();
    expect(verificationGate(parsed, { bankId: "mpesa", requestedReference: REF })).toEqual({ ok: true });
  });

  it("reads flowed text (one long line) the same way", () => {
    const flowed =
      "Safaricom M-PESA TRANSACTION INFORMATION RECEIPT NO PAYMENT DATE SETTLED AMOUNT UCK0SYNTH12026-09-14 10:21:33 1,500.00 " +
      "TRANSACTION DETAIL / SENDER NAME SYNTHETIC TEST PAYER / SENDER NUMBER 251700000001 / TRANSACTION ID UCK0SYNTH1 " +
      "/ TOTAL 1,500.00 Birr / TOTAL AMOUNT IN WORDS One Thousand Five Hundred Birr SCAN TO VERIFY";
    const r = MpesaParser.parsePdfText(flowed);
    expect(r).toMatchObject({ verified: true, reference: "UCK0SYNTH1", invoiceNumber: "UCK0SYNTH1", amount: 1500, senderName: "SYNTHETIC TEST PAYER" });
    expect(r.amountInWords).toBe("One Thousand Five Hundred Birr");
  });

  it("reads the bilingual labels and the older PAYER / RECEIVER NUMBER labels", () => {
    const r = MpesaParser.parseLines([
      "የክፍያ ደረሰኝ ቁጥር / RECEIPT NO  የክፍያ ቀን / PAYMENT DATE  የተከፈለ መጠን / SETTLED AMOUNT",
      "UCK0SYNTH2  2026-09-15 08:00:00  250.00",
      "የከፋይ ስም / PAYER NAME  SYNTHETIC PAYER",
      "PAYER PHONE NUMBER  251700000003",
      "የተቀባዩ ቢዝነስ ስም / RECEIVER BUSINESS NAME  SYNTHETIC SHOP",
      "RECEIVER NUMBER  251700000004",
      "TRANSACTION ID  UCK0SYNTH2",
      "TOTAL  250.00",
    ]);
    expect(r).toMatchObject({
      verified: true,
      reference: "UCK0SYNTH2",
      amount: 250,
      senderName: "SYNTHETIC PAYER",
      senderAccount: "251700000003",
      receiverName: "SYNTHETIC SHOP",
      receiverAccount: "251700000004",
    });
  });

  it("prefers TOTAL AMOUNT IN WORDS over TOTAL at the same place, and skips placeholder values", () => {
    const r = MpesaParser.parseLines(["TOTAL AMOUNT IN WORDS  Ten Birr", "SENDER NAME  - - -", "RECEIVER NAME  null", "TRANSACTION ID UCK0SYNTH3"]);
    expect(r.totalPaid).toBeUndefined();
    expect(r.amountInWords).toBe("Ten Birr");
    expect(r.senderName).toBeUndefined();
    expect(r.receiverName).toBeUndefined();
    expect(r.verified).toBe(false);
  });

  it("does not verify without a transaction id, an amount or a party", () => {
    expect(MpesaParser.parseLines(["SENDER NAME A", "TOTAL 10.00"]).verified).toBe(false);
    expect(MpesaParser.parseLines(["SENDER NAME A", "TRANSACTION ID UCK0SYNTH4"]).verified).toBe(false);
    expect(MpesaParser.parseLines(["TRANSACTION ID UCK0SYNTH4", "TOTAL 10.00"]).verified).toBe(false);
    expect(MpesaParser.parseLines(["TRANSACTION ID UCK0SYNTH4", "TOTAL 0.00", "SENDER NAME A"]).verified).toBe(false);
  });

  it("the old flat-JSON shape is not a receipt any more", () => {
    const flat = '{"responseCode":"0","transactionId":"AB123456","amount":"1,250.00","senderName":"A","receiverName":"B"}';
    expect(new MpesaParser().parse(flat, "application/json").verified).toBe(false);
    expect(MpesaParser.decodeEnvelope(flat)).toMatchObject({ ok: false, reason: "missing-pdf" });
  });

  it("stays linear on 100k-character hostile input (ReDoS)", () => {
    const hostile = [
      "TOTAL ".repeat(16_667),
      "1".repeat(100_000),
      "1,".repeat(50_000),
      "PAYER NAME " + "A ".repeat(50_000),
      " ".repeat(99_999) + "x",
      "/".repeat(100_000),
      "2026-09-14 ".repeat(9_091),
      "RECEIPT NO PAYMENT DATE SETTLED AMOUNT " + "A".repeat(100_000),
      "ሀ".repeat(100_000),
    ];
    const started = performance.now();
    for (const h of hostile) {
      expect(h.length).toBeGreaterThanOrEqual(99_000);
      MpesaParser.parsePdfText(h);
      MpesaParser.parseLines(Array.from({ length: Math.ceil(h.length / 1000) }, (_, i) => h.slice(i * 1000, i * 1000 + 1000)));
      MpesaParser.decodeEnvelope(JSON.stringify({ responseCode: "0", base64Data: h }));
    }
    expect(performance.now() - started).toBeLessThan(1500);
  });
});

describe("Verifier with M-Pesa (fetch stubbed, envelope through the shared gate)", () => {
  const v = new Verifier();
  let n = 0;
  /** Distinct per test so the verifier's receipt cache never answers. */
  const ref = (prefix: string) => `${prefix}${String(Date.now()).slice(-4)}${++n}`.slice(0, 10).toUpperCase();
  const stub = (body: string) =>
    vi.spyOn(getParser("mpesa")!, "fetchReceipt").mockResolvedValue(ok({ status: 200, data: body, contentType: "application/json" }));

  it("a valid receipt verifies", async () => {
    const id = ref("UCKA");
    stub(syntheticMpesaEnvelope({ transactionId: id, receiptNo: id }));
    const r = await v.verify({ bank: "mpesa", reference: id });
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.value).toMatchObject({ verified: true, bankCode: "mpesa", reference: id, amount: 1500, senderName: "SYNTHETIC TEST PAYER" });
      expect("raw" in r.value).toBe(false);
    }
  });

  it("a receipt for a different transaction is rejected (mismatched reference)", async () => {
    stub(syntheticMpesaEnvelope({ transactionId: "UCK0OTHER9", receiptNo: "UCK0OTHER9" }));
    const r = await v.verify({ bank: "mpesa", reference: ref("UCKB") });
    expect(r.ok).toBe(false);
    if (!r.ok && "message" in r.error) expect(r.error.message).toMatch(/different reference/);
  });

  it("the reference compared and returned is the one read from the PDF, never the requested one echoed back", async () => {
    const id = ref("UCKG");
    // Neither a TRANSACTION ID row nor a receipt-number row: nothing to compare, so it must not verify.
    const pdf = buildSyntheticMpesaPdf({ transactionId: "-", receiptNo: "" });
    stub(JSON.stringify({ responseCode: "0", base64Data: pdf.toString("base64") }));
    const r = await v.verify({ bank: "mpesa", reference: id });
    expect(r.ok).toBe(false);
    const { parsed } = await MpesaParser.parseEnvelope(JSON.stringify({ responseCode: "0", base64Data: pdf.toString("base64") }));
    expect(parsed.reference).toBeUndefined();
    expect(parsed.verified).toBe(false);
  });

  it("a failed transaction status is rejected", async () => {
    const id = ref("UCKC");
    stub(syntheticMpesaEnvelope({ transactionId: id, receiptNo: id, status: "FAILED" }));
    const r = await v.verify({ bank: "mpesa", reference: id });
    expect(r.ok).toBe(false);
    if (!r.ok && "message" in r.error) expect(r.error.message).toMatch(/FAILED/);
  });

  it("an upstream error code is no receipt", async () => {
    stub(JSON.stringify({ responseCode: "1", responseDescription: "Transaction not found" }));
    const r = await v.verify({ bank: "mpesa", reference: ref("UCKD") });
    expect(r.ok).toBe(false);
    if (!r.ok) {
      expect(r.error.kind).toBe("EXTRACTION_ERROR");
      if ("message" in r.error) expect(r.error.message).toMatch(/did not return a receipt.*Transaction not found/);
    }
  });

  it("malformed base64 is rejected", async () => {
    stub(JSON.stringify({ responseCode: "0", base64Data: "%%%not-base64%%%" }));
    const r = await v.verify({ bank: "mpesa", reference: ref("UCKE") });
    expect(r.ok).toBe(false);
    if (!r.ok && "message" in r.error) expect(r.error.message).toMatch(/did not return a valid receipt/);
  });

  it("an oversized payload is rejected", async () => {
    stub(JSON.stringify({ responseCode: "0", base64Data: "A".repeat(MAX_BASE64_CHARS + 4) }));
    const r = await v.verify({ bank: "mpesa", reference: ref("UCKF") });
    expect(r.ok).toBe(false);
    if (!r.ok && "message" in r.error) expect(r.error.message).toMatch(/larger than cheki accepts/);
  });
});

describe("/api/parse with M-Pesa (paste fallback, never verified)", () => {
  let ip = 0;
  const post = (body: unknown, contentType = "application/json") =>
    parsePOST(
      new NextRequest("https://cheki.et/api/parse", {
        method: "POST",
        headers: { "content-type": contentType, "x-forwarded-for": `10.77.0.${++ip}` },
        body: typeof body === "string" ? body : JSON.stringify(body),
      })
    );
  // A synthetic receipt padded to a realistic size (embedded fonts and a QR make real PDFs larger).
  const bigPdf = () => {
    const pdf = buildSyntheticMpesaPdf();
    return Buffer.concat([pdf, Buffer.from(`\n%${"x".repeat(400 * 1024)}\n`)]);
  };
  const envelopeFor = (pdf: Buffer) => JSON.stringify({ responseCode: "0", base64Data: pdf.toString("base64") });

  it("reads a pasted envelope over 256 KB, as parsed (not verified), with the PDF's own reference", async () => {
    const content = envelopeFor(bigPdf());
    expect(content.length).toBeGreaterThan(256 * 1024);
    const r = await post({ bank: "mpesa", content });
    const data = await r.json();
    expect(r.status).toBe(200);
    expect(data).toMatchObject({ verified: false, parsed: true, reference: REF, amount: 1500 });
  });

  it("reads pasted receipt text", async () => {
    const data = await (await post({ bank: "mpesa", content: "TRANSACTION ID UCK0SYNTH1\nSENDER NAME A PAYER\nTOTAL 20.00 Birr" })).json();
    expect(data).toMatchObject({ verified: false, parsed: true, reference: "UCK0SYNTH1", amount: 20 });
  });

  it("keeps the 256 KB cap for other banks, for non-envelope M-Pesa content, and for non-JSON requests", async () => {
    const big = "1".repeat(300 * 1024);
    expect((await post({ bank: "telebirr", content: big })).status).toBe(413);
    expect((await post({ bank: "mpesa", content: big })).status).toBe(413);
    expect((await post({ bank: "mpesa", html: envelopeFor(bigPdf()) })).status).toBe(413);
    expect((await post({ bank: "mpesa", content: envelopeFor(bigPdf()) }, "text/plain")).status).toBe(413);
  });

  it("refuses anything over the M-Pesa paste cap", async () => {
    const r = await post({ bank: "mpesa", content: `{"base64Data":"${"A".repeat(4 * 1024 * 1024)}"}` });
    expect(r.status).toBe(413);
  });
});
