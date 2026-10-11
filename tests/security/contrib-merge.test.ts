/**
 * #27 (community/contrib-endpoints) brought in line with #28:
 *   - /api/contribute uses the shared limiter and key logic, caps the body
 *     while reading it, and refuses browser cross-site posts
 *   - the ContributeBox never claims a receipt is verified and handles 429/413
 *   - status.json can't make an in-development bank look live; probe output is
 *     linear and has no control characters
 *   - the health check verifies TLS and stays on the allowlist; the workflow
 *     runs repo code read-only and only commits real changes (so it doesn't
 *     redeploy and reset the /api/health cache every day)
 *   - /status and /endpoints describe the limits, the cache and the states
 */
import { afterEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describeResponse } from "@/lib/health";
import { healthStatusFor } from "@/lib/status-data";
import { getBank } from "@/lib/manifest/loader";
import type { BankManifestEntry } from "@/lib/core/types";

const read = (p: string) => readFileSync(join(__dirname, "..", "..", p), "utf8");

afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
  vi.resetModules();
});

async function route() {
  vi.stubEnv("TELEGRAM_BOT_TOKEN", "test-token");
  vi.stubEnv("TELEGRAM_CONTRIB_CHAT_ID", "123");
  vi.stubGlobal("fetch", vi.fn(async () => new Response(JSON.stringify({ ok: true }), { status: 200 })));
  return (await import("@/app/api/contribute/route")).POST;
}

const body = { bank: "zemen", consent: true, link: "https://share.zemenbank.com/rt/ABCDEFGH1234567890123456/pdf" };
const jsonReq = (headers: Record<string, string>) =>
  new NextRequest("https://cheki.et/api/contribute", {
    method: "POST",
    headers: { "content-type": "application/json", ...headers },
    body: JSON.stringify(body),
  });

describe("/api/contribute", () => {
  it("rotating the leftmost X-Forwarded-For entry does not reset the budget", async () => {
    const POST = await route();
    const codes: number[] = [];
    for (let i = 0; i < 7; i++) {
      const r = await POST(jsonReq({ "x-forwarded-for": `10.0.0.${i}, 203.0.113.77` }));
      codes.push(r.status);
    }
    expect(codes.slice(0, 5)).toEqual([200, 200, 200, 200, 200]);
    expect(codes[5]).toBe(429);
  });

  it("keys on x-real-ip and sends Retry-After on 429", async () => {
    const POST = await route();
    let last: Response | undefined;
    for (let i = 0; i < 6; i++) last = await POST(jsonReq({ "x-real-ip": "198.51.100.9", "x-forwarded-for": `1.1.1.${i}` }));
    expect(last!.status).toBe(429);
    expect(Number(last!.headers.get("retry-after"))).toBeGreaterThan(0);
  });

  it("refuses browser cross-site posts before forwarding anything", async () => {
    const POST = await route();
    const r = await POST(jsonReq({ "x-real-ip": "198.51.100.10", "sec-fetch-site": "cross-site" }));
    expect(r.status).toBe(403);
    expect(fetch).not.toHaveBeenCalled();
    const same = await POST(jsonReq({ "x-real-ip": "198.51.100.11", "sec-fetch-site": "same-origin" }));
    expect(same.status).toBe(200);
  });

  it("caps a chunked multipart upload while reading it (no Content-Length)", async () => {
    const POST = await route();
    let pulled = 0;
    const chunk = new Uint8Array(1024 * 1024);
    const stream = new ReadableStream<Uint8Array>({
      pull(controller) {
        pulled++;
        if (pulled > 64) controller.close();
        else controller.enqueue(chunk);
      },
    });
    const req = new NextRequest("https://cheki.et/api/contribute", {
      method: "POST",
      headers: { "content-type": "multipart/form-data; boundary=x", "x-real-ip": "198.51.100.12" },
      body: stream,
      duplex: "half",
    });
    const r = await POST(req);
    expect(r.status).toBe(413);
    expect(pulled).toBeLessThan(10);
    expect(fetch).not.toHaveBeenCalled();
  });

  it("caps a chunked JSON body too", async () => {
    const POST = await route();
    const big = new TextEncoder().encode(JSON.stringify({ ...body, credit: "x".repeat(20_000) }));
    const stream = new ReadableStream<Uint8Array>({
      start(c) {
        c.enqueue(big);
        c.close();
      },
    });
    const req = new NextRequest("https://cheki.et/api/contribute", {
      method: "POST",
      headers: { "content-type": "application/json", "x-real-ip": "198.51.100.13" },
      body: stream,
      duplex: "half",
    });
    expect((await POST(req)).status).toBe(413);
  });

  it("uses the shared rate-limit module, not its own copy", () => {
    const routeSrc = read("src/app/api/contribute/route.ts");
    expect(routeSrc).toMatch(/limiters\.contribute/);
    expect(routeSrc).not.toMatch(/new RateLimiter\(/);
    expect(read("src/lib/contribute.ts")).not.toMatch(/class RateLimiter/);
    expect(routeSrc).not.toMatch(/request\.formData\(\)|request\.text\(\)/);
  });
});

describe("ContributeBox", () => {
  const src = read("src/components/ContributeBox.tsx");

  it("never tells the user a receipt is verified", () => {
    // Visible strings only: JSX text and string literals.
    const strings = [...src.matchAll(/"([^"\n]*)"|`([^`]*)`|>([^<>{}\n]+)</g)].map((m) => m[1] ?? m[2] ?? m[3]).join("\n");
    expect(strings).not.toMatch(/\bverified\b/i);
    expect(src).toMatch(/does not check it/);
  });

  it("handles 429 and 413 instead of reporting a network error", () => {
    expect(src).toMatch(/resp\.status === 429/);
    expect(src).toMatch(/resp\.status === 413/);
    expect(src).toMatch(/retryAfterSeconds\(resp\)/);
    expect(src).not.toMatch(/=\s*await resp\.json\(\);\s*\n\s*if \(!data\.success\)/);
  });
});

describe("status data and probe output", () => {
  const zemen = getBank("zemen")!;
  const dashen = getBank("dashen")!;

  it("an in-development bank is never shown live, a live bank never in development", () => {
    expect(zemen.status).toBe("in-development");
    expect(healthStatusFor(zemen)).not.toBe("live");
    const fakeLive = { ...zemen, id: "no-such-bank", status: "live" } as BankManifestEntry;
    expect(healthStatusFor(fakeLive)).toBe("live");
    expect(["live", "degraded", "not-checked"]).toContain(healthStatusFor(dashen));
  });

  it("describeResponse is linear and strips control and bidi characters", () => {
    const t0 = performance.now();
    describeResponse({ status: 200, contentType: "text/html", body: "<title".repeat(20_000) + "<".repeat(100_000) });
    describeResponse({ status: 200, contentType: "text/html", body: "<script".repeat(20_000) });
    expect(performance.now() - t0).toBeLessThan(300);
    const d = describeResponse({ status: 404, contentType: "text/plain", body: "Not\u0007 found\u202e\u001b[31m" });
    expect(d).not.toMatch(/[\u0000-\u001f\u202e]/);
    expect(d).toContain("Not");
    expect(describeResponse({ status: 200, contentType: "text/html", body: "<html><title>Receipt not found</title></html>" })).toContain(
      '"Receipt not found"'
    );
  });
});

describe("health check and workflow", () => {
  const script = read("scripts/health-check.ts");
  const wf = read(".github/workflows/endpoint-health.yml");

  it("the probe verifies TLS and stays on the receipt-host allowlist", () => {
    expect(script).not.toMatch(/rejectUnauthorized:\s*false/);
    expect(script).toMatch(/assertAllowedUrl\(url\)/);
  });

  it("repo code runs with a read-only token; only real changes are committed", () => {
    expect(wf).toMatch(/^permissions:\n\s+contents: read/m);
    expect(wf).toMatch(/persist-credentials: false/);
    expect(wf).toMatch(/needs\.probe\.outputs\.changed == 'true'/);
    expect(wf).toMatch(/delete j\.generatedAt/);
    // The commit job runs no repo code.
    const commitJob = wf.slice(wf.indexOf("  commit:"));
    expect(commitJob).not.toMatch(/npm ci|npx tsx/);
  });
});

describe("/status and /endpoints copy", () => {
  const status = read("src/app/status/page.tsx");
  const endpoints = read("src/app/endpoints/page.tsx");

  it("explains the states and that health is not verification", () => {
    expect(status).toMatch(/not about any receipt/);
    expect(status).toMatch(/In development<\/strong> banks are not checked/);
    expect(endpoints).toMatch(/Only live banks are verified/);
  });

  it("states the /api/health cache and the per-IP limits", () => {
    for (const src of [status, endpoints]) expect(src).toMatch(/cached for 5 minutes/);
    expect(endpoints).toMatch(/verify 30 per minute/);
    expect(endpoints).toMatch(/up to 20 receipts/);
    expect(endpoints).toMatch(/429/);
    for (const src of [status, endpoints]) {
      expect(src).not.toMatch(/no rate limit/i);
      expect(src).not.toMatch(/Live health/);
    }
  });
});
