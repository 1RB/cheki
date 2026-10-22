/**
 * Typed references in lowercase (fix/reference-case): banks whose references
 * are uppercase-only get the canonical form everywhere (verifier, API routes,
 * cache key, form detection); case-sensitive tokens are never touched.
 */
import { describe, it, expect, afterEach, vi } from "vitest";
import { NextRequest } from "next/server";
import { Verifier } from "@/lib";
import "@/lib/parsers";
import { getParser } from "@/lib/parsers/registry";
import {
  CASE_INSENSITIVE_BANKS,
  canonicalReference,
  isCaseInsensitiveBank,
  referenceExample,
  referenceLooksOff,
} from "@/lib/reference-case";
import { verificationCacheKey } from "@/lib/receipt-cache";
import { detectInput, browserReceiptUrl, shouldShowCanonical } from "@/lib/verify/detect";
import { presentVerdict } from "@/lib/verify/verdict";
import { parseTelebirrQr } from "@/lib/qr/telebirr";
import { POST as verifyPOST } from "@/app/api/verify/route";
import { GET as receiptGET } from "@/app/api/receipt/route";
import { MIXED_CASE_REF, SYNTHETIC_QR, telebirrQr } from "../fixtures/telebirr-qr";

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

let ip = 0;
const freshIp = () => ({ "x-real-ip": `10.81.${Math.floor(++ip / 250)}.${ip % 250}` });

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

describe("canonicalReference", () => {
  it("flags exactly the banks whose references are uppercase-only", () => {
    expect([...CASE_INSENSITIVE_BANKS].sort()).toEqual(["boa", "cbe", "cbebirr", "dashen", "mpesa", "telebirr"]);
    for (const id of ["awash", "ebirr", "siinqee", "nib", "wegagen", "ahadu", "kaafi", "zamzam", "zemen"]) {
      expect(isCaseInsensitiveBank(id), id).toBe(false);
    }
    expect(isCaseInsensitiveBank("CBE-new")).toBe(true);
  });

  it.each([
    ["cbe", "ft26sample01", "FT26SAMPLE01"],
    ["cbe", " Ft26 Sample01 ", "FT26SAMPLE01"],
    ["boa", "ft25sample06", "FT25SAMPLE06"],
    ["boa", "FT25-SAMPLE06", "FT25SAMPLE06"],
    ["telebirr", "det0sample", "DET0SAMPLE"],
    ["telebirr", "DET 0SAM PLE", "DET0SAMPLE"],
    ["telebirr", "chq\u00a00sample", "CHQ0SAMPLE"],
    ["telebirr", "dja0\u2013sample", "DJA0SAMPLE"],
    ["mpesa", "se12345678", "SE12345678"],
    ["dashen", "b22wdti00sample1", "B22WDTI00SAMPLE1"],
    ["dashen", "B22W DTI0 0SAM PLE1", "B22WDTI00SAMPLE1"],
    ["cbebirr", "dts41ab2c90", "DTS41AB2C90"],
    ["cbebirr", "DTS41-AB2C90", "DTS41AB2C90"],
    ["zamzam", "1234 5678", "12345678"],
  ])("%s: %j -> %s", (bank, input, expected) => {
    expect(canonicalReference(bank, input)).toBe(expected);
  });

  it.each([
    // CBE Receipt IDs are case-sensitive mbreciept tokens.
    ["cbe", "fHCxExampleRcpt01"],
    ["cbe", "v2-AbCdEf0123456789"],
    ["cbe-new", "fHCxExampleRcpt01"],
    // Awash base36 share tokens and eBirr-style {token} path segments.
    ["awash", "2kdl95xe81-4u0000"],
    ["ebirr", "nib/AbCdEf123456"],
    ["siinqee", "siinqee/AbCdEf123456"],
    ["nib", "AbCdEf123456"],
    // Banks without a rule, and unknown codes.
    ["zemen", "zb123456"],
    ["", "ft26sample01"],
    [undefined, "ft26sample01"],
  ])("%s: %j is left as typed", (bank, input) => {
    expect(canonicalReference(bank, input)).toBe(input);
  });

  it("never rewrites a URL, a path or other characters, so the validators still see them", () => {
    for (const bank of CASE_INSENSITIVE_BANKS) {
      for (const input of [
        "https://transactioninfo.ethiotelecom.et/receipt/det0sample",
        "../../admin",
        "ft26/../x",
        "det0sample?x=1",
        "a b",
        "%2e%2e",
      ]) {
        expect(canonicalReference(bank, input), `${bank} ${input}`).toBe(input.trim());
      }
    }
  });

  it("only drops separators when that gives the bank's shape", () => {
    // "a b" is not a Telebirr number once compacted, so it stays (and is rejected).
    expect(canonicalReference("telebirr", "a b")).toBe("a b");
    // Letters and digits of the wrong length are still uppercased.
    expect(canonicalReference("telebirr", "det0sampl")).toBe("DET0SAMPL");
  });

  it("a reference read out of a link is uppercased but never compacted", () => {
    expect(canonicalReference("cbebirr", "dts41ab2c90", { compact: false })).toBe("DTS41AB2C90");
    expect(canonicalReference("cbebirr", "DTS41-AB2C90", { compact: false })).toBe("DTS41-AB2C90");
    expect(canonicalReference("zamzam", "1234 5678", { compact: false })).toBe("1234 5678");
  });
});

describe("parsers: lowercase is the same reference, case-sensitive tokens are not", () => {
  it.each([
    ["cbe", "ft26sample01", "FT26SAMPLE01"],
    ["boa", "ft25sample06", "FT25SAMPLE06"],
    ["telebirr", "det0sample", "DET0SAMPLE"],
    ["mpesa", "se12345678", "SE12345678"],
    ["dashen", "b22wdti00sample1", "B22WDTI00SAMPLE1"],
    ["cbebirr", "dts41ab2c90", "DTS41AB2C90"],
  ])("%s normalizeReference(%j)", (id, input, expected) => {
    expect(getParser(id)!.normalizeReference(input)).toEqual({ ok: true, value: expected });
  });

  it("keeps the case of CBE Receipt IDs, Awash tokens and eBirr tokens", () => {
    expect(getParser("cbe-new")!.normalizeReference("fHCxExampleRcpt01")).toEqual({ ok: true, value: "fHCxExampleRcpt01" });
    expect(getParser("awash")!.normalizeReference("2kdl95xe81-4u0000")).toEqual({ ok: true, value: "2kdl95xe81-4u0000" });
    const ebirr = getParser("ebirr")!.normalizeReference("nib/AbCdEf123456");
    expect(ebirr.ok && ebirr.value).toContain("AbCdEf123456");
    const siinqee = getParser("siinqee")!.normalizeReference("AbCdEf123456");
    expect(siinqee.ok && siinqee.value).toContain("AbCdEf123456");
  });
});

describe("Verifier: what reaches the bank", () => {
  const v = new Verifier();

  it.each([
    [{ bank: "cbe", reference: "ft26sample01", accountNumber: "1000000006171" }, "https://apps.cbe.com.et:100/?id=FT26SAMPLE0100006171"],
    [{ bank: "cbe", reference: "FT26 sample01", accountNumber: "1000000006171" }, "https://apps.cbe.com.et:100/?id=FT26SAMPLE0100006171"],
    [{ bank: "boa", reference: "ft26167abcde", accountNumber: "1000054321" }, "https://cs.bankofabyssinia.com/api/onlineSlip/getDetails/?id=FT26167ABCDE54321"],
    [{ bank: "telebirr", reference: "det0sample" }, "https://transactioninfo.ethiotelecom.et/receipt/DET0SAMPLE"],
    [{ bank: "telebirr", reference: "det 0sample" }, "https://transactioninfo.ethiotelecom.et/receipt/DET0SAMPLE"],
    [{ bank: "mpesa", reference: "se12345678" }, "https://m-pesabusiness.safaricom.et/api/receipt/getReceipt?trxNo=SE12345678"],
    [{ bank: "dashen", reference: "b22wdti00sample1" }, "https://receipts.dashenbanksc.com/receipt/B22WDTI00SAMPLE1"],
    [{ bank: "cbebirr", reference: "dts41-ab2c90", phoneNumber: "0911223344" }, "https://cbepay1.cbe.com.et/aureceipt?TID=DTS41AB2C90&PH=251911223344"],
    // A receipt link a user retyped in lowercase: only the reference is uppercased.
    [{ bank: "", reference: "https://transactioninfo.ethiotelecom.et/receipt/det0sample" }, "https://transactioninfo.ethiotelecom.et/receipt/DET0SAMPLE"],
    [{ bank: "", reference: "https://cbepay1.cbe.com.et/aureceipt?TID=dts41ab2c90&PH=251911223344" }, "https://cbepay1.cbe.com.et/aureceipt?TID=DTS41AB2C90&PH=251911223344"],
    [{ bank: "", reference: "https://apps.cbe.com.et:100/?id=ft26sample0100006171" }, "https://apps.cbe.com.et:100/?id=FT26SAMPLE0100006171"],
  ])("%j", async (input, expected) => {
    const urls = notFoundFetch();
    await v.verify(input);
    expect(urls[0]).toBe(expected);
  });

  it("leaves case-sensitive tokens exactly as given", async () => {
    let urls = notFoundFetch();
    await v.verify({ bank: "cbe", reference: "fHCxExampleRcpt01" });
    expect(urls[0]).toMatch(/\/fHCxExampleRcpt01$/);

    urls = notFoundFetch();
    await v.verify({ bank: "", reference: "https://awashpay.awashbank.com:8225/-2kdl95xe81-4u0000" });
    expect(urls[0]).toBe("https://awashpay.awashbank.com:8225/-2kdl95xe81-4u0000");

    // eBirr white-label tokens (Siinqee is the live tenant).
    urls = notFoundFetch();
    await v.verify({ bank: "", reference: "https://receipt.ebirr.com/siinqee/AbCdEf123456" });
    expect(urls[0]).toBe("https://receipt.ebirr.com/siinqee/AbCdEf123456");
  });

  it("reads the Telebirr QR from its raw characters: the payload is never case-folded", async () => {
    const qr = telebirrQr(MIXED_CASE_REF);
    expect(parseTelebirrQr(qr).ok).toBe(true);
    // The CRC covers the raw characters, so a case-folded payload is not a QR.
    expect(parseTelebirrQr(SYNTHETIC_QR.toUpperCase()).ok).toBe(false);
    expect(parseTelebirrQr(SYNTHETIC_QR.toLowerCase()).ok).toBe(false);
    const urls = notFoundFetch();
    await v.verify({ bank: "telebirr", qrData: qr });
    expect(urls[0]).toBe(`https://transactioninfo.ethiotelecom.et/receipt/${MIXED_CASE_REF}`);
  });

  it("a separator inside a bank link is not a typing habit: still rejected", async () => {
    const urls = notFoundFetch();
    const r = await v.verify({ bank: "", reference: "https://cbepay1.cbe.com.et/aureceipt?TID=DTS41-AB2C90&PH=251911223344" });
    expect(r.ok).toBe(false);
    expect(urls).toHaveLength(0);
  });
});

describe("API routes", () => {
  it("POST /api/verify sends the canonical reference (SDK and API callers get it too)", async () => {
    const urls = notFoundFetch();
    const res = await verifyPOST(
      new NextRequest("https://cheki.et/api/verify", {
        method: "POST",
        headers: { "content-type": "application/json", ...freshIp() },
        body: JSON.stringify({ bank: "dashen", reference: "b22wdti00sample2" }),
      })
    );
    expect(res.status).toBe(422);
    expect(urls[0]).toBe("https://receipts.dashenbanksc.com/receipt/B22WDTI00SAMPLE2");
  });

  it("GET /api/receipt redirects a lowercase Dashen FT Ref to the uppercase receipt page", async () => {
    const r = await receiptGET(new NextRequest("https://cheki.et/api/receipt?bank=dashen&reference=b22wdti00sample1", { headers: freshIp() }));
    expect(r.status).toBe(302);
    expect(r.headers.get("location")).toBe("https://receipts.dashenbanksc.com/receipt/B22WDTI00SAMPLE1");
  });

  it("GET /api/receipt keeps a CBE Receipt ID's case", async () => {
    const r = await receiptGET(new NextRequest("https://cheki.et/api/receipt?bank=cbe&reference=fHCxExampleRcpt01", { headers: freshIp() }));
    expect(r.status).toBe(302);
    expect(r.headers.get("location")).toBe("https://mbreciept.cbe.com.et/fHCxExampleRcpt01");
  });

  it("GET /api/receipt takes a lowercase older CBE FT reference as the FT format", async () => {
    const urls = notFoundFetch();
    await receiptGET(new NextRequest("https://cheki.et/api/receipt?bank=cbe&reference=ft26sample01&account=1000000006171", { headers: freshIp() }));
    expect(urls[0]).toBe("https://apps.cbe.com.et:100/?id=FT26SAMPLE0100006171");
  });
});

describe("cache key", () => {
  it("one entry for a reference typed in either case", () => {
    expect(verificationCacheKey({ bank: "telebirr", reference: "det0sample" })).toBe(verificationCacheKey({ bank: "telebirr", reference: "DET0SAMPLE" }));
    expect(verificationCacheKey({ bank: "BOA", reference: "ft26167abcde", accountNumber: "54321" })).toBe(
      verificationCacheKey({ bank: "boa", reference: "FT26167ABCDE", accountNumber: "54321" })
    );
  });

  it("different entries for case-sensitive tokens", () => {
    expect(verificationCacheKey({ bank: "cbe", reference: "fHCxExampleRcpt01" })).not.toBe(verificationCacheKey({ bank: "cbe", reference: "FHCXEXAMPLERCPT01" }));
    expect(verificationCacheKey({ bank: "", reference: "https://awashpay.awashbank.com:8225/-2kdl95xe81-4u0000" })).not.toBe(
      verificationCacheKey({ bank: "", reference: "https://awashpay.awashbank.com:8225/-2KDL95XE81-4U0000" })
    );
  });
});

describe("form detection", () => {
  it("detects a lowercase reference and carries its canonical form", () => {
    const d = detectInput("det0sample", { overrideBank: "telebirr" });
    expect(d.kind).toBe("reference");
    expect(d.value).toBe("DET0SAMPLE");
    // The official Telebirr page is opened with the canonical number.
    expect(browserReceiptUrl(d)).toBe("https://transactioninfo.ethiotelecom.et/receipt/DET0SAMPLE");
  });

  it("a spaced, lowercase CBE FT reference still opens the account field", () => {
    const d = detectInput("ft26 sample01", { lockedBank: "cbe" });
    expect(d.value).toBe("FT26SAMPLE01");
    expect(d.format?.id).toBe("cbe-ft-pdf");
    expect(d.needsAccount).toBe(true);
  });

  it("a CBE Receipt ID keeps its case", () => {
    expect(detectInput("fHCxExampleRcpt01", { lockedBank: "cbe" }).value).toBe("fHCxExampleRcpt01");
  });

  it("the field is rewritten for a chosen bank or input that is not mixed case", () => {
    // Home page, auto-detected: all lowercase or spaced capitals are rewritten.
    expect(shouldShowCanonical(detectInput("det0sample"), "det0sample", false)).toBe(true);
    expect(shouldShowCanonical(detectInput("DET 0SAMPLE"), "DET 0SAMPLE", false)).toBe(true);
    // Mixed case on a guessed bank may be a case-sensitive token: left alone.
    expect(shouldShowCanonical(detectInput("Det0Sample"), "Det0Sample", false)).toBe(false);
    // On the bank's own page, or with the bank chosen, it is rewritten.
    expect(shouldShowCanonical(detectInput("Det0Sample", { lockedBank: "telebirr" }), "Det0Sample", true)).toBe(true);
    expect(shouldShowCanonical(detectInput("Det0Sample", { overrideBank: "telebirr" }), "Det0Sample", false)).toBe(true);
    // Already canonical, a link, or a case-sensitive token: nothing to do.
    expect(shouldShowCanonical(detectInput("DET0SAMPLE"), "DET0SAMPLE", false)).toBe(false);
    const link = "https://transactioninfo.ethiotelecom.et/receipt/det0sample";
    expect(shouldShowCanonical(detectInput(link), link, false)).toBe(false);
    expect(shouldShowCanonical(detectInput("fHCxExampleRcpt01", { lockedBank: "cbe" }), "fHCxExampleRcpt01", true)).toBe(false);
  });
});

describe("the hint after a not-found", () => {
  it("referenceLooksOff: lowercase, separators or the wrong shape", () => {
    expect(referenceLooksOff("telebirr", "det0sample")).toBe(true);
    expect(referenceLooksOff("telebirr", "DET 0SAMPLE")).toBe(true);
    expect(referenceLooksOff("telebirr", "DET0SAMPL")).toBe(true);
    expect(referenceLooksOff("telebirr", "DET0SAMPLE")).toBe(false);
    expect(referenceLooksOff("cbe", "FT26SAMPLE01")).toBe(false);
    expect(referenceLooksOff("cbe", "ft26sample01")).toBe(true);
    // A CBE Receipt ID is mixed case by design; links and other banks get no hint.
    expect(referenceLooksOff("cbe", "fHCxExampleRcpt01")).toBe(false);
    expect(referenceLooksOff("telebirr", "https://transactioninfo.ethiotelecom.et/receipt/det0sample")).toBe(false);
    expect(referenceLooksOff("awash", "2kdl95xe81-4u0000")).toBe(false);
    expect(referenceLooksOff("zamzam", "12 34")).toBe(false);
  });

  it("shows on a not-found and a rejected reference only when asked", () => {
    const notFound = { success: false, error: "Receipt not found.", httpStatus: 422 } as const;
    const hinted = presentVerdict({ ...notFound }, { bankCode: "boa", referenceHint: true });
    expect(hinted.kind).toBe("notFound");
    expect(hinted.referenceHint).toBe(
      "References are usually capital letters and digits (like FT25…). Scan the receipt's QR code or paste its link, or copy the reference exactly as printed."
    );
    expect(presentVerdict({ ...notFound }, { bankCode: "boa" }).referenceHint).toBeUndefined();
    const rejected = presentVerdict({ success: false, error: "A CBE Birr receipt number is 10 or 11 letters and digits, as in the SMS.", httpStatus: 400 }, { bankCode: "cbebirr", referenceHint: true });
    expect(rejected.kind).toBe("invalidInput");
    expect(rejected.referenceHint).toContain("DTS4…");
    // A missing account or phone is not about the reference.
    expect(presentVerdict({ success: false, error: "Enter at least the last 8 digits of the account number.", httpStatus: 400 }, { bankCode: "cbe", referenceHint: true }).referenceHint).toBeUndefined();
    // Never on a confirmed receipt or a bank that did not answer.
    expect(presentVerdict({ success: false, error: "down", httpStatus: 503 }, { bankCode: "boa", referenceHint: true }).referenceHint).toBeUndefined();
    // A bank without a rule has no example, so no hint.
    expect(presentVerdict({ ...notFound }, { bankCode: "awash", referenceHint: true }).referenceHint).toBeUndefined();
    expect(referenceExample("awash")).toBeUndefined();
  });
});
