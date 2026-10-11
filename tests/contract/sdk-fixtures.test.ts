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
  "amountInWords", "paymentMode", "paymentChannel", "bankAccountNumber", "bankAccountName", "decodedOnly",
]);
const BANK_OPTIONAL = new Set(["swift", "accountDigits", "requiresPhone"]);

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
    for (const [name, limiter] of Object.entries(limiters)) {
      expect((limiter as unknown as { limit: number }).limit, `${name} limit`).toBe(perMinute[name]);
    }
    expect(contract.limits.sdkTimeoutSeconds as number).toBeGreaterThan(contract.limits.serverMaxDurationSeconds as number);
  });

  it("verify_verified: envelope is success + receipt + cached", async () => {
    const f = fx("verify_verified");
    const ref = uniqueRef();
    vi.spyOn(Verifier.prototype, "verify").mockResolvedValue(ok(receiptOf(f.body, ref)));
    const r = await verifyPOST(jsonReq("/api/verify", { bank: "cbe", reference: ref, accountNumber: "1000560536171" }));
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
    const input = { bank: "cbe", reference: ref, accountNumber: "1000560536171" };
    await verifyPOST(jsonReq("/api/verify", input));
    const r = await verifyPOST(jsonReq("/api/verify", input));
    expect(r.headers.get("x-cheki-cache")).toBe("hit");
    const body = await r.json();
    expectShape(body, f.body, RECEIPT_OPTIONAL, "verify_cached");
    expect(body.cached).toBe(true);
    expect("durationMs" in body).toBe(false);
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
          { bank: "cbe", reference: uniqueRef(), accountNumber: "1000560536171" },
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
    const r = await verifyPOST(jsonReq("/api/verify", { bank: "telebirr", reference: "CHQ0FJ403O" }));
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
