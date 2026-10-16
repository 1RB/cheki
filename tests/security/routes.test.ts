/**
 * API route hardening: /api/receipt open proxy (api-sec #2, receipt-poc.ts),
 * /api/parse labelling and body cap (#3, #8), batch limits and the per-IP
 * limiter (#4), and /api/health caching.
 */
import { describe, it, expect, afterEach, vi } from "vitest";
import { NextRequest } from "next/server";
import { GET as receiptGET } from "@/app/api/receipt/route";
import { POST as parsePOST } from "@/app/api/parse/route";
import { POST as batchPOST } from "@/app/api/verify/batch/route";
import { GET as healthGET } from "@/app/api/health/route";
import { RateLimiter, clientIp } from "@/lib/rate-limit";

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

let ipCounter = 0;
/** A fresh client IP per request so the per-IP limiter never interferes. */
function freshIp(): Record<string, string> {
  ipCounter++;
  return { "x-forwarded-for": `10.9.${Math.floor(ipCounter / 250)}.${ipCounter % 250}` };
}

describe("/api/receipt", () => {
  it("is not an open proxy through Object.prototype names", async () => {
    const fetchSpy = vi.fn();
    vi.stubGlobal("fetch", fetchSpy);
    for (const bank of ["constructor", "__proto__", "toString", "hasOwnProperty", "valueOf"]) {
      const url = "https://cheki.et/api/receipt?bank=" + bank + "&reference=" + encodeURIComponent("http://127.0.0.1:18081/latest/meta-data");
      const r = await receiptGET(new NextRequest(url, { headers: freshIp() }));
      expect(r.status, bank).toBe(400);
    }
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it("validates the reference and account like /api/verify", async () => {
    const fetchSpy = vi.fn();
    vi.stubGlobal("fetch", fetchSpy);
    for (const q of [
      "bank=zemen&reference=" + encodeURIComponent("../../admin"),
      "bank=zemen&reference=" + encodeURIComponent("http://127.0.0.1/x"),
      "bank=cbe&reference=FT26SAMPLE01",
      "bank=cbe&reference=FT26SAMPLE01&account=" + encodeURIComponent("12#34"),
    ]) {
      const r = await receiptGET(new NextRequest("https://cheki.et/api/receipt?" + q, { headers: freshIp() }));
      expect(r.status, q).toBe(400);
    }
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it("serves a genuine PDF privately with a fixed filename", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => new Response("%PDF-1.4 test", { status: 200 })));
    const r = await receiptGET(
      new NextRequest('https://cheki.et/api/receipt?bank=zemen&reference=ZB123456"x', { headers: freshIp() })
    );
    expect(r.status).toBe(400); // the quote is rejected by reference validation
    const ok = await receiptGET(new NextRequest("https://cheki.et/api/receipt?bank=zemen&reference=ZB123456", { headers: freshIp() }));
    expect(ok.status).toBe(200);
    expect(ok.headers.get("content-disposition")).toBe('attachment; filename="zemen-receipt.pdf"');
    expect(ok.headers.get("content-type")).toBe("application/pdf");
    expect(ok.headers.get("content-security-policy")).toBe("sandbox; default-src 'none'");
    expect(ok.headers.get("x-content-type-options")).toBe("nosniff");
    expect(ok.headers.get("cache-control")).toBe("private, no-store");
  });

  it("never serves a non-PDF body (no more receipt.bin): HTML from a PDF bank is a 502", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => new Response("<html><script>alert(1)</script></html>", { status: 200, headers: { "content-type": "text/html" } })));
    const r = await receiptGET(new NextRequest("https://cheki.et/api/receipt?bank=zemen&reference=ZB123456", { headers: freshIp() }));
    expect(r.status).toBe(502);
    expect(r.headers.get("content-type")).toMatch(/application\/json/);
    expect(await r.text()).not.toContain("<script>");
  });

  it("redirects Dashen (HTML) to Dashen's own receipt page instead of proxying it", async () => {
    const fetchSpy = vi.fn();
    vi.stubGlobal("fetch", fetchSpy);
    const r = await receiptGET(new NextRequest("https://cheki.et/api/receipt?bank=dashen&reference=B22WDTI2619100WH", { headers: freshIp() }));
    expect(r.status).toBe(302);
    expect(r.headers.get("location")).toBe("https://receipts.dashenbanksc.com/receipt/B22WDTI2619100WH");
    expect(r.headers.get("referrer-policy")).toBe("no-referrer");
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it("leads with CBE's current format: a Receipt ID redirects to mbreciept, no account needed", async () => {
    const fetchSpy = vi.fn();
    vi.stubGlobal("fetch", fetchSpy);
    const r = await receiptGET(new NextRequest("https://cheki.et/api/receipt?bank=cbe&reference=v2-hfHCxExample0001", { headers: freshIp() }));
    expect(r.status).toBe(302);
    expect(r.headers.get("location")).toBe("https://mbreciept.cbe.com.et/v2-hfHCxExample0001");
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it("still serves a legacy CBE FT reference + account as the bank's PDF", async () => {
    const fetchSpy = vi.fn(async () => new Response("%PDF-1.4 cbe", { status: 200 }));
    vi.stubGlobal("fetch", fetchSpy);
    const r = await receiptGET(new NextRequest("https://cheki.et/api/receipt?bank=cbe&reference=FT26SAMPLE01&account=1000000006171", { headers: freshIp() }));
    expect(r.status).toBe(200);
    expect(r.headers.get("content-type")).toBe("application/pdf");
    expect(String((fetchSpy.mock.calls[0] as unknown[])[0])).toContain("apps.cbe.com.et:100/?id=FT26SAMPLE0100006171");
  });
});

describe("/api/parse", () => {
  const post = (body: unknown) =>
    parsePOST(
      new NextRequest("https://cheki.et/api/parse", {
        method: "POST",
        headers: { "content-type": "application/json", ...freshIp() },
        body: typeof body === "string" ? body : JSON.stringify(body),
      })
    );

  it("never returns verified: true for pasted content", async () => {
    const content = [
      "Payer Name", "Abebe Kebede", "Credited Party name", "My Shop", "transaction status", "Completed",
      "Invoice No.", "DET1234567", "Settled Amount", "500.00 Birr",
    ].join("\n");
    const r = await post({ bank: "telebirr", content });
    const data = await r.json();
    expect(r.status).toBe(200);
    expect(data.success).toBe(true);
    expect(data.verified).toBe(false);
    expect(data.parsed).toBe(true);
    expect(data.source).toBe("client-supplied");
    expect(data.amount).toBe(500);
  });

  it("rejects bodies over 256 KB", async () => {
    const r = await post({ bank: "telebirr", content: "1".repeat(300 * 1024) });
    expect(r.status).toBe(413);
  });

  it("answers a 100k-digit paste quickly (ReDoS)", async () => {
    const t = performance.now();
    await post({ bank: "telebirr", content: "Settled Amount " + "1".repeat(100_000) });
    expect(performance.now() - t).toBeLessThan(1000);
  });

  it("does not echo a javascript: URL as the source", async () => {
    const content = "Payer Name\nA\nInvoice No.\nDET1234567\nSettled Amount\n5.00 Birr";
    const data = await (await post({ bank: "telebirr", content, url: "javascript:alert(1)" })).json();
    expect(data.sourceUrl).toBe("(via paste/bookmarklet)");
  });
});

describe("/api/verify/batch", () => {
  it("caps a batch at 20 receipts", async () => {
    const receipts = Array.from({ length: 21 }, () => ({ bank: "telebirr", reference: "DET1234567" }));
    const r = await batchPOST(
      new NextRequest("https://cheki.et/api/verify/batch", {
        method: "POST",
        headers: { "content-type": "application/json", ...freshIp() },
        body: JSON.stringify({ receipts }),
      })
    );
    expect(r.status).toBe(400);
  });
});

describe("per-IP rate limiter", () => {
  it("allows up to the limit, then refuses with a retry time", () => {
    const l = new RateLimiter(3, 60_000);
    const now = 1_000_000;
    expect(l.check("a", 1, now)).toBe(0);
    expect(l.check("a", 2, now)).toBe(0);
    expect(l.check("a", 1, now)).toBeGreaterThan(0);
    expect(l.check("b", 1, now)).toBe(0);
    expect(l.check("a", 1, now + 60_001)).toBe(0);
  });

  it("refuses a cost larger than the limit", () => {
    expect(new RateLimiter(5, 60_000).check("x", 6)).toBeGreaterThan(0);
  });

  it("reads the client IP from proxy headers", () => {
    expect(clientIp(new Headers({ "x-vercel-forwarded-for": "1.2.3.4" }))).toBe("1.2.3.4");
    // Rightmost entry: the leftmost one is whatever the client sent.
    expect(clientIp(new Headers({ "x-forwarded-for": "5.6.7.8, 9.9.9.9" }))).toBe("9.9.9.9");
  });

  it("returns 429 once a client exceeds the parse limit", async () => {
    const headers = { "content-type": "application/json", "x-forwarded-for": "10.200.200.200" };
    let last = 0;
    for (let i = 0; i < 25; i++) {
      const r = await parsePOST(
        new NextRequest("https://cheki.et/api/parse", { method: "POST", headers, body: JSON.stringify({ bank: "telebirr", content: "x" }) })
      );
      last = r.status;
    }
    expect(last).toBe(429);
  });
});

describe("/api/health", () => {
  it("probes the banks at most once per cache window", async () => {
    const fetchMock = vi.fn(async () => new Response("ok", { status: 200 }));
    vi.stubGlobal("fetch", fetchMock);
    const first = await (await healthGET()).json();
    const calls = fetchMock.mock.calls.length;
    const second = await (await healthGET()).json();
    expect(calls).toBeGreaterThan(0);
    expect(fetchMock.mock.calls.length).toBe(calls);
    expect(first.cached).toBe(false);
    expect(second.cached).toBe(true);
  });
});
