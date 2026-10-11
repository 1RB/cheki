/**
 * The /banks/[code] BankChecker (added by #3) follows the same rule as the
 * homepage after #28: only verificationState() === "verified" is green, and
 * decodedOnly / parsed / 429 / 413 / non-JSON answers are handled.
 */
import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { readVerifyResponse, retryAfterSeconds, rateLimitMessage } from "@/lib/verify-response";
import { verificationState } from "@/lib/banks";

const read = (p: string) => readFileSync(join(__dirname, "..", "..", p), "utf8");

describe("BankChecker labelling", () => {
  const src = read("src/components/BankChecker.tsx");

  it("decides green with verificationState(), not success or verified !== false", () => {
    expect(src).toMatch(/verificationState\(result\)/);
    expect(src).not.toMatch(/verified\s*!==\s*false/);
    expect(src).not.toMatch(/result\?\.success\s*&&\s*result\.verified/);
    // The green background is only reachable from the verified state.
    for (const m of src.matchAll(/var\(--green-light\)/g)) {
      const before = src.slice(Math.max(0, (m.index ?? 0) - 80), m.index);
      expect(before).toMatch(/state === "verified"/);
    }
  });

  it("has amber copy for decodedOnly and parsed", () => {
    expect(src).toMatch(/state === "decodedOnly"/);
    expect(src).toMatch(/state === "parsed"/);
    expect(src).toMatch(/not confirmed with the bank/i);
  });

  it("reads responses through readVerifyResponse (429/413/non-JSON)", () => {
    expect(src).toMatch(/readVerifyResponse\(resp\)/);
    expect(src).not.toMatch(/await resp\.json\(\)/);
  });

  it("the homepage reads every verify/parse response the same way", () => {
    const home = read("src/components/HomePage.tsx");
    expect(home).not.toMatch(/=\s*await resp\.json\(\)/);
    expect(home.match(/readVerifyResponse\(resp\)/g)?.length).toBeGreaterThanOrEqual(5);
  });
});

describe("readVerifyResponse", () => {
  const json = (body: unknown, status = 200, headers: Record<string, string> = {}) =>
    new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json", ...headers } });

  it("passes a normal result through untouched", async () => {
    const r = await readVerifyResponse(json({ success: true, verified: true, amount: 5 }));
    expect(verificationState(r)).toBe("verified");
    expect(r.amount).toBe(5);
  });

  it("429 is a failure with the Retry-After wait, even if the body claims success", async () => {
    const r = await readVerifyResponse(json({ success: true, verified: true }, 429, { "retry-after": "17" }));
    expect(r.success).toBe(false);
    expect(verificationState(r)).toBe("none");
    expect(r.error).toBe(rateLimitMessage(17));
    expect(r.error).toMatch(/17 seconds/);
  });

  it("429 with an HTML body (proxy) still gives a readable message", async () => {
    const r = await readVerifyResponse(new Response("<html>Too Many</html>", { status: 429 }));
    expect(r.success).toBe(false);
    expect(r.error).toMatch(/Too many checks/);
  });

  it("413 is a failure with a size message", async () => {
    const r = await readVerifyResponse(new Response("Request Entity Too Large", { status: 413 }));
    expect(r.success).toBe(false);
    expect(r.error).toMatch(/too large/i);
  });

  it("a 5xx HTML page or a 200 non-JSON body is not success", async () => {
    expect((await readVerifyResponse(new Response("<html>502</html>", { status: 502 }))).success).toBe(false);
    expect((await readVerifyResponse(new Response("not json", { status: 200 }))).success).toBe(false);
    expect((await readVerifyResponse(new Response("[1,2]", { status: 200 }))).success).toBe(false);
  });

  it("keeps the API's own error message on a 4xx", async () => {
    const r = await readVerifyResponse(json({ success: false, error: "Bad reference." }, 400));
    expect(r.error).toBe("Bad reference.");
  });

  it("parses Retry-After seconds and dates, and bounds them", () => {
    const h = (v: string) => ({ headers: new Headers({ "retry-after": v }) });
    expect(retryAfterSeconds(h("30"))).toBe(30);
    expect(retryAfterSeconds(h("999999"))).toBe(3600);
    expect(retryAfterSeconds(h("garbage"))).toBeUndefined();
    const inTen = new Date(Date.now() + 10_000).toUTCString();
    expect(retryAfterSeconds(h(inTen))).toBeGreaterThan(0);
    expect(retryAfterSeconds({ headers: new Headers() })).toBeUndefined();
  });
});
