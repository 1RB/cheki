/**
 * CBE Birr (live, beta since 2026-10-16): the PDF-or-HTML parser runs
 * through safeFetch (allowlisted host, PDF size cap since the body is read as
 * bytes, no 4xx retries) and its result goes through the shared gate. The
 * PDF here is the synthetic fixture laid out like the real receipts.
 */
import { describe, it, expect, afterEach, vi } from "vitest";

import { readFileSync } from "node:fs";
import { join } from "node:path";
import { Verifier, errorToHttpStatus } from "@/lib";
import { CBEBIRR_EMPTY_SHELL_MESSAGE } from "@/lib/core/verifier";
import { CBEBirrParser } from "@/lib/parsers/cbebirr";
import { allowedHosts, isAllowedUrl } from "@/lib/security/hosts";
import { MAX_PDF_BYTES, MAX_TEXT_BYTES } from "@/lib/http/safe-fetch";
import { getBank } from "@/lib/manifest/loader";
import { buildSyntheticCbeBirrPdf } from "../fixtures/cbebirr/synthetic-receipt";
import "@/lib/parsers";

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

const PHONE = "251911223344";

function receipt(opts: { receipt?: string; status?: string; amount?: string } = {}): string {
  return `<!DOCTYPE html><html><head><title>Auto Receipt</title></head><body><table>
<tr><td>Debit Account</td><td>2519XXXX4321</td></tr>
<tr><td>Credit Account</td><td>1000XXXXX8765</td></tr>
<tr><td>Receiver Name</td><td>SAMPLE SHOP</td></tr>
<tr><td>Transaction Status</td><td>${opts.status ?? "Completed"}</td></tr>
<tr><td>Receipt Number</td><td>${opts.receipt ?? "CHK0000002"}</td></tr>
<tr><td>Transaction Date</td><td>2026-10-02 09:30</td></tr>
<tr><td>Paid amount</td><td>${opts.amount ?? "2,000.00 ETB"}</td></tr>
</table></body></html>`;
}

const SHELL = `<!DOCTYPE html><html><head><title>Auto Receipt</title><link class="Telerik_stylesheet" /></head>
<body><form><script>var x = { ReportViewerID: "ReportViewer1" };</script><div id="ReportViewer1"></div>${" ".repeat(600)}</form></body></html>`;

const html = (body: string | Uint8Array, status = 200) =>
  new Response(body as BodyInit, { status, headers: { "content-type": "text/html; charset=utf-8" } });

describe("CBE Birr host and fetch", () => {
  it("the manifest host is allowlisted and look-alikes are not", () => {
    expect(allowedHosts().has("cbepay1.cbe.com.et")).toBe(true);
    expect(isAllowedUrl("https://cbepay1.cbe.com.et/aureceipt?TID=CHK0000002&PH=" + PHONE)).toBe(true);
    expect(isAllowedUrl("https://cbepay1.cbe.com.et.evil.example/aureceipt")).toBe(false);
    expect(isAllowedUrl("http://cbepay1.cbe.com.et/aureceipt")).toBe(false);
  });

  it("reads the body as bytes under the PDF cap, not the 2 MB text cap", async () => {
    const big = new Uint8Array(MAX_TEXT_BYTES + 1024).fill(0x20);
    vi.stubGlobal("fetch", vi.fn(async () => html(big)));
    const r = await new CBEBirrParser().fetchReceipt("CHK0000002", undefined, PHONE);
    expect(r.ok).toBe(true);
    if (r.ok) expect(Buffer.isBuffer(r.value.data)).toBe(true);
  });

  it("refuses a body over the PDF cap without retrying", async () => {
    const fetchMock = vi.fn(async () => html(new Uint8Array(MAX_PDF_BYTES + 1024)));
    vi.stubGlobal("fetch", fetchMock);
    const r = await new CBEBirrParser().fetchReceipt("CHK0000002", undefined, PHONE);
    expect(r.ok).toBe(false);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("follows no redirect off the allowlist", async () => {
    const fetchMock = vi.fn(async () => new Response(null, { status: 302, headers: { location: "http://169.254.169.254/latest" } }));
    vi.stubGlobal("fetch", fetchMock);
    const r = await new CBEBirrParser().fetchReceipt("CHK0000002", undefined, PHONE);
    expect(r.ok).toBe(false);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });
});

const pdfResponse = (body: Buffer) =>
  new Response(new Uint8Array(body), { status: 200, headers: { "content-type": "application/pdf" } });

describe("CBE Birr through parseResponse and the gate", () => {
  it("is live and labelled beta in the manifest", () => {
    const b = getBank("cbebirr");
    expect(b?.status).toBe("live");
    expect(b?.beta).toBe(true);
  });

  it("verifies a receipt PDF laid out like the real ones, with phones masked", async () => {
    const fetchMock = vi.fn(async () => pdfResponse(buildSyntheticCbeBirrPdf()));
    vi.stubGlobal("fetch", fetchMock);
    const r = await new Verifier().verify({ bank: "cbebirr", reference: "DTS41AB2C90", phoneNumber: "0911004321" });
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.value).toMatchObject({
      verified: true,
      bankCode: "cbebirr",
      reference: "DTS41AB2C90",
      amount: 1250.5,
      senderName: "ABEBE KEBEDE",
      senderAccount: "09****4321",
      receiverName: "TIGIST ALEMU",
      receiverAccount: "09****6171",
      date: "2026-10-01 09:15",
      transactionStatus: "Completed",
    });
    expect(String((fetchMock.mock.calls[0] as unknown[])[0])).toBe("https://cbepay1.cbe.com.et/aureceipt?TID=DTS41AB2C90&PH=251911004321");
  });

  it("the gate rejects a receipt PDF for a different receipt number or a failed transfer", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => pdfResponse(buildSyntheticCbeBirrPdf({ receiptNumber: "DTS41AB2C91" }))));
    expect((await new Verifier().verify({ bank: "cbebirr", reference: "DTS41AB2C90", phoneNumber: "0911004321" })).ok).toBe(false);
    vi.stubGlobal("fetch", vi.fn(async () => pdfResponse(buildSyntheticCbeBirrPdf({ status: "Failed" }))));
    expect((await new Verifier().verify({ bank: "cbebirr", reference: "DTS41AB2C90", phoneNumber: "0911004321" })).ok).toBe(false);
  });

  it("a PDF that is not a readable receipt is an extraction error, not a verification", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => pdfResponse(Buffer.from("%PDF-1.4 broken"))));
    const r = await new Verifier().verify({ bank: "cbebirr", reference: "DTS41AB2C90", phoneNumber: "0911004321" });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error.kind).toBe("EXTRACTION_ERROR");
  });

  it("verifies a genuine HTML receipt", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => html(receipt())));
    const r = await new Verifier().verify({ bank: "cbebirr", reference: "CHK0000002", phoneNumber: PHONE });
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.value.verified).toBe(true);
      expect(r.value.amount).toBe(2000);
      expect(r.value.bankCode).toBe("cbebirr");
    }
  });

  it("the gate rejects a receipt number that is not the one requested", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => html(receipt({ receipt: "CHK9999999" }))));
    const r = await new Verifier().verify({ bank: "cbebirr", reference: "CHK0000002", phoneNumber: PHONE });
    expect(r.ok).toBe(false);
  });

  it("the gate rejects a failed or reversed transaction", async () => {
    for (const status of ["Failed", "Reversed", "Pending"]) {
      vi.stubGlobal("fetch", vi.fn(async () => html(receipt({ status }))));
      const r = await new Verifier().verify({ bank: "cbebirr", reference: "CHK0000002", phoneNumber: PHONE });
      expect(r.ok, status).toBe(false);
    }
  });

  it("the empty Telerik shell is never verified and never called not-found: it hands back the receipt link", async () => {
    // A receipt number and phone that don't match give this shell, so a typo
    // looks the same as a fake: "could not confirm", with a hint to check.
    for (const body of [SHELL, readFileSync(join(__dirname, "../fixtures/cbebirr/empty-shell.html"), "utf8")]) {
      vi.stubGlobal("fetch", vi.fn(async () => html(body)));
      const r = await new Verifier().verify({ bank: "cbebirr", reference: "DTS41AB2C90", phoneNumber: "0911223344" });
      expect(r.ok).toBe(false);
      if (r.ok) continue;
      expect(r.error.kind).toBe("ENDPOINT_ERROR");
      if (r.error.kind !== "ENDPOINT_ERROR") continue;
      expect(r.error.message).toBe(CBEBIRR_EMPTY_SHELL_MESSAGE);
      expect(r.error.message).toMatch(/receipt number and payer phone number may not match/);
      expect(r.error.fallbackUrl).toBe("https://cbepay1.cbe.com.et/aureceipt?TID=DTS41AB2C90&PH=251911223344");
      expect(errorToHttpStatus(r.error)).toBe(502);
    }
  });

  it("sends the phone as 251XXXXXXXXX whatever form it was typed in", async () => {
    const fetchMock = vi.fn(async () => html(receipt({ receipt: "DTS41AB2C90" })));
    vi.stubGlobal("fetch", fetchMock);
    const r = await new Verifier().verify({ bank: "cbebirr", reference: "DTS41AB2C90", phoneNumber: "+251 711 223 344" });
    expect(r.ok).toBe(true);
    expect(String((fetchMock.mock.calls[0] as unknown[])[0])).toBe("https://cbepay1.cbe.com.et/aureceipt?TID=DTS41AB2C90&PH=251711223344");
  });

  it("refuses a phone that is not an Ethiopian mobile number before any fetch", async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
    const r = await new Verifier().verify({ bank: "cbebirr", reference: "DTS41AB2C90", phoneNumber: "0811223344" });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error.kind).toBe("MISSING_INPUT");
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("a 4xx is answered once, never retried", async () => {
    const fetchMock = vi.fn(async () => html("nope", 403));
    vi.stubGlobal("fetch", fetchMock);
    const r = await new Verifier().verify({ bank: "cbebirr", reference: "CHK0000002", phoneNumber: PHONE });
    expect(r.ok).toBe(false);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("bad references and phones never reach the network", async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
    const v = new Verifier();
    expect((await v.verify({ bank: "cbebirr", reference: "CHK/../x", phoneNumber: PHONE })).ok).toBe(false);
    expect((await v.verify({ bank: "cbebirr", reference: "CHK0000002", phoneNumber: "12&x=1" })).ok).toBe(false);
    expect(fetchMock).not.toHaveBeenCalled();
  });
});

describe("CBE Birr parsing is linear (ReDoS)", () => {
  const cases: Array<[string, string]> = [
    ["stray <", "<".repeat(100_000)],
    ["unclosed <td", "</td><td ".repeat(20_000)],
    ["Debit Account without Credit Account", "Debit Account ".repeat(8_000)],
    ["Reference then whitespace", "\nReference" + " ".repeat(100_000)],
    ["colon/space runs", "Receiver Name:" + " :".repeat(50_000) + "x"],
    ["numbers without Paid amount", "1 ".repeat(50_000)],
    ["Payment Channel then newlines", "Payment Channel" + "\n ".repeat(50_000)],
    ["Sub city without Wereda", "Sub city: " + "A ".repeat(50_000)],
  ];
  for (const [name, payload] of cases) {
    it(name, () => {
      const t0 = performance.now();
      CBEBirrParser.parseText(payload);
      CBEBirrParser.htmlToText(payload);
      new CBEBirrParser().parse(payload, "text/html");
      expect(performance.now() - t0).toBeLessThan(300);
    });
  }
});
