/**
 * Regression tests for the eBirr/Siinqee SSRF + forged-receipt bug and the
 * host-allowlist defences. Ported from the review PoCs (poc.mts, ssrf-poc.ts,
 * misc.mts): each input below used to make cheki fetch an attacker URL and
 * report the page as verified.
 */
import http from "node:http";
import type { AddressInfo } from "node:net";
import { describe, it, expect, beforeAll, afterAll, afterEach, vi } from "vitest";
import { Verifier } from "@/lib";
import { detectBankFromUrl, isUrl, looksLikeUrl } from "@/lib/adapters/url-detector";
import { isAllowedUrl, allowedHosts } from "@/lib/security/hosts";
import { safeFetch } from "@/lib/http/safe-fetch";
import { getParser } from "@/lib/parsers/registry";

const FAKE = `<html><body><table><tr><td>Sender Name</td><td>Abebe Forged</td></tr>
<tr><td>Receiver</td><td>My Shop PLC</td></tr><tr><td>Amount</td><td>50,000.00 ETB</td></tr>
<tr><td>Reference</td><td>FAKE123</td></tr><tr><td>Date</td><td>2026-10-11</td></tr><tr><td>Status</td><td>Success</td></tr></table></body></html>`;

let server: http.Server;
let port = 0;
const hits: string[] = [];

beforeAll(async () => {
  server = http.createServer((req, res) => {
    hits.push(req.url ?? "");
    res.setHeader("content-type", "text/html");
    res.end(FAKE);
  });
  await new Promise<void>((r) => server.listen(0, "127.0.0.1", () => r()));
  port = (server.address() as AddressInfo).port;
});

afterAll(() => {
  server.close();
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe("eBirr / Siinqee SSRF (review C1)", () => {
  const v = new Verifier();

  const cases = (p: number): Array<[string, Record<string, string>]> => [
    ["ebirr ref http:/ single slash", { bank: "ebirr", reference: `http:/127.0.0.1:${p}/internal` }],
    ["siinqee ref http:/ single slash", { bank: "siinqee", reference: `http:/127.0.0.1:${p}/x` }],
    ["siinqee qrData http URL", { bank: "siinqee", qrData: `http://127.0.0.1:${p}/qr` }],
    ["ebirr ref http:host", { bank: "ebirr", reference: `http:127.0.0.1:${p}/a` }],
    ["ebirr ref http:\\\\host", { bank: "ebirr", reference: `http:\\\\127.0.0.1:${p}\\a` }],
    ["ebirr ref //host", { bank: "ebirr", reference: `//127.0.0.1:${p}/nib/abcd1234` }],
    ["ebirr ref full http URL", { bank: "ebirr", reference: `http://127.0.0.1:${p}/y` }],
    ["ebirr ref HTTP uppercase", { bank: "ebirr", reference: `HTTP://127.0.0.1:${p}/y` }],
    ["official-looking link with URL token", { bank: "siinqee", reference: `https://receipt.ebirr.com/siinqee/http:127.0.0.1:${p}` }],
    ["official-looking link, no bank", { bank: "", reference: `https://receipt.ebirr.com/x/http:127.0.0.1:${p}` }],
    ["ebirr qrData http:host", { bank: "ebirr", qrData: `http:127.0.0.1:${p}/qr` }],
    ["look-alike eBirr host", { bank: "ebirr", reference: `https://receipt.ebirr.com.127.0.0.1.nip.io/nib/abcd1234` }],
  ];

  it("never fetches the attacker host and never verifies", async () => {
    const fetchSpy = vi.spyOn(globalThis, "fetch");
    for (const [label, req] of cases(port)) {
      const r = await v.verify(req as never);
      expect(r.ok && r.value.verified, label).toBeFalsy();
    }
    expect(hits).toEqual([]);
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it("rejects qrData that is a URL cheki does not recognise instead of using it as a reference", async () => {
    const r = await v.verify({ bank: "telebirr", qrData: "https://example.com/receipt/DET1234567" });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error.kind).toBe("MISSING_INPUT");
  });

  it("applies the in-development gate to banks reached through a QR link", async () => {
    const fetchSpy = vi.spyOn(globalThis, "fetch");
    const r = await v.verify({ bank: "telebirr", qrData: "https://receipt.ebirr.com/nib/abcd1234" });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error.kind).toBe("BANK_NOT_SUPPORTED");
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it("rebuilds genuine eBirr links on the fixed host", () => {
    expect(getParser("ebirr")!.buildUrl("https://receipt.ebirr.com/nib/abc123")).toBe("https://receipt.ebirr.com/nib/abc123");
    expect(getParser("siinqee")!.buildUrl("SQ12345678")).toBe("https://receipt.ebirr.com/siinqee/SQ12345678");
    expect(getParser("siinqee")!.buildUrl("siinqee/SQ12345678")).toBe("https://receipt.ebirr.com/siinqee/SQ12345678");
    expect(() => getParser("siinqee")!.buildUrl("nib/SQ12345678")).toThrow();
  });
});

describe("URL detector host matching (review M6)", () => {
  it("matches hosts exactly, not by substring", () => {
    expect(detectBankFromUrl("https://transactioninfo.ethiotelecom.et.evil.example/receipt/DET1234567")).toBeNull();
    expect(detectBankFromUrl("https://cbepay1.attacker.com/aureceipt?TID=1&PH=2")).toBeNull();
    expect(detectBankFromUrl("https://notawashbank.com/-ABC")).toBeNull();
    expect(detectBankFromUrl("https://evil-bankofabyssinia.com/slip/?trx=FT1")).toBeNull();
    expect(detectBankFromUrl("https://receipt.ebirr.com.evil.example/nib/abc123")).toBeNull();
    expect(detectBankFromUrl("https://user:pw@transactioninfo.ethiotelecom.et/receipt/DET1234567")).toBeNull();
  });

  it("still detects real hosts and subdomains", () => {
    expect(detectBankFromUrl("https://transactioninfo.ethiotelecom.et/receipt/DET1234567")?.bank).toBe("telebirr");
    expect(detectBankFromUrl("https://awashpay.awashbank.com:8225/-2KDL95XE81-4U0000")?.bank).toBe("awash");
    expect(detectBankFromUrl("https://cbepay1.cbe.com.et/aureceipt?TID=X1&PH=251911")?.bank).toBe("cbebirr");
  });

  it("rejects single-slash and other scheme tricks", () => {
    for (const s of ["http:/127.0.0.1/x", "http:127.0.0.1", "https:\\\\evil.com", "//evil.com/x", "javascript:alert(1)"]) {
      expect(isUrl(s), s).toBe(false);
      expect(looksLikeUrl(s), s).toBe(true);
      expect(detectBankFromUrl(s), s).toBeNull();
    }
    expect(looksLikeUrl("FT26SAMPLE01")).toBe(false);
  });
});

describe("central host allowlist (fetch layer)", () => {
  it("is built from the manifest and allows only https bank hosts", () => {
    const hosts = allowedHosts();
    expect(hosts.has("transactioninfo.ethiotelecom.et")).toBe(true);
    expect(hosts.has("awashpay.awashbank.com:8225")).toBe(true);
    expect(hosts.has("receipt.ebirr.com")).toBe(true);
    expect(isAllowedUrl("https://cs.bankofabyssinia.com/api/onlineSlip/getDetails/?id=X")).toBe(true);
    expect(isAllowedUrl("http://cs.bankofabyssinia.com/x")).toBe(false);
    expect(isAllowedUrl("https://awashpay.awashbank.com:22/-x")).toBe(false);
    expect(isAllowedUrl("https://127.0.0.1/")).toBe(false);
    expect(isAllowedUrl("https://169.254.169.254/latest/meta-data")).toBe(false);
    expect(isAllowedUrl("https://user@receipt.ebirr.com/nib/x")).toBe(false);
  });

  it("refuses a non-allowlisted URL before any network call", async () => {
    const fetchSpy = vi.spyOn(globalThis, "fetch");
    await expect(safeFetch(`http://127.0.0.1:${port}/`, { timeoutMs: 1000, maxBytes: 1000 })).rejects.toThrow(/not a known bank/);
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it("re-checks the host on redirects", async () => {
    const fetchMock = vi.fn<(url: string, init?: RequestInit) => Promise<Response>>(async () =>
      new Response(null, { status: 302, headers: { location: `http://127.0.0.1:${port}/stolen` } })
    );
    vi.stubGlobal("fetch", fetchMock);
    await expect(
      safeFetch("https://receipt.ebirr.com/nib/abcd1234", { timeoutMs: 1000, maxBytes: 1000 })
    ).rejects.toThrow(/not a known bank/);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(fetchMock.mock.calls[0][1]).toMatchObject({ redirect: "manual" });
  });

  it("caps the response size", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => new Response("x".repeat(3 * 1024 * 1024), { status: 200 })));
    await expect(
      safeFetch("https://receipt.ebirr.com/nib/abcd1234", { timeoutMs: 1000, maxBytes: 2 * 1024 * 1024 })
    ).rejects.toThrow(/larger than expected/);
  });
});
