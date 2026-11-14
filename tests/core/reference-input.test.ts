/**
 * One module reads a receipt link and puts a reference in its canonical form
 * (src/lib/reference-input.ts): the verifier fetches with what it returns,
 * and the cache key names that same fetch with it. Before this, both were
 * written out twice, and the cache key's copy had to be kept in step by
 * hand.
 *
 * These tests pin the reading itself, that neither caller grows its own
 * second copy, and that `fromLink` cannot be set by a client over the API.
 */
import { describe, it, expect, afterEach, vi } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { NextRequest } from "next/server";
import { Verifier } from "@/lib";
import "@/lib/parsers";
import { resolveReference, type ReferenceRead } from "@/lib/reference-input";
import { verificationCacheKey, clearCache } from "@/lib/receipt-cache";
import { POST as verifyPOST } from "@/app/api/verify/route";

const read = (p: string) => readFileSync(join(__dirname, "..", "..", p), "utf8");

/** The parts a request resolves to, or a failure that stops it here. */
function inputOf(result: ReferenceRead) {
  if (result.kind === "unrecognised-link") throw new Error("expected a reference cheki can read");
  return result.input;
}

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

let ip = 0;
const freshIp = () => ({ "x-real-ip": `10.83.${Math.floor(++ip / 250)}.${ip % 250}` });

/** fetch that answers 404 and records the URLs asked. */
function notFoundFetch() {
  const urls: string[] = [];
  const fn = vi.fn(async (input: unknown) => {
    urls.push(String(input instanceof Request ? input.url : input));
    return new Response("not found", { status: 404 });
  });
  vi.stubGlobal("fetch", fn);
  return urls;
}

describe("resolveReference", () => {
  it("compacts a typed reference for a bank that prints capitals", () => {
    const resolved = inputOf(resolveReference({ bank: "cbe", reference: "  FT26 sample01  ", accountNumber: " 1000000006171 " }));
    expect(resolved).toEqual({
      bank: "cbe",
      reference: "FT26SAMPLE01",
      accountNumber: "1000000006171",
      fromLink: false,
    });
  });

  it("uppercases a reference a QR printed, but never compacts it", () => {
    expect(inputOf(resolveReference({ bank: "cbebirr", reference: "DTS41-AB2C90", fromLink: true })).reference).toBe("DTS41-AB2C90");
    expect(inputOf(resolveReference({ bank: "cbebirr", reference: "DTS41-AB2C90" })).reference).toBe("DTS41AB2C90");
  });

  it("reads a receipt link into the parts the bank is asked for", () => {
    const resolved = inputOf(
      resolveReference({ bank: "cbe", reference: "https://apps.cbe.com.et:100/?id=ft26sample0100006171" })
    );
    expect(resolved).toEqual({
      bank: "cbe",
      reference: "FT26SAMPLE01",
      accountNumber: "00006171",
      fromLink: true,
    });
  });

  it("keeps what was typed; the link only fills what is missing", () => {
    expect(
      inputOf(
        resolveReference({
          bank: "cbe",
          reference: "https://apps.cbe.com.et:100/?id=ft26sample0100006171",
          accountNumber: "1000000006171",
          phoneNumber: "0911000000",
        })
      )
    ).toEqual({
      bank: "cbe",
      reference: "FT26SAMPLE01",
      accountNumber: "1000000006171",
      phoneNumber: "0911000000",
      fromLink: true,
    });

    expect(inputOf(resolveReference({ reference: "https://transactioninfo.ethiotelecom.et/receipt/det0sample" }))).toEqual({
      bank: "telebirr",
      reference: "DET0SAMPLE",
      fromLink: true,
    });
  });

  it("rejects URL syntax that is not a receipt link cheki knows", () => {
    for (const reference of [
      "http:/mbreciept.cbe.com.et/x",
      "http:mbreciept.cbe.com.et/x",
      "http:\\mbreciept.cbe.com.et\\x",
      "//evil.example/x",
      "https://evil.example/receipt/FT1",
      "https://example.com/nope",
      "javascript:alert(1)",
      "ftp://evil.example/x",
    ]) {
      expect(resolveReference({ bank: "cbe", reference }).kind, reference).toBe("unrecognised-link");
    }
  });

  it("is idempotent: resolving its own output again changes nothing", () => {
    const inputs = [
      { bank: "cbe", reference: " FT26 sample01 " },
      { bank: "cbebirr", reference: "DTS41-AB2C90", fromLink: true },
      { bank: "", reference: "https://apps.cbe.com.et:100/?id=ft26sample0100006171" },
      { bank: "cbe", reference: "fHCxExampleRcpt01" },
      { bank: "", reference: "https://awashpay.awashbank.com:8225/-2kdl95xe81-4u0000" },
    ];
    for (const input of inputs) {
      const once = inputOf(resolveReference(input));
      const twice = inputOf(resolveReference(once));
      expect(twice, JSON.stringify(input)).toEqual(once);
    }
  });
});

/**
 * The cache key has to be the name of the fetch the verifier will make. For
 * a receipt link that means: the key of the link is the key of the parts it
 * is read into, and the verifier fetches the URL those parts build. The URL
 * comes from the parser, not from this module, so the two sides are checked
 * against each other rather than against themselves.
 */
describe("the cache key and the verifier name one fetch", () => {
  type Row = {
    name: string;
    input: { bank: string; reference: string };
    parts: { bank: string; reference: string; accountNumber?: string; phoneNumber?: string };
    url: string;
  };
  const cases: Row[] = [
    {
      name: "a CBE share link with an account in it",
      input: { bank: "", reference: "https://apps.cbe.com.et:100/?id=ft26sample0100006171" },
      parts: { bank: "cbe", reference: "FT26SAMPLE01", accountNumber: "00006171" },
      url: "https://apps.cbe.com.et:100/?id=FT26SAMPLE0100006171",
    },
    {
      name: "a CBE receipt id, case-sensitive",
      input: { bank: "", reference: "https://mbreciept.cbe.com.et/fHCxExampleRcpt01" },
      parts: { bank: "cbe", reference: "fHCxExampleRcpt01" },
      url: "https://mb.cbe.com.et/api/v1/transactions/public/transaction-detail/fHCxExampleRcpt01",
    },
    {
      name: "a Telebirr receipt link retyped in lowercase",
      input: { bank: "cbe", reference: "https://transactioninfo.ethiotelecom.et/receipt/det0sample" },
      parts: { bank: "telebirr", reference: "DET0SAMPLE" },
      url: "https://transactioninfo.ethiotelecom.et/receipt/DET0SAMPLE",
    },
    {
      name: "a BOA slip link",
      input: { bank: "", reference: "https://cs.bankofabyssinia.com/api/onlineSlip/getDetails/?id=FT26167ABCDE54321" },
      parts: { bank: "boa", reference: "FT26167ABCDE", accountNumber: "54321" },
      url: "https://cs.bankofabyssinia.com/api/onlineSlip/getDetails/?id=FT26167ABCDE54321",
    },
    {
      name: "a CBE Birr receipt link with the pair it was issued for",
      input: { bank: "", reference: "https://cbepay1.cbe.com.et/aureceipt?TID=dts41ab2c90&PH=251911223344" },
      parts: { bank: "cbebirr", reference: "DTS41AB2C90", phoneNumber: "251911223344" },
      url: "https://cbepay1.cbe.com.et/aureceipt?TID=DTS41AB2C90&PH=251911223344",
    },
  ];

  it.each(cases)("$name: one key, one fetch", async ({ input, parts, url }) => {
    expect(verificationCacheKey(input)).toBe(verificationCacheKey(parts));

    const urls = notFoundFetch();
    await new Verifier().verify(input);
    expect(urls[0]).toBe(url);
  });
});

describe("the rewrite lives in one module", () => {
  it("neither caller keeps its own copy of it", () => {
    for (const file of ["src/lib/core/verifier.ts", "src/lib/receipt-cache.ts"]) {
      const src = read(file);
      expect(src, file).toMatch(/resolveReference/);
      expect(src, file).toMatch(/from "[^"]*reference-input"/);
      // The second copy would be a link read (detectBankFromUrl, isUrl,
      // looksLikeUrl) or a second canonicalisation (canonicalReference).
      expect(src, file).not.toMatch(/detectBankFromUrl|\bisUrl\b|looksLikeUrl|canonicalReference/);
    }
    const shared = read("src/lib/reference-input.ts");
    expect(shared).toMatch(/detectBankFromUrl/);
    expect(shared).toMatch(/canonicalReference/);
  });

  it("only the API's own code can set fromLink, never a client", () => {
    // Both routes build VerifyRequest field by field from the JSON body, so
    // an extra `fromLink` in the body is dropped rather than forwarded.
    const single = read("src/app/api/verify/route.ts");
    expect(single).toContain("bank: str(body.bank)");
    expect(single).not.toContain("...body");
    expect(single).not.toContain("fromLink");

    const batch = read("src/app/api/verify/batch/route.ts");
    expect(batch).toContain("bank: str(r.bank)");
    expect(batch).not.toContain("...raw");
    expect(batch).not.toContain("fromLink");
  });

  it("a fromLink in the POST body is ignored: the reference is still compacted", async () => {
    clearCache();
    const urls = notFoundFetch();
    await verifyPOST(
      new NextRequest("https://cheki.et/api/verify", {
        method: "POST",
        headers: { "content-type": "application/json", ...freshIp() },
        body: JSON.stringify({ bank: "telebirr", reference: "det 0sample", fromLink: true }),
      })
    );
    // Honoured, the reference would stay "det 0sample" and never reach the
    // bank as the canonical number it is.
    expect(urls[0]).toBe("https://transactioninfo.ethiotelecom.et/receipt/DET0SAMPLE");
  });
});
