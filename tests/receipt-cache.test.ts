import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import {
  cacheKeyFor,
  verificationCacheKey,
  getCached,
  setCached,
  clearCache,
  cacheStats,
} from "@/lib/receipt-cache";

const payload = (ref: string) => ({ success: true, reference: ref, verified: true });

describe("receipt-cache", () => {
  beforeEach(() => {
    clearCache();
    vi.useRealTimers();
    delete process.env.CHEKI_CACHE;
    delete process.env.CHEKI_CACHE_TTL_MS;
    delete process.env.CHEKI_CACHE_MAX_ENTRIES;
  });

  afterEach(() => {
    clearCache();
    delete process.env.CHEKI_CACHE;
    delete process.env.CHEKI_CACHE_TTL_MS;
    delete process.env.CHEKI_CACHE_MAX_ENTRIES;
  });

  describe("cacheKeyFor", () => {
    it("is stable across whitespace and bank casing", () => {
      const a = cacheKeyFor({ bank: "CBE", reference: " FT26140P01YB " });
      const b = cacheKeyFor({ bank: "cbe", reference: "FT26140P01YB" });
      expect(a).toBe(b);
    });

    it("separates receipts that differ by account", () => {
      const a = cacheKeyFor({ bank: "cbe", reference: "FT1", accountNumber: "11111111" });
      const b = cacheKeyFor({ bank: "cbe", reference: "FT1", accountNumber: "22222222" });
      expect(a).not.toBe(b);
    });

    it("separates receipts that differ by reference", () => {
      expect(cacheKeyFor({ bank: "cbe", reference: "FT1" })).not.toBe(
        cacheKeyFor({ bank: "cbe", reference: "FT2" })
      );
    });

    it("treats missing optional fields as empty rather than undefined", () => {
      expect(cacheKeyFor({ bank: "cbe", reference: "FT1" })).toBe(
        cacheKeyFor({ bank: "cbe", reference: "FT1", accountNumber: undefined, phoneNumber: undefined })
      );
    });
  });

  describe("verificationCacheKey", () => {
    const telebirrUrl = "https://transactioninfo.ethiotelecom.et/receipt/DET8FJGUJ4";

    it("gives the same key for a receipt URL whatever bank was pre-selected", () => {
      // The verifier rewrites the URL into (bank, reference) before fetching,
      // so two clients sending the same URL must share one cache entry.
      expect(verificationCacheKey({ bank: "cbe", reference: telebirrUrl })).toBe(
        verificationCacheKey({ bank: "telebirr", reference: telebirrUrl })
      );
    });

    it("pulls the reference out of the URL", () => {
      const key = verificationCacheKey({ bank: "telebirr", reference: telebirrUrl });
      expect(key).toContain("telebirr");
      expect(key).toContain("DET8FJGUJ4");
      expect(key).not.toContain("ethiotelecom.et");
    });

    it("harvests the account suffix from a CBE receipt URL", () => {
      const url = "https://apps.cbe.com.et:100/?id=FT26140P01YB60536171";
      const fromUrl = verificationCacheKey({ bank: "cbe", reference: url });
      const fromParts = verificationCacheKey({
        bank: "cbe",
        reference: "FT26140P01YB",
        accountNumber: "60536171",
      });
      expect(fromUrl).toBe(fromParts);
    });

    it("leaves a plain reference untouched", () => {
      expect(verificationCacheKey({ bank: "cbe", reference: "FT26140P01YB" })).toBe(
        cacheKeyFor({ bank: "cbe", reference: "FT26140P01YB" })
      );
    });

    it("does not throw on a URL it cannot recognise", () => {
      const key = verificationCacheKey({ bank: "cbe", reference: "https://example.com/nope" });
      expect(typeof key).toBe("string");
      expect(key.length).toBeGreaterThan(0);
    });
  });

  describe("get/set", () => {
    it("returns undefined on a cold cache", () => {
      expect(getCached("nope")).toBeUndefined();
    });

    it("round-trips a stored receipt", () => {
      setCached("k", payload("FT1"));
      expect(getCached("k")).toEqual(payload("FT1"));
    });

    it("returns a copy so callers cannot mutate the cache", () => {
      setCached("k", payload("FT1"));
      const first = getCached("k")!;
      first.reference = "hacked";
      expect(getCached("k")!.reference).toBe("FT1");
    });

    it("overwrites on a second set", () => {
      setCached("k", payload("old"));
      setCached("k", payload("new"));
      expect(getCached("k")!.reference).toBe("new");
    });
  });

  describe("TTL", () => {
    it("expires after the configured TTL", () => {
      vi.useFakeTimers();
      vi.setSystemTime(new Date("2026-01-01T00:00:00Z"));
      process.env.CHEKI_CACHE_TTL_MS = "1000";

      setCached("k", payload("FT1"));
      expect(getCached("k")).toBeDefined();

      vi.setSystemTime(new Date("2026-01-01T00:00:02Z"));
      expect(getCached("k")).toBeUndefined();
      vi.useRealTimers();
    });

    it("keeps serving within the TTL window", () => {
      vi.useFakeTimers();
      vi.setSystemTime(new Date("2026-01-01T00:00:00Z"));
      process.env.CHEKI_CACHE_TTL_MS = "60000";

      setCached("k", payload("FT1"));
      vi.setSystemTime(new Date("2026-01-01T00:00:59Z"));
      expect(getCached("k")).toBeDefined();
      vi.useRealTimers();
    });

    it("does not store when TTL is zero", () => {
      process.env.CHEKI_CACHE_TTL_MS = "0";
      setCached("k", payload("FT1"));
      expect(getCached("k")).toBeUndefined();
    });

    it("does not store when CHEKI_CACHE=off", () => {
      process.env.CHEKI_CACHE = "off";
      setCached("k", payload("FT1"));
      expect(getCached("k")).toBeUndefined();
    });
  });

  describe("eviction", () => {
    it("evicts the oldest entry once the cap is exceeded", () => {
      process.env.CHEKI_CACHE_MAX_ENTRIES = "2";
      setCached("a", payload("A"));
      setCached("b", payload("B"));
      setCached("c", payload("C"));

      expect(getCached("a")).toBeUndefined();
      expect(getCached("b")).toBeDefined();
      expect(getCached("c")).toBeDefined();
      expect(cacheStats().evictions).toBe(1);
    });

    it("treats a read as a use, so the oldest unused entry goes first", () => {
      process.env.CHEKI_CACHE_MAX_ENTRIES = "2";
      setCached("a", payload("A"));
      setCached("b", payload("B"));
      getCached("a"); // promote a
      setCached("c", payload("C"));

      expect(getCached("a")).toBeDefined();
      expect(getCached("b")).toBeUndefined();
      expect(getCached("c")).toBeDefined();
    });
  });

  describe("stats", () => {
    it("counts hits and misses", () => {
      setCached("k", payload("FT1"));
      getCached("k");
      getCached("never-written");
      expect(cacheStats().hits).toBe(1);
      expect(cacheStats().misses).toBe(1);
      expect(cacheStats().hitRate).toBeCloseTo(0.5);
    });

    it("reports an empty hit rate with no traffic", () => {
      expect(cacheStats().hitRate).toBe(0);
      expect(cacheStats().size).toBe(0);
    });
  });
});
