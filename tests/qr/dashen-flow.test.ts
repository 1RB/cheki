/**
 * A Dashen Super App receipt QR only supplies the FT Ref. Everywhere it enters
 * (detection, verifier, API) it must behave exactly like the typed FT Ref, the
 * raw token must never be sent to the bank (it answers HTTP 401 for it), and
 * the QR alone must never produce a verified result. Payloads are synthetic
 * (tests/fixtures/dashen-qr.ts).
 */
import { describe, it, expect, afterEach, vi } from "vitest";
import { NextRequest } from "next/server";
import { Verifier } from "@/lib";
import { detectInput } from "@/lib/verify/detect";
import { DASHEN_NOT_FOUND } from "@/lib/parsers/dashen";
import { getBank } from "@/lib/manifest/loader";
import { inputOnlyFormats, isInputOnlyFormat, primaryFormat, secondaryFormats, selectFormat, supportedFormats } from "@/lib/manifest/formats";
import { POST as verifyPOST } from "@/app/api/verify/route";
import { SYNTHETIC_NONCE, SYNTHETIC_QR, SYNTHETIC_REF, dashenQr } from "../fixtures/dashen-qr";

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

const RECEIPT_URL = `https://receipts.dashenbanksc.com/receipt/${SYNTHETIC_REF}`;

/** A Dashen HTML receipt for `ref` (synthetic). */
function receiptHtml(ref: string = SYNTHETIC_REF, amount = "12,600.00"): string {
  return `<!DOCTYPE html><html><head><script>var x = "<div>";</script></head><body>
    <h1>Dashen Bank Super App Electronic Receipt</h1>
    <div><span>Sender Name:</span><span>Test Sender</span></div>
    <div><span>Sender Account Number:</span><span>2912******911</span></div>
    <div><span>Narrative:</span><span>Course fee</span></div>
    <div><span>Receiver Name:</span><span>Test Receiver</span></div>
    <div><span>Receiver Account Number:</span><span>7938******911</span></div>
    <div><span>Transaction Reference:</span><span>${ref}</span></div>
    <div><span>Transaction Date:</span><span>Jul 9, 2026, 10:25:33 pm</span></div>
    <table><tr><td>Transaction Amount</td><td>ETB ${amount}</td></tr>
    <tr><td>Total</td><td>ETB ${amount}</td></tr></table></body></html>`;
}

const html = (body: string, status = 200) =>
  new Response(body, { status, headers: { "content-type": "text/html; charset=utf-8" } });

let ip = 0;
const req = (url: string, body: unknown) =>
  new NextRequest(`https://cheki.et${url}`, {
    method: "POST",
    headers: { "content-type": "application/json", "x-real-ip": `10.88.${Math.floor(++ip / 250)}.${ip % 250}` },
    body: JSON.stringify(body),
  });

/** Every URL that was fetched, as strings. */
const fetched = (fetchMock: { mock: { calls: unknown[][] } }) => fetchMock.mock.calls.map((c) => String(c[0]));

describe("detectInput", () => {
  it("a Dashen Super App QR becomes its FT Ref, Dashen, ready to check", () => {
    const d = detectInput(SYNTHETIC_QR);
    expect(d.kind).toBe("dashenQr");
    expect(d.value).toBe(SYNTHETIC_REF);
    expect(d.bank?.code).toBe("dashen");
    expect(d.candidates.map((b) => b.code)).toEqual(["dashen"]);
    expect(d.format?.id).toBe("dashen-receipts-html");
    expect(d.needsAccount).toBe(false);
    expect(d.needsPhone).toBe(false);
    // Dashen answers cloud servers, so nothing is held back for the browser.
    expect(d.browserFirst).toBe(false);
    expect(d.overridden).toBe(false);
  });

  it("is the same check as typing the FT Ref on the Dashen page", () => {
    const fromQr = detectInput(SYNTHETIC_QR, { lockedBank: "dashen" });
    const typed = detectInput(SYNTHETIC_REF, { lockedBank: "dashen" });
    expect(fromQr.bank?.code).toBe(typed.bank?.code);
    expect(fromQr.value).toBe(typed.value);
    expect(fromQr.format?.id).toBe(typed.format?.id);
    expect(fromQr.needsAccount).toBe(typed.needsAccount);
    expect(fromQr.needsPhone).toBe(typed.needsPhone);
    expect(fromQr.browserFirst).toBe(typed.browserFirst);
  });

  it("names its own bank: on another bank's page it is reported, not re-routed", () => {
    const d = detectInput(SYNTHETIC_QR, { lockedBank: "telebirr" });
    expect(d.bank?.code).toBe("dashen");
    expect(d.kind).toBe("dashenQr");
  });

  it("a chosen bank does not override it", () => {
    expect(detectInput(SYNTHETIC_QR, { overrideBank: "cbe" }).bank?.code).toBe("dashen");
  });

  it("precedence: Dashen QR before BOA QR and links; plain input unchanged", () => {
    expect(detectInput(Buffer.alloc(96, 7).toString("base64")).kind).toBe("boaQr");
    expect(detectInput(SYNTHETIC_QR).kind).toBe("dashenQr");
    expect(detectInput(`https://receipts.dashenbanksc.com/receipt/${SYNTHETIC_REF}`).kind).toBe("url");
    expect(detectInput(SYNTHETIC_REF).kind).toBe("reference");
    expect(detectInput("").kind).toBe("empty");
  });

  it("a malformed Dashen QR is not treated as one", () => {
    const broken = dashenQr(SYNTHETIC_REF).replace("e49f6442", "00000000");
    const d = detectInput(broken);
    expect(d.kind).not.toBe("dashenQr");
    expect(d.bank?.code).not.toBe("dashen");
  });

  it("never hands the raw token to the field: the value is always the FT Ref", () => {
    for (const qr of [SYNTHETIC_QR, dashenQr(SYNTHETIC_REF, "ffffffffffffffffffffffffffffffff")]) {
      const d = detectInput(qr);
      expect(d.value).toBe(SYNTHETIC_REF);
      expect(d.value).not.toContain("superappreceipt_");
    }
    // The trailing 32 hex is opaque and never reaches the value either.
    expect(SYNTHETIC_QR).toContain(SYNTHETIC_NONCE);
  });
});

describe("Verifier: qrData", () => {
  const v = new Verifier();

  it("looks the decoded FT Ref up at Dashen, never the raw token", async () => {
    const fetchMock = vi.fn<(url: string | URL | Request) => Promise<Response>>(async () => html(receiptHtml()));
    vi.stubGlobal("fetch", fetchMock);
    const r = await v.verify({ bank: "dashen", qrData: SYNTHETIC_QR });
    expect(fetched(fetchMock)).toEqual([RECEIPT_URL]);
    // The regression this guards: the raw token answers HTTP 401 and is
    // reported as a retryable outage.
    expect(fetched(fetchMock).join()).not.toContain("superappreceipt_");
    expect(r.ok && r.value.verified).toBe(true);
    if (r.ok) {
      expect(r.value.reference).toBe(SYNTHETIC_REF);
      expect(r.value.sourceUrl).toBe(RECEIPT_URL);
      expect(r.value.bankCode).toBe("dashen");
    }
  });

  it("no bank named: the QR still goes to Dashen", async () => {
    const fetchMock = vi.fn<(url: string | URL | Request) => Promise<Response>>(async () => html(receiptHtml()));
    vi.stubGlobal("fetch", fetchMock);
    const r = await v.verify({ bank: "", qrData: SYNTHETIC_QR });
    expect(fetched(fetchMock)).toEqual([RECEIPT_URL]);
    expect(r.ok && r.value.verified).toBe(true);
  });

  it("the QR alone never verifies: Dashen has no such receipt", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => new Response('{"message":"Transaction not found"}', { status: 400, headers: { "content-type": "application/json" } }))
    );
    const r = await v.verify({ bank: "dashen", qrData: SYNTHETIC_QR });
    expect(r.ok).toBe(false);
    if (!r.ok) {
      expect(r.error.kind).toBe("EXTRACTION_ERROR");
      if (r.error.kind === "EXTRACTION_ERROR") expect(r.error.message).toBe(DASHEN_NOT_FOUND);
    }
  });

  it("the QR alone never verifies: a receipt for a different FT Ref fails the gate", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => html(receiptHtml("B22WDTI0000000XX"))));
    const r = await v.verify({ bank: "dashen", qrData: SYNTHETIC_QR });
    expect(r.ok && r.value.verified).toBeFalsy();
  });

  it("the QR alone never verifies: a page with no amount fails the gate", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => html(receiptHtml(SYNTHETIC_REF, ""))));
    const r = await v.verify({ bank: "dashen", qrData: SYNTHETIC_QR });
    expect(r.ok && r.value.verified).toBeFalsy();
  });

  it("with another bank named it is rejected before any fetch", async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
    for (const bank of ["boa", "cbe", "telebirr", "mpesa"]) {
      const r = await v.verify({ bank, qrData: SYNTHETIC_QR });
      expect(r.ok).toBe(false);
      if (!r.ok) {
        expect(r.error.kind).toBe("MISSING_INPUT");
        expect(r.error.message).toMatch(/Dashen receipt/);
      }
    }
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("a malformed Dashen QR is never resolved to a Dashen reference", async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
    const r = await v.verify({ bank: "dashen", qrData: dashenQr(SYNTHETIC_REF).replace("e49f6442", "00000000") });
    expect(r.ok).toBe(false);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("a Dashen QR is not read as a Telebirr or BOA QR on the way in", async () => {
    const fetchMock = vi.fn<(url: string | URL | Request) => Promise<Response>>(async () => html(receiptHtml()));
    vi.stubGlobal("fetch", fetchMock);
    // No bank named at all: Telebirr and BOA would both claim it first if the
    // Dashen prefix check were in the wrong place.
    const r = await v.verify({ bank: "", qrData: SYNTHETIC_QR });
    expect(fetched(fetchMock)).toEqual([RECEIPT_URL]);
    expect(r.ok && r.value.bankCode).toBe("dashen");
  });
});

describe("API", () => {
  it("/api/verify: a Dashen QR with no bank verifies through the decoded FT Ref", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => html(receiptHtml())));
    const res = await verifyPOST(req("/api/verify", { qrData: SYNTHETIC_QR }));
    const body = await res.json();
    expect(res.status).toBe(200);
    expect(body.success).toBe(true);
    expect(body.verified).toBe(true);
    expect(body.reference).toBe(SYNTHETIC_REF);
    expect(body.bankCode).toBe("dashen");
    // The response never echoes the token.
    expect(JSON.stringify(body)).not.toContain("superappreceipt_");
  });

  it("/api/verify: a Dashen QR for the wrong bank is a 400", async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
    const res = await verifyPOST(req("/api/verify", { bank: "boa", qrData: SYNTHETIC_QR }));
    expect(res.status).toBe(400);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("/api/verify: Dashen has no such receipt → not verified, nothing cached as verified", async () => {
    // Its own reference: /api/verify caches a verified result per input, and a
    // repeat of the QR above would be answered from that cache.
    const missing = dashenQr("B22WDTI00SAMPLE2");
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => new Response('{"message":"Transaction not found"}', { status: 400, headers: { "content-type": "application/json" } }))
    );
    const res = await verifyPOST(req("/api/verify", { qrData: missing }));
    const body = await res.json();
    // 422: the bank answered but did not confirm (EXTRACTION_ERROR), not a
    // client-side 400.
    expect(res.status).toBe(422);
    expect(body.success).toBe(false);
    expect(body.verified).toBeUndefined();
  });
});

describe("manifest: input-only formats", () => {
  const dashen = getBank("dashen")!;

  it("Dashen's receipt QR is input-only, via the HTML receipt, never fetched", () => {
    const qr = dashen.formats!.find((f) => f.id === "dashen-receipt-qr")!;
    expect(isInputOnlyFormat(qr)).toBe(true);
    expect(qr.via).toBe("dashen-receipts-html");
    expect(qr.parser).toBeUndefined();
    expect(qr.endpoint).toBeUndefined();
    expect(qr.linkHosts).toBeUndefined();
    expect(qr.inputs.map((i) => i.name)).toEqual(["qr"]);
    expect(supportedFormats(dashen).map((f) => f.id)).toEqual(["dashen-receipts-html"]);
    expect(primaryFormat(dashen)?.id).toBe("dashen-receipts-html");
    expect(secondaryFormats(dashen).map((f) => f.id)).toEqual(["dashen-superapp-pdf"]);
    expect(inputOnlyFormats(dashen).map((f) => f.id)).toEqual(["dashen-receipt-qr"]);
    expect(selectFormat(dashen, { reference: SYNTHETIC_REF })).toMatchObject({ ok: true, format: { id: "dashen-receipts-html" } });
  });

  it("the QR format has a dated changelog entry", () => {
    expect(dashen.endpointHistory?.some((e) => e.formatId === "dashen-receipt-qr")).toBe(true);
  });
});
