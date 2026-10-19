/**
 * Geo-blocked banks (Telebirr, M-Pesa) get one plain request: no spoofed
 * X-Forwarded-For / X-Real-IP, no pinned bank IPs, no retry. The block is on
 * the real source address, so those tricks never helped and made Telebirr
 * take about 33 seconds to fail.
 */
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, it, expect, vi, beforeEach } from "vitest";

const safeFetchMock = vi.hoisted(() => vi.fn());
vi.mock("@/lib/http/safe-fetch", async (orig) => {
  const actual = await orig<typeof import("@/lib/http/safe-fetch")>();
  return { ...actual, safeFetch: safeFetchMock };
});

import { TelebirrParser } from "@/lib/parsers/telebirr";
import { GEO_TIMEOUT_MS } from "@/lib/parsers/base";

describe("geo-blocked fetch", () => {
  beforeEach(() => {
    safeFetchMock.mockReset();
  });

  it("makes exactly one request, with no forwarding headers, and returns the fallback link", async () => {
    safeFetchMock.mockImplementation(async () => {
      throw new Error("connect ETIMEDOUT");
    });
    const parser = new TelebirrParser();
    const fallbackUrl = "https://transactioninfo.ethiotelecom.et/receipt/CHQ0SAMPLE";
    const result = await parser.fetchReceipt("CHQ0SAMPLE", undefined, undefined, { fallbackUrl });

    expect(safeFetchMock).toHaveBeenCalledTimes(1);
    const [url, opts] = safeFetchMock.mock.calls[0];
    expect(url).toBe(fallbackUrl);
    expect(opts.timeoutMs).toBe(GEO_TIMEOUT_MS);
    const headerNames = Object.keys(opts.headers).map((h) => h.toLowerCase());
    expect(headerNames).not.toContain("x-forwarded-for");
    expect(headerNames).not.toContain("x-real-ip");

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.kind).toBe("ENDPOINT_ERROR");
      expect((result.error as { fallbackUrl?: string }).fallbackUrl).toBe(fallbackUrl);
    }
  });

  it("the base parser carries no spoofed IP or pinned bank addresses", () => {
    const src = readFileSync(resolve(__dirname, "../../src/lib/parsers/base.ts"), "utf8");
    expect(src).not.toMatch(/X-Forwarded-For"\s*:/i);
    expect(src).not.toMatch(/X-Real-IP/i);
    expect(src).not.toMatch(/\b\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}\b/);
  });
});
