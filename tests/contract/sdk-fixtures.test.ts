/**
 * The SDK contract fixtures (sdks/fixtures/api-contract.json) must match what
 * the route handlers really send. Every SDK's own tests decode that file, so
 * this test is what stops the SDK models drifting from the API again: change
 * a route's response and this fails until the fixture (and so every SDK test)
 * is updated with it.
 *
 * Shapes are compared, not values: the same keys (allowing documented
 * optional receipt fields), the same JSON types.
 */
import { describe, it, expect, afterEach, vi } from "vitest";
import { readFileSync } from "node:fs";
import path from "node:path";
import { NextRequest } from "next/server";
import { POST as verifyPOST } from "@/app/api/verify/route";
import { POST as batchPOST } from "@/app/api/verify/batch/route";
import { POST as parsePOST } from "@/app/api/parse/route";
import { GET as banksGET } from "@/app/api/banks/route";
import { GET as healthGET } from "@/app/api/health/route";
import { GET as receiptGET } from "@/app/api/receipt/route";
import { Verifier } from "@/lib";
import { ok, err } from "@/lib/core/types";
import type { Receipt } from "@/lib/core/types";
import { MAX_ATTEMPTS } from "@/lib/parsers/base";
import { limiters } from "@/lib/rate-limit";

type Json = null | boolean | number | string | Json[] | { [k: string]: Json };
type Case = { method: string; path: string; status: number; headers: Record<string, string>; body: Record<string, Json> };
type Contract = { limits: Record<string, Json>; cases: Record<string, Case> };

const contract: Contract = JSON.parse(
  readFileSync(path.resolve(__dirname, "../../sdks/fixtures/api-contract.json"), "utf8")
);
const fx = (name: string): Case => {
  const c = contract.cases[name];
  if (!c) throw new Error(`missing fixture ${name}`);
  return c;
};

/** Optional receipt fields a verify/parse result may or may not carry. */
const RECEIPT_OPTIONAL = new Set([
  "senderName", "senderAccount", "receiverName", "receiverAccount", "amount", "currency", "date",
  "branch", "reason", "transactionType", "durationMs", "invoiceNumber", "transactionStatus",
  "settledAmount", "stampDuty", "discountAmount", "serviceFee", "serviceFeeVat", "totalPaid",
  "amountInWords", "paymentMode", "paymentChannel", "bankAccountNumber", "bankAccountName", "decodedOnly", "orderId",
]);
const BANK_OPTIONAL = new Set(["swift", "accountDigits", "requiresPhone", "beta"]);

const kind = (v: unknown) => (Array.isArray(v) ? "array" : v === null ? "null" : typeof v);

/**
 * `actual` must have every non-optional key of `expected`, no key outside
 * expected ∪ optional, and the same JSON type for every shared key.
 */
function expectShape(actual: Record<string, unknown>, expected: Record<string, unknown>, optional = new Set<string>(), where = "") {
  for (const k of Object.keys(expected)) {
    if (optional.has(k)) continue;
    expect(Object.keys(actual), `${where} missing "${k}"`).toContain(k);
  }
  for (const k of Object.keys(actual)) {
    expect(k in expected || optional.has(k), `${where} unexpected key "${k}"`).toBe(true);
    if (k in expected) expect(kind(actual[k]), `${where}.${k} type`).toBe(kind(expected[k]));
  }
}

/**
 * Limiters that guard routes outside the SDK contract. /api/contribute is the
 * website's private "help us add a bank" form: it forwards to Telegram, has no
 * SDK method, is not in the API docs, and uses a 10-minute window, so it does
 * not belong in rateLimitPerMinute. Any limiter not listed here is treated as
 * public API and must appear in the fixture, so adding one forces a decision.
 */
const INTERNAL_LIMITERS = new Set(["contribute"]);

let ip = 0;
const freshIp = () => ({ "x-real-ip": `10.77.${Math.floor(++ip / 250)}.${ip % 250}` });
const jsonReq = (url: string, body: unknown, headers: Record<string, string> = freshIp()) =>
  new NextRequest(`https://cheki.et${url}`, {
    method: "POST",
    headers: { "content-type": "application/json", ...headers },
    body: typeof body === "string" ? body : JSON.stringify(body),
  });

/** The receipt part of a fixture body, as the Verifier would return it. */
function receiptOf(body: Record<string, Json>, reference: string): Receipt {
  const r: Record<string, unknown> = { ...body, reference };
  delete r.success;
  delete r.cached;
  return r as unknown as Receipt;
}

let refCounter = 0;
const uniqueRef = () => `FT2699CT${String(++refCounter).padStart(4, "0")}`;

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

describe("SDK contract fixtures match the route handlers", () => {
  it("limits in the fixture match the server constants", () => {
    expect(contract.limits.serverAttemptsPerReceipt).toBe(MAX_ATTEMPTS);
    expect(contract.limits.batchMaxReceipts).toBe(20);
    const perMinute = contract.limits.rateLimitPerMinute as Record<string, number>;
    const publicLimiters = Object.entries(limiters).filter(([name]) => !INTERNAL_LIMITERS.has(name));
    expect(publicLimiters.map(([name]) => name).sort()).toEqual(Object.keys(perMinute).sort());
    for (const [name, limiter] of publicLimiters) {
      const { limit, windowMs } = limiter as unknown as { limit: number; windowMs: number };
      expect(limit, `${name} limit`).toBe(perMinute[name]);
      expect(windowMs, `${name} window`).toBe(60_000);
    }
    for (const name of INTERNAL_LIMITERS) expect(name in limiters, `internal limiter ${name} exists`).toBe(true);
    expect(contract.limits.sdkTimeoutSeconds as number).toBeGreaterThan(contract.limits.serverMaxDurationSeconds as number);
  });

  // A route file may only export handlers and route config, so the bank list
  // is read from the route's own 400 message for an unsupported bank.
  it("receiptDownloadBanks matches the banks /api/receipt serves", async () => {
    const r = await receiptGET(
      new NextRequest("https://cheki.et/api/receipt?bank=telebirr&reference=CHQ0SAMPLE", { headers: freshIp() })
    );
    expect(r.status).toBe(400);
    const { error } = await r.json();
    const served = String(error).replace(/^.*supported for: /, "").replace(/\.$/, "").split(", ");
    expect(served.sort()).toEqual([...(contract.limits.receiptDownloadBanks as string[])].sort());
  });

  it("receiptUrlCases: /api/receipt answers every case the way the fixture says", async () => {
    type UrlCase = { name: string; bank: string; reference: string; account?: string; query?: Record<string, string>; error?: boolean; served?: "redirect" | "pdf" };
    const cases = (contract as unknown as { receiptUrlCases: UrlCase[] }).receiptUrlCases;
    vi.stubGlobal("fetch", vi.fn(async () => new Response("%PDF-1.4 fixture", { status: 200 })));
    for (const c of cases) {
      const q = new URLSearchParams(c.query ?? { bank: c.bank, reference: c.reference, ...(c.account ? { account: c.account } : {}) });
      const r = await receiptGET(new NextRequest(`https://cheki.et/api/receipt?${q}`, { headers: freshIp() }));
      if (c.error) {
        // SDK-side rejections the server must also refuse (no bank request).
        if (c.query === undefined && ["cbe", "zemen", "dashen", "zamzam"].includes(c.bank.toLowerCase()) && !/[/.]/.test(c.reference)) {
          expect(r.status, c.name).toBe(400);
        } else {
          expect(r.status, c.name).toBeGreaterThanOrEqual(400);
        }
        continue;
      }
      if (c.served === "redirect") {
        expect(r.status, c.name).toBe(302);
        expect(r.headers.get("location"), c.name).toMatch(/^https:\/\/(mbreciept\.cbe\.com\.et|receipts\.dashenbanksc\.com|receipt\.zamzambank\.com\.et)\//);
      } else {
        expect(r.status, c.name).toBe(200);
        expect(r.headers.get("content-type"), c.name).toBe("application/pdf");
      }
    }
  });

  it("verify_verified: envelope is success + receipt + cached", async () => {
    const f = fx("verify_verified");
    const ref = uniqueRef();
    vi.spyOn(Verifier.prototype, "verify").mockResolvedValue(ok(receiptOf(f.body, ref)));
    const r = await verifyPOST(jsonReq("/api/verify", { bank: "cbe", reference: ref, accountNumber: "1000000006171" }));
    expect(r.status).toBe(f.status);
    expect(r.headers.get("x-cheki-cache")).toBe("miss");
    const body = await r.json();
    expectShape(body, f.body, RECEIPT_OPTIONAL, "verify_verified");
    expect(body.success).toBe(true);
    expect(body.verified).toBe(true);
    expect(body.cached).toBe(false);
  });

  it("verify_cached: a repeat is served from cache without durationMs", async () => {
    const f = fx("verify_cached");
    const ref = uniqueRef();
    vi.spyOn(Verifier.prototype, "verify").mockResolvedValue(ok(receiptOf(fx("verify_verified").body, ref)));
    const input = { bank: "cbe", reference: ref, accountNumber: "1000000006171" };
    await verifyPOST(jsonReq("/api/verify", input));
    const r = await verifyPOST(jsonReq("/api/verify", input));
    expect(r.headers.get("x-cheki-cache")).toBe("hit");
    const body = await r.json();
    expectShape(body, f.body, RECEIPT_OPTIONAL, "verify_cached");
    expect(body.cached).toBe(true);
    expect("durationMs" in body).toBe(false);
  });

  it("verify_order_id: a CBE Birr receipt passes orderId through", async () => {
    const f = fx("verify_order_id");
    vi.spyOn(Verifier.prototype, "verify").mockResolvedValue(ok(receiptOf(f.body, uniqueRef())));
    const r = await verifyPOST(jsonReq("/api/verify", { bank: "cbebirr", reference: uniqueRef(), phoneNumber: "0911004321" }));
    expect(r.status).toBe(f.status);
    const body = await r.json();
    expectShape(body, f.body, RECEIPT_OPTIONAL, "verify_order_id");
    expect(body.orderId).toBe(f.body.orderId);
  });

  it("verify_decoded_only: success true, verified false, decodedOnly true", async () => {
    const f = fx("verify_decoded_only");
    vi.spyOn(Verifier.prototype, "verify").mockResolvedValue(ok(receiptOf(f.body, uniqueRef())));
    const r = await verifyPOST(jsonReq("/api/verify", { bank: "boa", qrData: "x".repeat(40) }));
    const body = await r.json();
    expect(r.status).toBe(200);
    expectShape(body, f.body, RECEIPT_OPTIONAL, "verify_decoded_only");
    expect(body).toMatchObject({ success: true, verified: false, decodedOnly: true });
  });

  it("parse_client_supplied: parsed true, never verified", async () => {
    const f = fx("parse_client_supplied");
    const content = [
      "Payer Name", "Abebe Kebede", "Credited Party name", "My Shop", "transaction status", "Completed",
      "Invoice No.", "DET1234567", "Settled Amount", "500.00 Birr",
    ].join("\n");
    const r = await parsePOST(jsonReq("/api/parse", { bank: "telebirr", content }));
    expect(r.status).toBe(f.status);
    const body = await r.json();
    expectShape(body, f.body, RECEIPT_OPTIONAL, "parse");
    expect(body).toMatchObject({ success: true, verified: false, parsed: true, source: "client-supplied" });
  });

  it("batch_mixed: results, cached, total, verified, failed; item errors carry status", async () => {
    const f = fx("batch_mixed");
    const [verifiedItem, decodedItem] = f.body.results as Record<string, Json>[];
    vi.spyOn(Verifier.prototype, "verifyBatch").mockResolvedValue([
      ok(receiptOf(verifiedItem, uniqueRef())),
      ok(receiptOf(decodedItem, uniqueRef())),
      err({ kind: "EXTRACTION_ERROR", bank: "Telebirr", message: "Receipt not found. Check the reference number." }),
    ]);
    const r = await batchPOST(
      jsonReq("/api/verify/batch", {
        receipts: [
          { bank: "cbe", reference: uniqueRef(), accountNumber: "1000000006171" },
          { bank: "boa", qrData: "y".repeat(40) },
          { bank: "telebirr", reference: uniqueRef() },
        ],
      })
    );
    expect(r.status).toBe(200);
    const body = await r.json();
    const { results: expectedResults, ...expectedTop } = f.body;
    const { results, ...top } = body;
    expectShape(top, expectedTop, new Set(), "batch");
    (expectedResults as Record<string, Json>[]).forEach((exp, i) => expectShape(results[i], exp, RECEIPT_OPTIONAL, `batch.results[${i}]`));
    expect(body).toMatchObject({ total: 3, verified: 1, failed: 2, cached: 0 });
    expect(results[2]).toEqual(expectedResults && (expectedResults as Json[])[2]);
  });

  it("error_400_batch_too_large: more than 20 receipts is a 400", async () => {
    const f = fx("error_400_batch_too_large");
    const receipts = Array.from({ length: 21 }, () => ({ bank: "telebirr", reference: uniqueRef() }));
    const r = await batchPOST(jsonReq("/api/verify/batch", { receipts }));
    expect(r.status).toBe(f.status);
    expect(await r.json()).toEqual(f.body);
  });

  it("banks: every fixture bank has the same keys and types as the live manifest", async () => {
    const f = fx("banks");
    const body = await (await banksGET()).json();
    expect(Object.keys(body)).toEqual(Object.keys(f.body));
    const allowed = { ...(f.body.banks as Record<string, Json>[])[0] } as Record<string, unknown>;
    for (const b of body.banks) expectShape(b, allowed, BANK_OPTIONAL, `bank ${b.id}`);
    for (const exp of f.body.banks as Record<string, Json>[]) {
      const actual = body.banks.find((b: { id: string }) => b.id === exp.id);
      expect(actual, `bank ${exp.id} exists`).toBeTruthy();
      expect(Object.keys(actual).sort(), `bank ${exp.id} keys`).toEqual(Object.keys(exp).sort());
    }
  });

  it("health: status, checkedAt, banks[{id,name,status,latencyMs}], cached", async () => {
    const f = fx("health");
    vi.stubGlobal("fetch", vi.fn(async () => new Response("ok", { status: 200 })));
    const r = await healthGET();
    expect(r.status).toBe(200);
    const body = await r.json();
    const { banks, ...top } = body;
    const { banks: expBanks, ...expTop } = f.body;
    expectShape(top, expTop, new Set(), "health");
    // checkedAt is an ISO 8601 timestamp, in the response and in the fixture.
    expect(new Date(top.checkedAt).toISOString()).toBe(top.checkedAt);
    expect(new Date(expTop.checkedAt as string).toISOString()).toBe(expTop.checkedAt);
    for (const b of banks) expectShape(b, (expBanks as Record<string, Json>[])[0], new Set(), `health ${b.id}`);
  });

  it("error_400_missing_input", async () => {
    const f = fx("error_400_missing_input");
    const r = await verifyPOST(jsonReq("/api/verify", { bank: "cbe" }));
    expect(r.status).toBe(f.status);
    expect(await r.json()).toEqual(f.body);
  });

  it("error_404_unsupported_bank", async () => {
    const f = fx("error_404_unsupported_bank");
    const r = await verifyPOST(jsonReq("/api/verify", { bank: "cbx", reference: uniqueRef() }));
    expect(r.status).toBe(f.status);
    expect(await r.json()).toEqual(f.body);
  });

  it("error_413_body_too_large", async () => {
    const f = fx("error_413_body_too_large");
    const r = await verifyPOST(jsonReq("/api/verify", { bank: "cbe", reference: "x".repeat(20 * 1024) }));
    expect(r.status).toBe(f.status);
    expect(await r.json()).toEqual(f.body);
  });

  it("error_422_not_found", async () => {
    const f = fx("error_422_not_found");
    vi.spyOn(Verifier.prototype, "verify").mockResolvedValue(
      err({ kind: "EXTRACTION_ERROR", bank: "Telebirr", message: "Receipt not found. Check the reference number." })
    );
    const r = await verifyPOST(jsonReq("/api/verify", { bank: "telebirr", reference: uniqueRef() }));
    expect(r.status).toBe(f.status);
    expect(await r.json()).toEqual(f.body);
  });

  it("error_429_rate_limited: Retry-After header in seconds", async () => {
    const f = fx("error_429_rate_limited");
    const headers = freshIp();
    let r: Response | undefined;
    for (let i = 0; i < 31; i++) r = await verifyPOST(jsonReq("/api/verify", { bank: "cbx", reference: uniqueRef() }, headers));
    expect(r!.status).toBe(f.status);
    expect(Number(r!.headers.get("retry-after"))).toBeGreaterThan(0);
    expect(await r!.json()).toEqual(f.body);
  });

  it("error_502_geo_blocked: fallbackUrl is passed through", async () => {
    const f = fx("error_502_geo_blocked");
    vi.spyOn(Verifier.prototype, "verify").mockResolvedValue(
      err({
        kind: "ENDPOINT_ERROR",
        bank: "Telebirr",
        message: "Our server can't reach this bank (it blocks cloud IPs). Open the receipt directly:",
        fallbackUrl: f.body.fallbackUrl as string,
      })
    );
    const r = await verifyPOST(jsonReq("/api/verify", { bank: "telebirr", reference: "CHQ0SAMPLE" }));
    expect(r.status).toBe(f.status);
    expect(await r.json()).toEqual(f.body);
  });

  it("error_500_internal", async () => {
    const f = fx("error_500_internal");
    vi.spyOn(Verifier.prototype, "verify").mockRejectedValue(new Error("boom"));
    const r = await verifyPOST(jsonReq("/api/verify", { bank: "telebirr", reference: uniqueRef() }));
    expect(r.status).toBe(f.status);
    expect(await r.json()).toEqual(f.body);
  });
});
