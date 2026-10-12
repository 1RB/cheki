/**
 * ZamZam Bank: receipt links, the numeric receipt id, the JSON record, the
 * masking of the full account number, and the verify / receipt / health
 * paths around them. All data is synthetic (tests/fixtures/zamzam/records.ts).
 */
import { describe, it, expect, afterEach, vi } from "vitest";
import { NextRequest } from "next/server";
import { detectBankFromUrl } from "@/lib/adapters/url-detector";
import { ZamZamParser, maskAccount, checkZamzamId } from "@/lib/parsers/zamzam";
import { getParser } from "@/lib/parsers/registry";
import { Verifier } from "@/lib";
import { isAllowedUrl } from "@/lib/security/hosts";
import { safeFetch } from "@/lib/http/safe-fetch";
import { verificationGate } from "@/lib/core/gate";
import { buildProbeTargets, matchExpectation } from "@/lib/health";
import { detectInput } from "@/lib/verify/detect";
import { getBank } from "@/lib/manifest/loader";
import { verificationCacheKey } from "@/lib/receipt-cache";
import { GET as receiptGET } from "@/app/api/receipt/route";
import { POST as verifyPOST } from "@/app/api/verify/route";
import { POST as batchPOST } from "@/app/api/verify/batch/route";
import "@/lib/parsers";
import {
  SYNTH_ZAMZAM_ACCOUNT,
  SYNTH_ZAMZAM_ACCOUNT_MASKED,
  SYNTH_ZAMZAM_CHARGE,
  SYNTH_ZAMZAM_CREDIT,
  SYNTH_ZAMZAM_DEBIT,
  SYNTH_ZAMZAM_ID,
  SYNTH_ZAMZAM_LINK,
  json,
} from "../fixtures/zamzam/records";

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

const API = "https://receipt-backend.zamzambank.com.et/api/v1/invoice/";
const BASIC = `Basic ${Buffer.from("zzbmob:zzb@12#2024").toString("base64")}`;

let ipCounter = 0;
function freshIp(): Record<string, string> {
  ipCounter++;
  return { "x-forwarded-for": `10.77.${Math.floor(ipCounter / 250)}.${ipCounter % 250}` };
}

/** fetch stub answering every request with `body`, recording URL + headers. */
function stubFetch(body: string, status = 200) {
  const calls: { url: string; headers: Record<string, string> }[] = [];
  vi.stubGlobal(
    "fetch",
    vi.fn(async (url: string, init?: RequestInit) => {
      calls.push({ url: String(url), headers: { ...(init?.headers as Record<string, string>) } });
      return new Response(body, { status, headers: { "content-type": "application/json" } });
    })
  );
  return calls;
}

describe("detectBankFromUrl: ZamZam links", () => {
  it("reads the receipt id from the link", () => {
    expect(detectBankFromUrl(SYNTH_ZAMZAM_LINK)).toEqual({ bank: "zamzam", reference: SYNTH_ZAMZAM_ID });
  });

  it("ignores a trailing slash, a query and a fragment", () => {
    expect(detectBankFromUrl(`${SYNTH_ZAMZAM_LINK}/`)).toEqual({ bank: "zamzam", reference: SYNTH_ZAMZAM_ID });
    expect(detectBankFromUrl(`${SYNTH_ZAMZAM_LINK}?lang=en&x=1`)).toEqual({ bank: "zamzam", reference: SYNTH_ZAMZAM_ID });
    expect(detectBankFromUrl(`${SYNTH_ZAMZAM_LINK}/?utm=a#top`)).toEqual({ bank: "zamzam", reference: SYNTH_ZAMZAM_ID });
    expect(detectBankFromUrl(SYNTH_ZAMZAM_LINK.replace("https://receipt.", "HTTPS://RECEIPT."))).toEqual({ bank: "zamzam", reference: SYNTH_ZAMZAM_ID });
  });

  it("only recognises exactly receipt.zamzambank.com.et and /receipt/{id}", () => {
    expect(detectBankFromUrl(`https://evil.example/receipt/${SYNTH_ZAMZAM_ID}`)).toBeNull();
    expect(detectBankFromUrl(`https://receipt.zamzambank.com.et.evil.example/receipt/${SYNTH_ZAMZAM_ID}`)).toBeNull();
    expect(detectBankFromUrl(`https://x.receipt.zamzambank.com.et/receipt/${SYNTH_ZAMZAM_ID}`)).toBeNull();
    expect(detectBankFromUrl(`https://receipt-backend.zamzambank.com.et/api/v1/invoice/${SYNTH_ZAMZAM_ID}`)).toBeNull();
    expect(detectBankFromUrl("https://receipt.zamzambank.com.et/")).toBeNull();
    expect(detectBankFromUrl(`https://receipt.zamzambank.com.et/other/${SYNTH_ZAMZAM_ID}`)).toBeNull();
    expect(detectBankFromUrl(`https://user:pw@receipt.zamzambank.com.et/receipt/${SYNTH_ZAMZAM_ID}`)).toBeNull();
  });

  it("passes a non-numeric id through so the parser rejects it with a clear message", () => {
    expect(detectBankFromUrl("https://receipt.zamzambank.com.et/receipt/abc")).toEqual({ bank: "zamzam", reference: "abc" });
  });
});

describe("ZamZam receipt id", () => {
  it("accepts digits only, up to 12", () => {
    expect(checkZamzamId(` ${SYNTH_ZAMZAM_ID} `)).toEqual({ ok: true, value: SYNTH_ZAMZAM_ID });
    expect(checkZamzamId("999999999999").ok).toBe(true);
    expect(checkZamzamId("0012345678")).toEqual({ ok: true, value: SYNTH_ZAMZAM_ID });
    expect(checkZamzamId("0")).toEqual({ ok: true, value: "0" });
    for (const bad of ["", "abc", "1234a678", "1234567890123", "12345678-12345690", "1..9", "../1", "12 34", "1e5", "-1"]) {
      expect(checkZamzamId(bad).ok, bad).toBe(false);
    }
  });

  it("builds the backend URL on the fixed host and never puts the credential in it", () => {
    const p = getParser("zamzam")!;
    const url = p.buildUrl(SYNTH_ZAMZAM_ID);
    expect(url).toBe(`${API}${SYNTH_ZAMZAM_ID}`);
    expect(url).not.toMatch(/zzbmob|@|Basic/);
    expect(() => p.buildUrl("../x")).toThrow();
    expect(() => p.buildUrl("1-9")).toThrow();
  });

  it("the backend host is allowlisted; the receipt page host is not fetched", () => {
    expect(isAllowedUrl(`${API}${SYNTH_ZAMZAM_ID}`)).toBe(true);
    expect(isAllowedUrl(`http://receipt-backend.zamzambank.com.et/api/v1/invoice/1`)).toBe(false);
    expect(isAllowedUrl(SYNTH_ZAMZAM_LINK)).toBe(false);
  });
});

describe("maskAccount", () => {
  it("keeps the first digit and the last 4", () => {
    expect(maskAccount(SYNTH_ZAMZAM_ACCOUNT)).toBe(SYNTH_ZAMZAM_ACCOUNT_MASKED);
    expect(maskAccount("1234567")).toBe("1**4567");
    expect(maskAccount("12345")).toBe("*****");
    expect(maskAccount("NULL")).toBeUndefined();
    expect(maskAccount(null)).toBeUndefined();
  });
});

describe("ZamZamParser.parseRecord", () => {
  it("debit: the account holder is the sender, account masked, date only, vat unmapped", () => {
    const { parsed, notFound } = ZamZamParser.parseRecord(json(SYNTH_ZAMZAM_DEBIT), SYNTH_ZAMZAM_ID);
    expect(notFound).toBe(false);
    expect(parsed).toMatchObject({
      verified: true,
      senderName: "TEST HOLDER ONE",
      senderAccount: SYNTH_ZAMZAM_ACCOUNT_MASKED,
      amount: 50,
      currency: "ETB",
      date: "2026-08-26",
      reference: "000TEST00000001",
      transactionType: "TELE BIRR OUT GOING",
    });
    // other_NAME "NULL" is missing, so there is no receiver at all (no empty keys).
    expect("receiverName" in parsed).toBe(false);
    expect("receiverAccount" in parsed).toBe(false);
    expect(parsed.serviceFeeVat).toBeUndefined();
    expect(parsed.serviceFee).toBeUndefined();
    for (const v of Object.values(parsed)) expect(v).not.toBe("NULL");
  });

  it("credit: the account holder is the receiver, other_NAME the sender", () => {
    const { parsed } = ZamZamParser.parseRecord(json(SYNTH_ZAMZAM_CREDIT), "12345679");
    expect(parsed).toMatchObject({
      verified: true,
      senderName: "TEST SENDER TWO",
      receiverName: "TEST HOLDER ONE",
      receiverAccount: SYNTH_ZAMZAM_ACCOUNT_MASKED,
      amount: 1250.5,
    });
    expect("senderAccount" in parsed).toBe(false);
  });

  it("a charge record (CH1) parses like a debit", () => {
    const { parsed } = ZamZamParser.parseRecord(json(SYNTH_ZAMZAM_CHARGE), "12345680");
    expect(parsed).toMatchObject({ verified: true, senderName: "TEST HOLDER ONE", amount: 5, transactionType: "CHARGES" });
  });

  it("keeps the full account number and the names out of raw", () => {
    for (const rec of [SYNTH_ZAMZAM_DEBIT, SYNTH_ZAMZAM_CREDIT]) {
      const { parsed } = ZamZamParser.parseRecord(json(rec), String(rec.id));
      expect(parsed.raw).toBeTruthy();
      expect(parsed.raw).not.toContain(SYNTH_ZAMZAM_ACCOUNT);
      expect(parsed.raw).not.toContain("TEST HOLDER ONE");
      expect(parsed.raw).not.toContain("TEST SENDER TWO");
      expect(JSON.stringify(parsed)).not.toContain(SYNTH_ZAMZAM_ACCOUNT);
    }
  });

  it("null body: not found", () => {
    expect(ZamZamParser.parseRecord("null", SYNTH_ZAMZAM_ID)).toEqual({ parsed: { verified: false }, notFound: true });
    expect(ZamZamParser.parseRecord(" null\n", SYNTH_ZAMZAM_ID).notFound).toBe(true);
  });

  it("a record for another id, an unknown drcr, or junk is never verified", () => {
    expect(ZamZamParser.parseRecord(json(SYNTH_ZAMZAM_DEBIT), "87654321").parsed.verified).toBe(false);
    expect(ZamZamParser.parseRecord(json({ ...SYNTH_ZAMZAM_DEBIT, id: null }), SYNTH_ZAMZAM_ID).parsed.verified).toBe(false);
    for (const body of ["", "{", "[]", "[{}]", "\"x\"", "42", "<html></html>"]) {
      expect(ZamZamParser.parseRecord(body, SYNTH_ZAMZAM_ID).parsed.verified, body).toBe(false);
    }
    // Unknown side: parsed, but no party, so the shared gate fails it.
    const odd = ZamZamParser.parseRecord(json({ ...SYNTH_ZAMZAM_DEBIT, drcr: "X" }), SYNTH_ZAMZAM_ID).parsed;
    expect(verificationGate(odd, { bankId: "zamzam", requestedReference: SYNTH_ZAMZAM_ID })).toEqual({ ok: false, reason: "party" });
  });

  it("the gate accepts the record although its reference differs from the id", () => {
    const { parsed } = ZamZamParser.parseRecord(json(SYNTH_ZAMZAM_DEBIT), SYNTH_ZAMZAM_ID);
    expect(verificationGate(parsed, { bankId: "zamzam", requestedReference: SYNTH_ZAMZAM_ID })).toEqual({ ok: true });
  });

  it("a zero or missing amount fails the gate", () => {
    const zero = ZamZamParser.parseRecord(json({ ...SYNTH_ZAMZAM_DEBIT, amount: "0" }), SYNTH_ZAMZAM_ID).parsed;
    expect(verificationGate(zero, { bankId: "zamzam" })).toMatchObject({ ok: false, reason: "amount" });
    const none = ZamZamParser.parseRecord(json({ ...SYNTH_ZAMZAM_DEBIT, amount: "NULL" }), SYNTH_ZAMZAM_ID).parsed;
    expect(verificationGate(none, { bankId: "zamzam" })).toMatchObject({ ok: false, reason: "amount" });
  });
});

describe("Verifier: ZamZam", () => {
  it("a link verifies against the backend with the Basic header; sourceUrl is the public page", async () => {
    const calls = stubFetch(json(SYNTH_ZAMZAM_DEBIT));
    const r = await new Verifier().verify({ bank: "", reference: `${SYNTH_ZAMZAM_LINK}/?x=1` });
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(calls).toHaveLength(1);
    expect(calls[0].url).toBe(`${API}${SYNTH_ZAMZAM_ID}`);
    expect(calls[0].headers.Authorization).toBe(BASIC);
    expect(r.value).toMatchObject({
      verified: true,
      bank: "ZamZam Bank",
      bankCode: "zamzam",
      reference: "000TEST00000001",
      sourceUrl: SYNTH_ZAMZAM_LINK,
      senderAccount: SYNTH_ZAMZAM_ACCOUNT_MASKED,
      date: "2026-08-26",
    });
    const out = JSON.stringify(r.value);
    expect(out).not.toContain(SYNTH_ZAMZAM_ACCOUNT);
    expect(out).not.toMatch(/zzbmob|zzb@|Basic |receipt-backend/);
    expect("raw" in r.value).toBe(false);
  });

  it("a bare id works when the bank is ZamZam", async () => {
    stubFetch(json(SYNTH_ZAMZAM_DEBIT));
    const r = await new Verifier().verify({ bank: "zamzam", reference: SYNTH_ZAMZAM_ID });
    expect(r.ok && r.value.verified).toBe(true);
  });

  it("a null body is not found (verified false, no receipt)", async () => {
    stubFetch("null");
    const r = await new Verifier().verify({ bank: "zamzam", reference: SYNTH_ZAMZAM_ID });
    expect(r.ok).toBe(false);
    if (r.ok) return;
    expect(r.error.kind).toBe("EXTRACTION_ERROR");
    expect("message" in r.error && r.error.message).toMatch(/no receipt with this id/);
  });

  it("a record for another id is rejected", async () => {
    stubFetch(json({ ...SYNTH_ZAMZAM_DEBIT, id: 87654321 }));
    const r = await new Verifier().verify({ bank: "zamzam", reference: SYNTH_ZAMZAM_ID });
    expect(r.ok).toBe(false);
  });

  it("a non-numeric id or a range is rejected before any request", async () => {
    const fetchSpy = vi.fn();
    vi.stubGlobal("fetch", fetchSpy);
    for (const input of [
      { bank: "", reference: "https://receipt.zamzambank.com.et/receipt/abc" },
      { bank: "zamzam", reference: "abc" },
      { bank: "zamzam", reference: "12345678-12345690" },
      { bank: "zamzam", reference: "1234567890123" },
    ]) {
      const r = await new Verifier().verify(input);
      expect(r.ok, input.reference).toBe(false);
      if (!r.ok) expect(r.error.kind, input.reference).toBe("REF_ERROR");
    }
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it("a 401 (credential rejected) is an endpoint error, not a verdict on the receipt", async () => {
    stubFetch("", 401);
    const r = await new Verifier().verify({ bank: "zamzam", reference: SYNTH_ZAMZAM_ID });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error.kind).toBe("ENDPOINT_ERROR");
  });

  it("a bare id without a bank is not guessed as ZamZam", () => {
    expect(getBank("zamzam")?.refPattern).toBeUndefined();
    const d = detectInput(SYNTH_ZAMZAM_ID);
    expect(d.bank?.code).not.toBe("zamzam");
    expect(d.candidates.map((b) => b.code)).not.toContain("zamzam");
  });
});

describe("UI detection: ZamZam", () => {
  it("a link is detected as ZamZam with its id; beta is flagged", () => {
    const d = detectInput(SYNTH_ZAMZAM_LINK);
    expect(d).toMatchObject({ kind: "url", urlReference: SYNTH_ZAMZAM_ID, needsAccount: false, needsPhone: false, beta: true });
    expect(d.bank?.code).toBe("zamzam");
    expect(d.betaNote).toMatch(/inferred/);
  });

  it("a bare id goes to ZamZam when the user picks it", () => {
    const d = detectInput(SYNTH_ZAMZAM_ID, { overrideBank: "zamzam" });
    expect(d).toMatchObject({ kind: "reference", needsAccount: false, needsPhone: false, overridden: true });
    expect(d.bank?.code).toBe("zamzam");
  });
});

describe("routes: ZamZam", () => {
  it("POST /api/verify: masked account in the response and the cache, no credential", async () => {
    stubFetch(json(SYNTH_ZAMZAM_CREDIT));
    const ref = "https://receipt.zamzambank.com.et/receipt/12345679";
    const req = () =>
      new NextRequest("https://cheki.et/api/verify", {
        method: "POST",
        headers: { "content-type": "application/json", ...freshIp() },
        body: JSON.stringify({ reference: ref }),
      });
    const first = await verifyPOST(req());
    expect(first.status).toBe(200);
    const a = await first.json();
    expect(a).toMatchObject({ success: true, verified: true, receiverAccount: SYNTH_ZAMZAM_ACCOUNT_MASKED, sourceUrl: ref });
    const second = await verifyPOST(req());
    expect(second.headers.get("x-cheki-cache")).toBe("hit");
    const b = await second.json();
    for (const body of [a, b]) {
      const text = JSON.stringify(body);
      expect(text).not.toContain(SYNTH_ZAMZAM_ACCOUNT);
      expect(text).not.toMatch(/zzbmob|zzb@|Basic /);
    }
    // A link and its bare id share one cache entry.
    expect(verificationCacheKey({ reference: ref })).toBe(verificationCacheKey({ bank: "zamzam", reference: "12345679" }));
  });

  it("POST /api/verify/batch checks ZamZam links like single checks", async () => {
    stubFetch("null");
    const r = await batchPOST(
      new NextRequest("https://cheki.et/api/verify/batch", {
        method: "POST",
        headers: { "content-type": "application/json", ...freshIp() },
        body: JSON.stringify({ receipts: [{ reference: "https://receipt.zamzambank.com.et/receipt/99999990" }] }),
      })
    );
    const body = await r.json();
    expect(JSON.stringify(body)).toMatch(/no receipt with this id/);
    expect(JSON.stringify(body)).not.toMatch(/"verified":true/);
  });

  it("GET /api/receipt redirects to the public receipt page and validates the id", async () => {
    const fetchSpy = vi.fn();
    vi.stubGlobal("fetch", fetchSpy);
    const ok = await receiptGET(new NextRequest(`https://cheki.et/api/receipt?bank=zamzam&reference=${SYNTH_ZAMZAM_ID}`, { headers: freshIp() }));
    expect(ok.status).toBe(302);
    expect(ok.headers.get("location")).toBe(SYNTH_ZAMZAM_LINK);
    const bad = await receiptGET(new NextRequest("https://cheki.et/api/receipt?bank=zamzam&reference=abc", { headers: freshIp() }));
    expect(bad.status).toBe(400);
    expect(fetchSpy).not.toHaveBeenCalled();
  });
});

describe("health probe: ZamZam", () => {
  it("probes an id far past the issued range, with the parser's header", () => {
    const t = buildProbeTargets({ checkGeoRestricted: false }).find((x) => x.id === "zamzam")!;
    expect(t.url).toBe(`${API}999999999999`);
    expect(t.headers?.Authorization).toBe(BASIC);
    expect(t.probe?.expect).toMatchObject({ status: 200, contentType: "json", bodyIs: "null" });
    const ok = { status: 200, contentType: "application/json", body: "null" };
    expect(matchExpectation(ok, t.probe!.expect)).toEqual([]);
    // A real record (it also contains null values) is not the expected shape.
    expect(matchExpectation({ ...ok, body: json(SYNTH_ZAMZAM_DEBIT) }, t.probe!.expect)).not.toEqual([]);
  });
});

describe("safeFetch: credentials never follow a cross-origin redirect", () => {
  it("drops Authorization on a redirect to another allowlisted host, keeps it on the same origin", async () => {
    const seen: { url: string; auth?: string }[] = [];
    vi.stubGlobal(
      "fetch",
      vi.fn(async (url: string, init?: RequestInit) => {
        const h = (init?.headers ?? {}) as Record<string, string>;
        seen.push({ url: String(url), auth: h.Authorization });
        if (seen.length === 1) return new Response(null, { status: 302, headers: { location: `${API}2` } });
        if (seen.length === 2) return new Response(null, { status: 302, headers: { location: "https://cs.bankofabyssinia.com/api/onlineSlip/getDetails/?id=x" } });
        return new Response("{}", { status: 200 });
      })
    );
    await safeFetch(`${API}1`, { headers: { Authorization: BASIC, "User-Agent": "t" }, timeoutMs: 5000, maxBytes: 1024 });
    expect(seen.map((s) => s.auth)).toEqual([BASIC, BASIC, undefined]);
  });
});
