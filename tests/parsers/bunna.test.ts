/**
 * Bunna Bank: receipt links and the receipt QR, the base64 token, the JSON
 * envelope, account masking, and the verify / batch / health paths around
 * them. All data is synthetic (tests/fixtures/bunna/records.ts).
 */
import { describe, it, expect, afterEach, vi } from "vitest";
import { NextRequest } from "next/server";
import { detectBankFromUrl, bunnaTokenFromHash } from "@/lib/adapters/url-detector";
import { BunnaParser, checkBunnaToken, maskBunnaAccount } from "@/lib/parsers/bunna";
import { getParser } from "@/lib/parsers/registry";
import { Verifier } from "@/lib";
import { isAllowedUrl } from "@/lib/security/hosts";
import { verificationGate } from "@/lib/core/gate";
import { buildProbeTargets, matchExpectation } from "@/lib/health";
import { detectInput } from "@/lib/verify/detect";
import { verificationCacheKey } from "@/lib/receipt-cache";
import { POST as verifyPOST } from "@/app/api/verify/route";
import { POST as batchPOST } from "@/app/api/verify/batch/route";
import "@/lib/parsers";
import {
  SYNTH_BUNNA_API,
  SYNTH_BUNNA_FAILURE,
  SYNTH_BUNNA_LINK,
  SYNTH_BUNNA_PAGE,
  SYNTH_BUNNA_QR,
  SYNTH_BUNNA_RECEIPT,
  SYNTH_BUNNA_SUCCESS,
  SYNTH_BUNNA_TOKEN,
  json,
} from "../fixtures/bunna/records";

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

let ipCounter = 0;
function freshIp(): Record<string, string> {
  ipCounter++;
  return { "x-forwarded-for": `10.78.${Math.floor(ipCounter / 250)}.${ipCounter % 250}` };
}

/** fetch stub answering every request with `body`, recording the URLs. */
function stubFetch(body: string, status = 200) {
  const calls: string[] = [];
  vi.stubGlobal(
    "fetch",
    vi.fn(async (url: string) => {
      calls.push(String(url));
      return new Response(body, { status, headers: { "content-type": "application/json" } });
    })
  );
  return calls;
}

describe("detectBankFromUrl: Bunna links and QR", () => {
  it("reads the token from a shared link, slashes and all", () => {
    const d = detectBankFromUrl(SYNTH_BUNNA_LINK);
    expect(d?.bank).toBe("bunna");
    expect(checkBunnaToken(d!.reference)).toEqual({ ok: true, value: SYNTH_BUNNA_TOKEN });
  });

  it("reads the receipt QR (site root, #/receipt-v2/) and #/receipt/", () => {
    for (const link of [SYNTH_BUNNA_QR, SYNTH_BUNNA_PAGE, SYNTH_BUNNA_PAGE.replace("/receipt/#/", "/receipt/#/receipt/"), SYNTH_BUNNA_PAGE.replace("/receipt/#/", "/receipt#/")]) {
      const d = detectBankFromUrl(link);
      expect(d?.bank, link).toBe("bunna");
      expect(checkBunnaToken(d!.reference), link).toEqual({ ok: true, value: SYNTH_BUNNA_TOKEN });
    }
  });

  it("only recognises exactly online.bunnabanksc.com and receipt routes", () => {
    const frag = `#/${encodeURIComponent(SYNTH_BUNNA_TOKEN)}`;
    expect(detectBankFromUrl(`https://evil.example/receipt/${frag}`)).toBeNull();
    expect(detectBankFromUrl(`https://online.bunnabanksc.com.evil.example/receipt/${frag}`)).toBeNull();
    expect(detectBankFromUrl(`https://x.online.bunnabanksc.com/receipt/${frag}`)).toBeNull();
    expect(detectBankFromUrl(`https://online.bunnabanksc.com/internet-banking/${frag}`)).toBeNull();
    expect(detectBankFromUrl("https://online.bunnabanksc.com/receipt/")).toBeNull();
    expect(detectBankFromUrl("https://online.bunnabanksc.com/receipt/#/")).toBeNull();
    expect(detectBankFromUrl("https://online.bunnabanksc.com/receipt/#/feedback/abc")).toBeNull();
    expect(detectBankFromUrl(`https://user:pw@online.bunnabanksc.com/receipt/${frag}`)).toBeNull();
  });

  it("bunnaTokenFromHash joins segments like Bunna's router", () => {
    expect(bunnaTokenFromHash("#/a/b/c")).toBe("a/b/c");
    expect(bunnaTokenFromHash("#/receipt-v2/a%2Fb")).toBe("a%2Fb");
    expect(bunnaTokenFromHash("#/receipt")).toBeNull();
    expect(bunnaTokenFromHash("")).toBeNull();
  });
});

describe("Bunna token", () => {
  it("canonicalises URL-encoded, space-for-plus, base64url and unpadded forms", () => {
    const want = { ok: true, value: SYNTH_BUNNA_TOKEN };
    expect(checkBunnaToken(` ${SYNTH_BUNNA_TOKEN} `)).toEqual(want);
    expect(checkBunnaToken(encodeURIComponent(SYNTH_BUNNA_TOKEN))).toEqual(want);
    expect(checkBunnaToken(SYNTH_BUNNA_TOKEN.replace(/\+/g, " "))).toEqual(want);
    expect(checkBunnaToken(SYNTH_BUNNA_TOKEN.replace(/\+/g, "-").replace(/\//g, "_"))).toEqual(want);
    expect(checkBunnaToken(SYNTH_BUNNA_TOKEN.replace(/=+$/, ""))).toEqual(want);
  });

  it("rejects transaction numbers, short or long tokens and non-base64", () => {
    for (const bad of ["", "BB00001", "abc", "AAAAAAAAAAAAAAAAAAAA", "A".repeat(400), "%E0%A4%A", "../etc/passwd", `${SYNTH_BUNNA_TOKEN}?x=1`, "a=b", "A".repeat(42) + "B="]) {
      expect(checkBunnaToken(bad).ok, bad).toBe(false);
    }
    expect(checkBunnaToken("BB00001")).toMatchObject({ message: expect.stringMatching(/transaction number/) });
  });

  it("builds the JSON URL on the fixed host with the token encoded", () => {
    const p = getParser("bunna")!;
    expect(p.buildUrl(SYNTH_BUNNA_TOKEN)).toBe(SYNTH_BUNNA_API);
    expect(() => p.buildUrl("BB00001")).toThrow();
    expect(isAllowedUrl(SYNTH_BUNNA_API)).toBe(true);
    expect(isAllowedUrl(SYNTH_BUNNA_API.replace("https:", "http:"))).toBe(false);
    expect(BunnaParser.receiptPageUrl(SYNTH_BUNNA_TOKEN)).toBe(SYNTH_BUNNA_PAGE);
  });
});

describe("maskBunnaAccount", () => {
  it("keeps Bunna's own mask and masks an account that arrives unmasked", () => {
    expect(maskBunnaAccount("1000*****0001")).toBe("1000*****0001");
    expect(maskBunnaAccount("1000123450001")).toBe("1********0001");
    expect(maskBunnaAccount("12345")).toBe("*****");
    // Partly masked, or masked in a way that shows more than 4 a side: remasked.
    expect(maskBunnaAccount("1000123*450001")).toBe("1*********0001");
    expect(maskBunnaAccount("10001*****00012")).toBe("1**********0012");
    expect(maskBunnaAccount("10*00*01")).toBe("1***0*01");
    expect(maskBunnaAccount(null)).toBeUndefined();
  });
});

describe("BunnaParser.parseAdvice", () => {
  it("maps payer, receiver, amount, date and reference; fee fields stay out", () => {
    const { parsed, notFound } = BunnaParser.parseAdvice(json(SYNTH_BUNNA_SUCCESS));
    expect(notFound).toBe(false);
    expect(parsed).toMatchObject({
      verified: true,
      senderName: "TEST PAYER ONE",
      senderAccount: "1000*****0001",
      receiverName: "Telebirr",
      receiverAccount: "9000*****0002",
      amount: 1250,
      currency: "ETB",
      date: "2026-10-01",
      reference: "BB00001",
    });
    for (const k of ["transactionType", "serviceFee", "serviceFeeVat", "totalPaid"]) expect(k in parsed, k).toBe(false);
    expect(parsed.raw).not.toContain("TEST PAYER ONE");
    expect(verificationGate(parsed, { bankId: "bunna", requestedReference: SYNTH_BUNNA_TOKEN })).toEqual({ ok: true });
  });

  it("masks unmasked accounts everywhere, raw included", () => {
    const { parsed } = BunnaParser.parseAdvice(json({ status: "SUCCESS", receipt: { ...SYNTH_BUNNA_RECEIPT, drAccount: "1000123450001" } }));
    expect(parsed.senderAccount).toBe("1********0001");
    expect(parsed.raw).not.toContain("1000123450001");
  });

  it("FAILURE is not found; other bodies are unreadable; zero amounts fail the gate", () => {
    expect(BunnaParser.parseAdvice(json(SYNTH_BUNNA_FAILURE))).toEqual({ parsed: { verified: false }, notFound: true });
    for (const body of ["<html>", "null", "[]", json({ status: "SUCCESS" }), json({ status: "PENDING", receipt: SYNTH_BUNNA_RECEIPT })]) {
      expect(BunnaParser.parseAdvice(body), body).toEqual({ parsed: { verified: false }, notFound: false });
    }
    const zero = BunnaParser.parseAdvice(json({ status: "SUCCESS", receipt: { ...SYNTH_BUNNA_RECEIPT, amount: 0 } })).parsed;
    expect(verificationGate(zero, { bankId: "bunna" })).toMatchObject({ ok: false, reason: "amount" });
  });
});

describe("Verifier: Bunna", () => {
  it("a link verifies; sourceUrl is the public receipt page", async () => {
    const calls = stubFetch(json(SYNTH_BUNNA_SUCCESS));
    const r = await new Verifier().verify({ bank: "", reference: SYNTH_BUNNA_LINK });
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(calls).toEqual([SYNTH_BUNNA_API]);
    expect(r.value).toMatchObject({ verified: true, bankCode: "bunna", reference: "BB00001", sourceUrl: SYNTH_BUNNA_PAGE, amount: 1250 });
    expect("raw" in r.value).toBe(false);
  });

  it("the receipt QR verifies the same way", async () => {
    stubFetch(json(SYNTH_BUNNA_SUCCESS));
    const r = await new Verifier().verify({ bank: "", reference: SYNTH_BUNNA_QR });
    expect(r.ok && r.value.verified).toBe(true);
  });

  it("FAILURE is not confirmed, never fake, and links Bunna's page", async () => {
    stubFetch(json(SYNTH_BUNNA_FAILURE));
    const r = await new Verifier().verify({ bank: "", reference: SYNTH_BUNNA_LINK });
    expect(r.ok).toBe(false);
    if (r.ok) return;
    expect(r.error.kind).toBe("EXTRACTION_ERROR");
    expect("message" in r.error && r.error.message).toMatch(/did not return a receipt/);
    expect("message" in r.error && r.error.message).not.toMatch(/fake/i);
    expect("checkedUrl" in r.error && r.error.checkedUrl).toBe(SYNTH_BUNNA_PAGE);
  });

  it("a transaction number is rejected before any request", async () => {
    const fetchSpy = vi.fn();
    vi.stubGlobal("fetch", fetchSpy);
    const r = await new Verifier().verify({ bank: "bunna", reference: "BB00001" });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error.kind).toBe("REF_ERROR");
    expect(fetchSpy).not.toHaveBeenCalled();
  });
});

describe("UI detection: Bunna", () => {
  it("a link is detected as Bunna; beta is flagged", () => {
    const d = detectInput(SYNTH_BUNNA_LINK);
    expect(d).toMatchObject({ kind: "url", needsAccount: false, needsPhone: false, beta: true });
    expect(d.bank?.code).toBe("bunna");
  });
});

describe("routes: Bunna", () => {
  it("POST /api/verify: link and QR share one cache entry", async () => {
    stubFetch(json(SYNTH_BUNNA_SUCCESS));
    const req = (reference: string) =>
      new NextRequest("https://cheki.et/api/verify", {
        method: "POST",
        headers: { "content-type": "application/json", ...freshIp() },
        body: JSON.stringify({ reference }),
      });
    const first = await verifyPOST(req(SYNTH_BUNNA_LINK));
    expect(first.status).toBe(200);
    expect(await first.json()).toMatchObject({ success: true, verified: true, sourceUrl: SYNTH_BUNNA_PAGE });
    const key = verificationCacheKey({ reference: SYNTH_BUNNA_LINK });
    expect(verificationCacheKey({ reference: SYNTH_BUNNA_QR })).toBe(key);
    expect(verificationCacheKey({ bank: "bunna", reference: SYNTH_BUNNA_TOKEN })).toBe(key);
    expect(verificationCacheKey({ bank: "bunna", reference: SYNTH_BUNNA_TOKEN.replace(/=$/, "") })).toBe(key);
  });

  it("POST /api/verify/batch checks Bunna links like single checks", async () => {
    stubFetch(json(SYNTH_BUNNA_FAILURE));
    const r = await batchPOST(
      new NextRequest("https://cheki.et/api/verify/batch", {
        method: "POST",
        headers: { "content-type": "application/json", ...freshIp() },
        body: JSON.stringify({ receipts: [{ reference: SYNTH_BUNNA_LINK.replace("0000000000Q", "0000000009Q") }] }),
      })
    );
    const body = JSON.stringify(await r.json());
    expect(body).toMatch(/did not return a receipt/);
    expect(body).not.toMatch(/"verified":true/);
  });
});

describe("health probe: Bunna", () => {
  it("probes an all-zero token and expects Bunna's FAILURE envelope", () => {
    const t = buildProbeTargets({ checkGeoRestricted: false }).find((x) => x.id === "bunna")!;
    expect(t.url).toBe(`https://online.bunnabanksc.com/st_backend/api/v1/advice?data=${encodeURIComponent("A".repeat(43) + "=")}`);
    const ok = { status: 200, contentType: "application/json", body: json(SYNTH_BUNNA_FAILURE) };
    expect(matchExpectation(ok, t.probe!.expect)).toEqual([]);
    expect(matchExpectation({ ...ok, body: json(SYNTH_BUNNA_SUCCESS) }, t.probe!.expect)).not.toEqual([]);
  });
});
