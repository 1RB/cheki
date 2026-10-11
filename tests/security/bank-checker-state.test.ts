/**
 * The /banks/[code] checker (added by #3 as BankChecker, now the shared
 * VerifyPanel locked to its bank) follows the same rule as the homepage after
 * #28: only verificationState() === "verified" is green, and decodedOnly /
 * parsed / 429 / 413 / non-JSON answers are handled.
 */
import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { readVerifyResponse, retryAfterSeconds, rateLimitMessage } from "@/lib/verify-response";
import { verificationState } from "@/lib/banks";

const read = (p: string) => readFileSync(join(__dirname, "..", "..", p), "utf8");

describe("bank page checker labelling", () => {
  const verdict = read("src/lib/verify/verdict.ts");
  const css = read("src/components/verify/verify.css");
  const page = read("src/app/banks/[code]/page.tsx");

  it("the bank page uses the shared VerifyPanel locked to its bank", () => {
    expect(page).toMatch(/<VerifyPanel lockedBank=\{bank\.code\} \/>/);
    expect(page).not.toMatch(/BankChecker/);
  });

  it("decides green with verificationState(), not success or verified !== false", () => {
    expect(verdict).toMatch(/verificationState\(result\)/);
    expect(verdict).not.toMatch(/verified\s*!==\s*false/);
    expect(verdict).not.toMatch(/result\?\.success\s*&&\s*result\.verified/);
    // The card's only colour is its status dot; the green dot is only
    // reachable from the green (verified) tone, and nothing else in the card
    // CSS reads --green.
    const greens = [...css.matchAll(/--vc-dot: var\(--green\)/g)];
    expect(greens).toHaveLength(1);
    const before = css.slice(Math.max(0, (greens[0].index ?? 0) - 80), greens[0].index);
    expect(before).toMatch(/\.vc\[data-tone="green"\]/);
    const card = css.slice(css.indexOf("── Verdict"), css.indexOf("Skeleton:"));
    expect(card.replace(/--vc-dot: var\(--green\)/, "")).not.toMatch(/var\(--green/);
  });

  it("has amber copy for decodedOnly and parsed", () => {
    expect(verdict).toMatch(/state === "decodedOnly"/);
    expect(verdict).toMatch(/state === "parsed"/);
    expect(read("src/lib/i18n/translations.ts")).toMatch(/not confirmed with the bank/i);
  });

  it("reads responses through readVerifyResponse (429/413/non-JSON)", () => {
    const client = read("src/lib/verify/client.ts");
    expect(client).toMatch(/readVerifyResponse\(resp\)/);
    expect(client).not.toMatch(/await resp\.json\(\)/);
  });

  it("every verify/parse request in the UI goes through the client", () => {
    const files = ["VerifyPanel.tsx", "BatchPanel.tsx", "GeoFallback.tsx", "VerdictCard.tsx", "VerifyInput.tsx"].map((f) => read(`src/components/verify/${f}`));
    for (const src of files) {
      expect(src).not.toMatch(/fetch\(\s*["'`]\/api\/(verify|parse)/);
      expect(src).not.toMatch(/=\s*await resp\.json\(\)/);
    }
    expect(files.join("\n").match(/postJson\(/g)?.length).toBeGreaterThanOrEqual(3);
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
