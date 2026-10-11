/**
 * Dashen after the merge of #28 (security) into #3 (SEO): the new HTML
 * receipt host comes from the manifest and is the only Dashen host fetched,
 * the HTML goes through parseResponse and the shared gate, and Dashen's
 * HTTP 400 for an unknown FT Ref is a not-found answer that is never retried.
 */
import { describe, it, expect, afterEach, vi } from "vitest";
import { NextRequest } from "next/server";
import { Verifier } from "@/lib";
import { DashenParser, DASHEN_NOT_FOUND } from "@/lib/parsers/dashen";
import { allowedHosts, isAllowedUrl } from "@/lib/security/hosts";
import { getBank } from "@/lib/manifest/loader";
import { GET as receiptGET } from "@/app/api/receipt/route";
import "@/lib/parsers";

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

const REF = "B22WDTI2619100WH";

function receiptHtml(opts: { ref?: string; amount?: string; extra?: string } = {}): string {
  return `<!DOCTYPE html><html><head><script>var x = "<div>";</script></head><body>
    <h1>Dashen Bank Super App Electronic Receipt</h1>
    <div><span>Sender Name:</span><span>Test Sender</span></div>
    <div><span>Sender Account Number:</span><span>2912******911</span></div>
    <div><span>Narrative:</span><span>Course fee</span></div>
    <div><span>Receiver Name:</span><span>Test Receiver</span></div>
    <div><span>Receiver Account Number:</span><span>7938******911</span></div>
    <div><span>Transaction Reference:</span><span>${opts.ref ?? REF}</span></div>
    <div><span>Transaction Date:</span><span>Jul 9, 2026, 10:25:33 pm</span></div>
    ${opts.extra ?? ""}
    <table><tr><td>Transaction Amount</td><td>ETB ${opts.amount ?? "12,600.00"}</td></tr>
    <tr><td>Total</td><td>ETB 12,600.00</td></tr></table></body></html>`;
}

const html = (body: string, status = 200) =>
  new Response(body, { status, headers: { "content-type": "text/html; charset=utf-8" } });

describe("Dashen host and allowlist", () => {
  it("allowlists the manifest host and nothing legacy", () => {
    expect(getBank("dashen")?.endpoint).toContain("receipts.dashenbanksc.com");
    expect(allowedHosts().has("receipts.dashenbanksc.com")).toBe(true);
    expect(isAllowedUrl("https://receipts.dashenbanksc.com/receipt/" + REF)).toBe(true);
    expect(isAllowedUrl("https://api.dashensuperapp.com/receipts/x.pdf")).toBe(false);
    expect(isAllowedUrl("https://receipt.dashensuperapp.com/receipt/x")).toBe(false);
    expect(isAllowedUrl("https://receipts.dashenbanksc.com.evil.example/receipt/x")).toBe(false);
  });

  it("a pasted legacy or look-alike link only donates its reference; the fetch goes to the manifest host", async () => {
    const fetchMock = vi.fn<(url: string | URL) => Promise<Response>>(async () => html(receiptHtml()));
    vi.stubGlobal("fetch", fetchMock);
    const v = new Verifier();
    const r = await v.verify({ bank: "dashen", reference: `https://receipt.dashensuperapp.com/receipt/${REF}` });
    expect(r.ok && r.value.verified).toBe(true);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(String(fetchMock.mock.calls[0][0])).toBe(`https://receipts.dashenbanksc.com/receipt/${REF}`);

    fetchMock.mockClear();
    const evil = await v.verify({ bank: "dashen", reference: `https://receipts.dashenbanksc.com.evil.example/receipt/${REF}` });
    expect(evil.ok).toBe(false);
    for (const call of fetchMock.mock.calls) expect(new URL(String(call[0])).host).toBe("receipts.dashenbanksc.com");
  });
});

describe("Dashen HTML through parseResponse and the gate", () => {
  it("verifies a genuine HTML receipt", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => html(receiptHtml())));
    const r = await new Verifier().verify({ bank: "dashen", reference: REF });
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.value.verified).toBe(true);
      expect(r.value.amount).toBe(12600);
      expect(r.value.reference).toBe(REF);
      expect(r.value.bankCode).toBe("dashen");
    }
  });

  it("the gate rejects a page whose reference differs from the one requested", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => html(receiptHtml({ ref: "B22WDTI0000000XX" }))));
    const r = await new Verifier().verify({ bank: "dashen", reference: REF });
    expect(r.ok).toBe(false);
  });

  it("a 200 page with no amount is not verified", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => html(receiptHtml({ amount: "" }))));
    const r = await new Verifier().verify({ bank: "dashen", reference: REF });
    expect(r.ok).toBe(false);
  });
});

describe("Dashen 400 = not found, never retried", () => {
  it("maps HTTP 400 'Transaction not found' to a not-found error after one request", async () => {
    const fetchMock = vi.fn(
      async () =>
        new Response('{"statusCode":400,"message":"Transaction not found"}', {
          status: 400,
          headers: { "content-type": "application/json" },
        })
    );
    vi.stubGlobal("fetch", fetchMock);
    const r = await new Verifier().verify({ bank: "dashen", reference: "WDTI5186142501962" });
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(r.ok).toBe(false);
    if (!r.ok) {
      expect(r.error.kind).toBe("EXTRACTION_ERROR");
      if (r.error.kind === "EXTRACTION_ERROR") expect(r.error.message).toBe(DASHEN_NOT_FOUND);
    }
  });

  it("still retries a 5xx once", async () => {
    const fetchMock = vi.fn(async () => new Response("bad gateway", { status: 502 }));
    vi.stubGlobal("fetch", fetchMock);
    const r = await new Verifier().verify({ bank: "dashen", reference: REF });
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error.kind).toBe("ENDPOINT_ERROR");
  });

  it("other banks keep treating 400 as a refusal, not not-found", async () => {
    const fetchMock = vi.fn(async () => new Response("bad", { status: 400 }));
    vi.stubGlobal("fetch", fetchMock);
    const r = await new Verifier().verify({ bank: "boa", reference: "FT26167ABCDE", accountNumber: "1000054321" });
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error.kind).toBe("ENDPOINT_ERROR");
  });

  it("/api/receipt answers 404 for Dashen's 400 and fetches only the manifest host", async () => {
    const fetchMock = vi.fn<(url: string | URL) => Promise<Response>>(async () => new Response('{"message":"Transaction not found"}', { status: 400 }));
    vi.stubGlobal("fetch", fetchMock);
    const r = await receiptGET(
      new NextRequest(`https://cheki.et/api/receipt?bank=dashen&reference=${REF}`, {
        headers: { "x-real-ip": "10.77.0.1" },
      })
    );
    expect(r.status).toBe(404);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(new URL(String(fetchMock.mock.calls[0][0])).host).toBe("receipts.dashenbanksc.com");
  });
});

describe("Dashen HTML flattening is linear (ReDoS)", () => {
  it("handles 100k stray '<' and unclosed <script quickly", () => {
    for (const payload of ["<".repeat(100_000), "<script".repeat(15_000), "<a ".repeat(40_000)]) {
      const t0 = performance.now();
      DashenParser.htmlToText(payload);
      expect(performance.now() - t0).toBeLessThan(200);
    }
  });

  it("decodes &amp;lt; once, not twice", () => {
    expect(DashenParser.htmlToText("<b>A &amp;lt; B</b>")).toBe("A &lt; B");
  });
});
