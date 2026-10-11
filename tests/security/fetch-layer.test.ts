/**
 * Fetch layer: retry policy, status handling, reference validation and URL
 * encoding (review M1, M3, H1 M-Pesa status, abuse item 7).
 */
import { describe, it, expect, afterEach, vi } from "vitest";
import { Verifier } from "@/lib";
import { getParser } from "@/lib/parsers/registry";
import { getBank } from "@/lib/manifest/loader";
import "@/lib/parsers";

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

const BOA_OK = JSON.stringify({
  body: [{
    "Source Account Name": "John Doe",
    "Source Account": "1****7890",
    "Receiver's Name": "Jane Smith",
    "Receiver's Account": "1****54321",
    "Transferred Amount": "5,000.00 ETB",
    "Transaction Date": "2026-06-15",
    "Transaction Reference": "FT26167ABCDE",
  }],
});

describe("retry policy", () => {
  const v = new Verifier();

  it("does not retry a 404", async () => {
    const fetchMock = vi.fn(async () => new Response("not found", { status: 404 }));
    vi.stubGlobal("fetch", fetchMock);
    const r = await v.verify({ bank: "boa", reference: "FT26167ABCDE", accountNumber: "1000054321" });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error.kind).toBe("EXTRACTION_ERROR");
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("does not retry other 4xx and does not treat them as success", async () => {
    const fetchMock = vi.fn(async () => new Response('{"message":"Forbidden"}', { status: 403 }));
    vi.stubGlobal("fetch", fetchMock);
    const r = await v.verify({ bank: "boa", reference: "FT26167ABCDE", accountNumber: "1000054321" });
    expect(r.ok).toBe(false);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("retries a 5xx at most once (2 attempts in total)", async () => {
    const fetchMock = vi.fn(async () => new Response("down", { status: 503 }));
    vi.stubGlobal("fetch", fetchMock);
    const r = await v.verify({ bank: "boa", reference: "FT26167ABCDE", accountNumber: "1000054321" });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error.kind).toBe("ENDPOINT_ERROR");
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it("retries a network error at most once and hides the low-level message", async () => {
    const fetchMock = vi.fn(async () => {
      throw new Error("connect ECONNREFUSED 10.0.0.5:6379");
    });
    vi.stubGlobal("fetch", fetchMock);
    const r = await v.verify({ bank: "boa", reference: "FT26167ABCDE", accountNumber: "1000054321" });
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(r.ok).toBe(false);
    if (!r.ok && r.error.kind === "ENDPOINT_ERROR") expect(r.error.message).not.toMatch(/ECONNREFUSED|10\.0\.0\.5/);
  });

  it("succeeds after one 5xx", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(new Response("down", { status: 502 }))
      .mockResolvedValueOnce(new Response(BOA_OK, { status: 200, headers: { "content-type": "application/json" } }));
    vi.stubGlobal("fetch", fetchMock);
    const r = await v.verify({ bank: "boa", reference: "FT26167ABCDE", accountNumber: "1000054321" });
    expect(r.ok && r.value.verified).toBe(true);
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });
});

describe("reference validation and encoding (review M1)", () => {
  const v = new Verifier();
  const banks: Array<{ bank: string; accountNumber?: string; phoneNumber?: string }> = [
    { bank: "cbe", accountNumber: "1000560536171" },
    { bank: "cbe-new" },
    { bank: "telebirr" },
    { bank: "boa", accountNumber: "1000054321" },
    { bank: "mpesa" },
    { bank: "dashen" },
    { bank: "awash" },
    { bank: "zemen" },
    { bank: "cbebirr", phoneNumber: "251911223344" },
  ];
  const evil = ["../../../admin?z=1", "../health#", "X&foo=bar#", "FT123/../x", "FT1?x=1", "FT1#frag", "a b", "%2e%2e"];

  it("rejects /, #, ?, & and .. before any fetch, for every bank", async () => {
    const fetchSpy = vi.fn();
    vi.stubGlobal("fetch", fetchSpy);
    for (const b of banks) {
      for (const reference of evil) {
        const r = await v.verify({ ...b, reference });
        expect(r.ok, `${b.bank} ${reference}`).toBe(false);
        // In-development banks (Zemen, CBE Birr) are refused before input checks.
        const kinds = getBank(b.bank)?.status === "live" ? ["REF_ERROR", "MISSING_INPUT"] : ["BANK_NOT_SUPPORTED"];
        if (!r.ok) expect(kinds, `${b.bank} ${reference}`).toContain(r.error.kind);
      }
    }
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it("every parser's own reference check rejects them too, live or in development", () => {
    for (const b of banks) {
      const parser = getParser(b.bank)!;
      for (const reference of evil) {
        expect(parser.normalizeReference(reference).ok, `${b.bank} ${reference}`).toBe(false);
      }
    }
  });

  it("requires a digits-only account suffix", async () => {
    const fetchSpy = vi.fn();
    vi.stubGlobal("fetch", fetchSpy);
    const r = await v.verify({ bank: "boa", reference: "FT26167ABCDE", accountNumber: "12#45" });
    expect(r.ok).toBe(false);
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it("URL-encodes references in every bank URL builder", () => {
    const enc = "A%2FB%3F%23";
    expect(getParser("cbe")!.buildUrl("A/B?#", "12345678")).toContain(`id=${enc}12345678`);
    expect(getParser("cbe-new")!.buildUrl("A/B?#")).toMatch(new RegExp(`/${enc}$`));
    expect(getParser("boa")!.buildUrl("A/B?#", "1000054321")).toContain(`id=${enc}54321`);
    expect(getParser("telebirr")!.buildUrl("A/B?#")).toMatch(new RegExp(`/receipt/${enc}$`));
    expect(getParser("zemen")!.buildUrl("A/B?#")).toContain(`/rt/${enc}/pdf`);
    expect(getParser("awash")!.buildUrl("A/B?#")).toMatch(new RegExp(`/-${enc}$`));
    expect(getParser("mpesa")!.buildUrl("A&b=1")).toContain("trxNo=A%26b%3D1");
    expect(getParser("dashen")!.buildUrl("A/B")).toMatch(/receipt\/A%2FB$/);
  });

  it("keeps genuine references working", async () => {
    const fetchMock = vi.fn(async () => new Response(BOA_OK, { status: 200, headers: { "content-type": "application/json" } }));
    vi.stubGlobal("fetch", fetchMock);
    const r = await v.verify({ bank: "boa", reference: "FT26167ABCDE", accountNumber: "1000 0543 21" });
    expect(r.ok && r.value.verified).toBe(true);
    expect(String((fetchMock.mock.calls[0] as unknown[])[0])).toBe(
      "https://cs.bankofabyssinia.com/api/onlineSlip/getDetails/?id=FT26167ABCDE54321"
    );
  });
});

describe("TLS verification", () => {
  it("has no rejectUnauthorized: false left in the bank fetch code", async () => {
    const { readFileSync, readdirSync } = await import("node:fs");
    const path = await import("node:path");
    const dirs = ["src/lib/parsers", "src/lib/http", "src/app/api/health"];
    for (const dir of dirs) {
      for (const f of readdirSync(dir)) {
        if (!f.endsWith(".ts")) continue;
        const src = readFileSync(path.join(dir, f), "utf8");
        expect(src, `${dir}/${f}`).not.toMatch(/rejectUnauthorized\s*:\s*false/);
      }
    }
  });
});
