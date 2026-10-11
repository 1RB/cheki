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
 * Client IP used as the rate-limit key.
 *
 * Order of trust:
 *   1. x-real-ip: set by Vercel's edge (and by nginx's usual config) to the
 *      address that connected to it. A client-sent value is overwritten.
 *   2. x-vercel-forwarded-for: also set by Vercel, never taken from the client.
 *   3. x-forwarded-for, RIGHTMOST entry: the hop the nearest proxy appended.
 *      The leftmost entry is whatever the client typed, so keying on it let a
 *      client rotate "X-Forwarded-For: <random>" and never hit the limit when
 *      self-hosted behind a proxy that appends. On Vercel the header is
 *      rewritten to a single address, so first and last are the same.
 *
 * IPv6 clients usually control a whole /64, so IPv6 addresses are keyed by
 * their /64 prefix; otherwise one client could rotate addresses to reset its
 * budget. IPv4-mapped IPv6 (::ffff:1.2.3.4) is keyed as the IPv4 address.
 *
 * Self-hosted with no proxy in front, all of these headers come from the
 * client and can be spoofed; put a proxy that sets x-real-ip in front.
 */
export function clientIp(headers: Headers): string {
  const realIp = headers.get("x-real-ip")?.trim();
  if (realIp) return normalizeIpKey(realIp);
  const vercel = headers.get("x-vercel-forwarded-for");
  if (vercel) {
    const first = vercel.split(",")[0].trim();
    if (first) return normalizeIpKey(first);
  }
  const fwd = headers.get("x-forwarded-for");
  if (fwd) {
    const parts = fwd.split(",").map((p) => p.trim()).filter(Boolean);
    if (parts.length > 0) return normalizeIpKey(parts[parts.length - 1]);
  }
  return "unknown";
}

/** Expand an IPv6 address to 8 hextets, or null when it is not one. */
function expandIpv6(addr: string): string[] | null {
  if (!/^[0-9a-f:.]+$/i.test(addr) || addr.length > 45) return null;
  let tail: string[] = [];
  let a = addr;
  // Embedded IPv4 in the last 32 bits (::ffff:1.2.3.4, 64:ff9b::1.2.3.4).
  const v4 = a.match(/(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/);
  if (v4) {
    const n = v4.slice(1).map(Number);
    if (n.some((x) => x > 255)) return null;
    tail = [((n[0] << 8) | n[1]).toString(16), ((n[2] << 8) | n[3]).toString(16)];
    a = a.slice(0, a.length - v4[0].length) + "0:0";
  }
  const halves = a.split("::");
  if (halves.length > 2) return null;
  const head = halves[0] ? halves[0].split(":") : [];
  const rest = halves.length === 2 && halves[1] ? halves[1].split(":") : [];
  const missing = 8 - head.length - rest.length;
  if (halves.length === 1 ? missing !== 0 : missing < 1) return null;
  const groups = [...head, ...Array(halves.length === 2 ? missing : 0).fill("0"), ...rest];
  if (groups.length !== 8 || groups.some((g) => !/^[0-9a-f]{1,4}$/i.test(g))) return null;
  if (tail.length) groups.splice(6, 2, ...tail);
  return groups.map((g) => g.toLowerCase().replace(/^0+(?=.)/, ""));
}

/** Rate-limit key for an address: IPv4 as is, IPv6 by /64. Bounded length. */
export function normalizeIpKey(raw: string): string {
  let ip = raw.trim().slice(0, 64);
  // "[2001:db8::1]:443" or "1.2.3.4:5678" from some proxies.
  const bracket = ip.match(/^\[([^\]]+)\](?::\d+)?$/);
  if (bracket) ip = bracket[1];
  else if (/^\d{1,3}(?:\.\d{1,3}){3}:\d+$/.test(ip)) ip = ip.slice(0, ip.lastIndexOf(":"));
  ip = ip.replace(/%.*$/, ""); // zone id
  if (/^\d{1,3}(?:\.\d{1,3}){3}$/.test(ip)) return ip;
  if (ip.includes(":")) {
    const groups = expandIpv6(ip);
    if (!groups) return ip.toLowerCase();
    // IPv4-mapped: ::ffff:a.b.c.d
    if (groups.slice(0, 5).every((g) => g === "0") && groups[5] === "ffff") {
      const hi = parseInt(groups[6], 16);
      const lo = parseInt(groups[7], 16);
      return `${hi >> 8}.${hi & 255}.${lo >> 8}.${lo & 255}`;
    }
    return `${groups.slice(0, 4).join(":")}::/64`;
  }
  return ip.toLowerCase();
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
  /** /api/contribute: a low-volume form that forwards to Telegram. */
  contribute: new RateLimiter(5, 10 * MINUTE),
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
