/**
 * Per-IP rate limiting for the public API routes.
 *
 * Same fixed-window, in-memory pattern as the /api/contribute limiter. It is
 * PER INSTANCE: on Vercel every warm function instance keeps its own counters
 * and a cold start resets them, so this caps bursts from one client rather
 * than guaranteeing a global quota. A durable limit needs a shared store
 * (Upstash/Redis) or a Vercel WAF rate-limit rule in front of /api/*.
 */
import { NextResponse } from "next/server";

export class RateLimiter {
  private hits = new Map<string, number[]>();

  constructor(
    private readonly limit: number,
    private readonly windowMs: number,
    private readonly maxKeys = 5000,
  ) {}

  /**
   * Record `cost` hits for `key`. Returns 0 when allowed, otherwise the
   * seconds until enough of the window frees up. A refused request records
   * nothing.
   */
  check(key: string, cost = 1, now: number = Date.now()): number {
    const recent = (this.hits.get(key) ?? []).filter((t) => now - t < this.windowMs);
    if (cost > this.limit || recent.length + cost > this.limit) {
      this.hits.set(key, recent);
      const oldest = recent.length > 0 ? recent[0] : now;
      return Math.max(1, Math.ceil((oldest + this.windowMs - now) / 1000));
    }
    for (let i = 0; i < cost; i++) recent.push(now);
    this.hits.set(key, recent);
    if (this.hits.size > this.maxKeys) {
      for (const [k, times] of this.hits) {
        if (times.every((t) => now - t >= this.windowMs)) this.hits.delete(k);
      }
      if (this.hits.size > this.maxKeys) {
        const oldest = this.hits.keys().next().value;
        if (oldest !== undefined) this.hits.delete(oldest);
      }
    }
    return 0;
  }
}

/**
 * Client IP. Vercel sets x-vercel-forwarded-for and overwrites
 * x-forwarded-for, so both are trustworthy there. When self-hosted without a
 * proxy that rewrites them, they can be spoofed.
 */
export function clientIp(headers: Headers): string {
  const vercel = headers.get("x-vercel-forwarded-for");
  if (vercel) return vercel.split(",")[0].trim();
  const fwd = headers.get("x-forwarded-for");
  if (fwd) return fwd.split(",")[0].trim();
  return headers.get("x-real-ip")?.trim() || "unknown";
}

const MINUTE = 60 * 1000;

/** Shared limiters, one per route family (per instance, see above). */
export const limiters = {
  /** Single verifications; batch items also count against this bucket. */
  verify: new RateLimiter(30, MINUTE),
  /** Batch requests themselves. */
  batch: new RateLimiter(5, MINUTE),
  parse: new RateLimiter(20, MINUTE),
  ocr: new RateLimiter(20, MINUTE),
};

/** A 429 response, or null when the request may go ahead. */
export function rateLimited(
  limiter: RateLimiter,
  headers: Headers,
  cost = 1,
  extraHeaders: Record<string, string> = {}
): NextResponse | null {
  const retryAfter = limiter.check(clientIp(headers), cost);
  if (retryAfter === 0) return null;
  return NextResponse.json(
    { success: false, error: "Too many requests from your network. Wait a minute and try again." },
    { status: 429, headers: { ...extraHeaders, "Retry-After": String(retryAfter) } }
  );
}
