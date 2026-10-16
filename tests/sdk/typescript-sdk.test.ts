/**
 * TypeScript SDK (sdks/typescript) against the shared contract fixtures.
 * The same fixtures are checked against the real route handlers in
 * tests/contract/sdk-fixtures.test.ts, so a model that decodes them here
 * matches the live API.
 */
import { describe, it, expect, afterEach, vi } from "vitest";
import { readFileSync } from "node:fs";
import path from "node:path";
import {
  Cheki,
  isVerified,
  parseRetryAfter,
  ChekiAPIError,
  ChekiRateLimitError,
  ChekiPayloadTooLargeError,
  ChekiValidationError,
  ChekiNetworkError,
  ChekiTimeoutError,
  DEFAULT_TIMEOUT_MS,
  MAX_BATCH_SIZE,
  RECOMMENDED_BATCH_CHUNK,
  type BatchItemError,
} from "../../sdks/typescript/src/index";

type Case = { status: number; headers: Record<string, string>; body: unknown };
type RetryCase = { name: string; method: string; path: string; status: number; headers: Record<string, string>; body?: unknown; rawBody?: string; retried: boolean };
const contract = JSON.parse(readFileSync(path.resolve(__dirname, "../../sdks/fixtures/api-contract.json"), "utf8")) as {
  limits: Record<string, number>;
  cases: Record<string, Case>;
  retryCases: RetryCase[];
};
const fx = (name: string) => contract.cases[name];
const respond = (c: Case, extraHeaders: Record<string, string> = {}) =>
  new Response(JSON.stringify(c.body), { status: c.status, headers: { "content-type": "application/json", ...c.headers, ...extraHeaders } });

/** fetch stub that answers with the given fixtures in order (the last repeats). */
function serve(...answers: (Case | Error | (() => Response))[]) {
  const calls: { url: string; init: RequestInit }[] = [];
  const fn = vi.fn(async (url: string, init: RequestInit) => {
    calls.push({ url, init });
    const a = answers[Math.min(calls.length - 1, answers.length - 1)];
    if (a instanceof Error) throw a;
    if (typeof a === "function") return a();
    return respond(a);
  });
  vi.stubGlobal("fetch", fn);
  return calls;
}

const client = () => new Cheki("https://api.test");

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe("TS SDK: models decode the contract fixtures", () => {
  it("verify: verified result", async () => {
    const calls = serve(fx("verify_verified"));
    const r = await client().verify("cbe", "FT26SAMPLE01", { accountNumber: "1000000006171" });
    expect(isVerified(r)).toBe(true);
    expect(r.amount).toBe(1250.5);
    expect(r.cached).toBe(false);
    expect(calls[0].url).toBe("https://api.test/api/verify");
    expect(JSON.parse(String(calls[0].init.body))).toEqual({ bank: "cbe", reference: "FT26SAMPLE01", accountNumber: "1000000006171" });
  });

  it("verify: decodedOnly is success:true but NOT verified", async () => {
    serve(fx("verify_decoded_only"));
    const r = await client().verify("boa", "", { qrData: "abc" });
    expect(r.success).toBe(true);
    expect(r.decodedOnly).toBe(true);
    expect(isVerified(r)).toBe(false);
  });

  it("QR-only verify does not send an empty reference", async () => {
    const calls = serve(fx("verify_decoded_only"));
    await client().verify("boa", "", { qrData: "abc" });
    expect(JSON.parse(String(calls[0].init.body))).toEqual({ bank: "boa", qrData: "abc" });
  });

  it("parse fixture: parsed results are never verified", () => {
    expect(isVerified(fx("parse_client_supplied").body)).toBe(false);
  });

  it("batch: results with index, verified/failed/cached counts, error items", async () => {
    serve(fx("batch_mixed"));
    const b = await client().verifyBatch([
      { bank: "cbe", reference: "A1", accountNumber: "1000000006171" },
      { bank: "boa", qrData: "q" },
      { bank: "telebirr", reference: "B2" },
    ]);
    expect(b).toMatchObject({ total: 3, verified: 1, failed: 2, cached: 0 });
    expect(b.results.map((r) => r.index)).toEqual([0, 1, 2]);
    expect(b.results.filter(isVerified)).toHaveLength(1);
    const e = b.results[2] as BatchItemError;
    expect(e).toMatchObject({ success: false, status: 422 });
  });

  it("verify: orderId is passed through", async () => {
    serve(fx("verify_order_id"));
    const r = await client().verify("cbebirr", "CB2610ABCD", { phoneNumber: "251911000000" });
    expect(r.orderId).toBe("ORD123456789");
  });

  it("batch error items keep fallbackUrl when the server sends it", async () => {
    serve(() =>
      new Response(
        JSON.stringify({
          success: true,
          results: [{ success: false, error: "geo-blocked", status: 502, fallbackUrl: "https://transactioninfo.ethiotelecom.et/receipt/X1" }],
          total: 1, verified: 0, failed: 1, cached: 0,
        }),
        { status: 200, headers: { "content-type": "application/json" } },
      ),
    );
    const b = await client().verifyBatch([{ bank: "telebirr", reference: "X1" }]);
    expect((b.results[0] as BatchItemError).fallbackUrl).toBe("https://transactioninfo.ethiotelecom.et/receipt/X1");
  });

  it("banks: id is the bank id; code is a deprecated alias; requiresPhone defaults to false", async () => {
    serve(fx("banks"));
    const { banks } = await client().getBanks();
    expect(banks[0].id).toBe("cbe");
    expect(banks[0].code).toBe("cbe");
    expect(banks[0].requiresPhone).toBe(false);
    expect(banks.find((b) => b.id === "cbebirr")?.requiresPhone).toBe(true);
    expect(banks.find((b) => b.id === "telebirr")?.type).toBe("mobile");
    // beta is always a boolean: true for M-Pesa and ZamZam, false when omitted.
    expect(banks.find((b) => b.id === "zamzam")?.beta).toBe(true);
    expect(banks.find((b) => b.id === "mpesa")?.beta).toBe(true);
    expect(banks[0].beta).toBe(false);
    // Formats come current first: CBE leads with the Receipt ID, the FT reference is legacy.
    expect(banks[0].requiresAccount).toBe(false);
    expect(banks[0].formats.map((f) => f.status)).toEqual(["current", "legacy"]);
    expect(banks[0].formats[0].inputs).toEqual(["receiptId"]);
    expect(banks[0].formats[1].accountDigits).toBe(8);
  });

  it("health: status, checkedAt, cached, banks", async () => {
    serve(fx("health"));
    const h = await client().getHealth();
    expect(h.status).toBe("ok");
    expect(h.checkedAt).toMatch(/^2026-/);
    expect(h.cached).toBe(false);
    expect(h.banks[1]).toMatchObject({ id: "telebirr", status: "geo-blocked" });
  });

  it("GET requests send no Content-Type", async () => {
    const calls = serve(fx("health"));
    await client().getHealth();
    expect((calls[0].init.headers as Record<string, string>)["Content-Type"]).toBeUndefined();
  });
});

describe("TS SDK: errors and retries", () => {
  it("defaults: timeout above the server's 60 s budget", () => {
    expect(DEFAULT_TIMEOUT_MS).toBe(contract.limits.sdkTimeoutSeconds * 1000);
    expect(DEFAULT_TIMEOUT_MS).toBeGreaterThan(contract.limits.serverMaxDurationSeconds * 1000);
    expect(MAX_BATCH_SIZE).toBe(contract.limits.batchMaxReceipts);
  });

  for (const name of ["error_400_missing_input", "error_404_unsupported_bank", "error_422_not_found"]) {
    it(`${name}: thrown once, never retried, server message kept`, async () => {
      const calls = serve(fx(name));
      const e = await client().verify("cbe", "X").catch((x) => x);
      expect(e).toBeInstanceOf(ChekiAPIError);
      expect(e.statusCode).toBe(fx(name).status);
      expect(e.serverMessage).toBe((fx(name).body as { error: string }).error);
      expect(e.message).toContain(e.serverMessage);
      expect(calls).toHaveLength(1);
    });
  }

  it("413 is a ChekiPayloadTooLargeError and is not retried", async () => {
    const calls = serve(fx("error_413_body_too_large"));
    const e = await client().verify("cbe", "X").catch((x) => x);
    expect(e).toBeInstanceOf(ChekiPayloadTooLargeError);
    expect(e.statusCode).toBe(413);
    expect(calls).toHaveLength(1);
  });

  it("429 twice: one retry, then ChekiRateLimitError with retryAfterSeconds", async () => {
    const calls = serve(() => respond(fx("error_429_rate_limited"), { "retry-after": "0" }));
    const e = await client().verify("cbe", "X").catch((x) => x);
    expect(e).toBeInstanceOf(ChekiRateLimitError);
    expect(e.retryAfterSeconds).toBe(0);
    expect(calls).toHaveLength(2);
  });

  it("429 with a short Retry-After, then success", async () => {
    const calls = serve(() => respond(fx("error_429_rate_limited"), { "retry-after": "0" }), fx("verify_verified"));
    const r = await client().verify("cbe", "X", { accountNumber: "1" });
    expect(isVerified(r)).toBe(true);
    expect(calls).toHaveLength(2);
  });

  it("502 geo-blocked: never retried, fallbackUrl exposed", async () => {
    const calls = serve(() => respond(fx("error_502_geo_blocked"), { "retry-after": "0" }));
    const e = await client().verify("telebirr", "CHQ0SAMPLE").catch((x) => x);
    expect(e).toBeInstanceOf(ChekiAPIError);
    expect(e.fallbackUrl).toMatch(/^https:\/\/transactioninfo/);
    expect(calls).toHaveLength(1);
  });

  describe("shared retryCases fixture (the same rule in every SDK)", () => {
    for (const rc of contract.retryCases) {
      it(`${rc.name}: ${rc.retried ? "retried once" : "not retried"}`, async () => {
        const calls = serve(
          () =>
            new Response(rc.rawBody ?? JSON.stringify(rc.body), {
              status: rc.status,
              headers: { "content-type": "application/json", ...rc.headers },
            }),
        );
        const c = client();
        const run =
          rc.path === "/api/verify"
            ? c.verify("telebirr", "CHQ0SAMPLE")
            : rc.path === "/api/verify/batch"
              ? c.verifyBatch([{ bank: "telebirr", reference: "CHQ0SAMPLE" }])
              : rc.path === "/api/banks"
                ? c.getBanks()
                : c.getHealth();
        const e = await run.catch((x) => x);
        expect(e).toBeInstanceOf(ChekiAPIError);
        expect(e.statusCode).toBe(rc.status);
        expect(calls[0].init.method).toBe(rc.method);
        expect(calls).toHaveLength(rc.retried ? 2 : 1);
      });
    }
  });

  it("maxRetries above 1 is capped at 1", async () => {
    const calls = serve(() => respond(fx("error_500_internal"), { "retry-after": "0" }));
    await new Cheki({ baseUrl: "https://api.test", maxRetries: 5 }).getHealth().catch(() => {});
    expect(calls).toHaveLength(2);
  });

  it("retries: 0 disables the retry", async () => {
    const calls = serve(() => respond(fx("error_500_internal"), { "retry-after": "0" }));
    await client().getHealth({ retries: 0 }).catch(() => {});
    expect(calls).toHaveLength(1);
  });

  it("network errors are retried once for GET and verify", async () => {
    let calls = serve(new TypeError("fetch failed"));
    let e = await client().getBanks().catch((x) => x);
    expect(e).toBeInstanceOf(ChekiNetworkError);
    expect(calls).toHaveLength(2);
    calls = serve(new TypeError("fetch failed"));
    e = await client().verify("cbe", "X").catch((x) => x);
    expect(e).toBeInstanceOf(ChekiNetworkError);
    expect(calls).toHaveLength(2);
  }, 10_000);

  it("a batch is not replayed after a network error", async () => {
    const calls = serve(new TypeError("fetch failed"));
    const e = await client().verifyBatch([{ bank: "cbe", reference: "X" }]).catch((x) => x);
    expect(e).toBeInstanceOf(ChekiNetworkError);
    expect(calls).toHaveLength(1);
  });

  it("recommended batch chunk is within the batch limit", () => {
    expect(RECOMMENDED_BATCH_CHUNK).toBeLessThanOrEqual(MAX_BATCH_SIZE);
  });

  it("timeouts are not retried", async () => {
    const fn = vi.fn(
      (_url: string, init: RequestInit) =>
        new Promise<Response>((_, reject) => init.signal?.addEventListener("abort", () => reject(new DOMException("aborted", "AbortError"))))
    );
    vi.stubGlobal("fetch", fn);
    const e = await new Cheki({ baseUrl: "https://api.test", timeoutMs: 20 }).verify("cbe", "X").catch((x) => x);
    expect(e).toBeInstanceOf(ChekiTimeoutError);
    expect(fn).toHaveBeenCalledTimes(1);
  });

  it("batch over 20 receipts fails client-side without a request", async () => {
    const calls = serve(fx("batch_mixed"));
    const receipts = Array.from({ length: 21 }, (_, i) => ({ bank: "telebirr", reference: `R${i}` }));
    await expect(client().verifyBatch(receipts)).rejects.toBeInstanceOf(ChekiValidationError);
    await expect(client().verifyBatch([])).rejects.toBeInstanceOf(ChekiValidationError);
    expect(calls).toHaveLength(0);
  });

  it("parseRetryAfter handles seconds and HTTP dates", () => {
    expect(parseRetryAfter("17")).toBe(17);
    expect(parseRetryAfter(new Date(Date.now() + 5000).toUTCString())).toBeGreaterThanOrEqual(4);
    expect(parseRetryAfter("soon")).toBeUndefined();
    expect(parseRetryAfter(null)).toBeUndefined();
  });
});

describe("TS SDK: getReceiptUrl matches /api/receipt validation", () => {
  type UrlCase = { name: string; bank: string; reference: string; account?: string; query?: Record<string, string>; error?: boolean };
  const urlCases = (contract as unknown as { receiptUrlCases: UrlCase[] }).receiptUrlCases;

  it("follows every shared receiptUrlCases fixture (current formats need no account, legacy CBE FT does)", () => {
    expect(urlCases.length).toBeGreaterThan(5);
    for (const c of urlCases) {
      if (c.error) {
        expect(() => client().getReceiptUrl(c.bank, c.reference, c.account), c.name).toThrow(ChekiValidationError);
        continue;
      }
      const u = new URL(client().getReceiptUrl(c.bank, c.reference, c.account));
      expect(u.origin + u.pathname, c.name).toBe("https://api.test/api/receipt");
      expect(Object.fromEntries(u.searchParams), c.name).toEqual(c.query);
    }
  });

  it("leads with the current format: a CBE Receipt ID needs no account", () => {
    expect(client().getReceiptUrl("cbe", "fHCxExampleRcpt01")).toBe("https://api.test/api/receipt?bank=cbe&reference=fHCxExampleRcpt01");
    expect(() => client().getReceiptUrl("cbe", "FT26SAMPLE01")).toThrow(/older cbe FT reference/);
  });
});
