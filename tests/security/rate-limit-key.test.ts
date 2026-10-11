/**
 * Rate-limit key spoofing (self-review on PR #28). The key must come from a
 * header the platform sets, not from the client-controlled leftmost
 * X-Forwarded-For entry, and IPv6 clients are keyed by /64.
 */
import { describe, it, expect } from "vitest";
import { clientIp, normalizeIpKey, RateLimiter } from "@/lib/rate-limit";

describe("clientIp", () => {
  it("prefers x-real-ip over everything else", () => {
    const h = new Headers({
      "x-real-ip": "203.0.113.7",
      "x-vercel-forwarded-for": "198.51.100.1",
      "x-forwarded-for": "1.1.1.1, 2.2.2.2",
    });
    expect(clientIp(h)).toBe("203.0.113.7");
  });

  it("uses x-vercel-forwarded-for before x-forwarded-for", () => {
    expect(clientIp(new Headers({ "x-vercel-forwarded-for": "198.51.100.1", "x-forwarded-for": "1.1.1.1" }))).toBe(
      "198.51.100.1"
    );
  });

  it("a client rotating the leftmost X-Forwarded-For entry keeps the same key", () => {
    const keys = new Set<string>();
    for (let i = 0; i < 50; i++) {
      keys.add(clientIp(new Headers({ "x-forwarded-for": `10.0.0.${i}, 203.0.113.9` })));
    }
    expect([...keys]).toEqual(["203.0.113.9"]);
  });

  it("spoofed leftmost entries can't dodge the limiter", () => {
    const limiter = new RateLimiter(3, 60_000);
    let refused = 0;
    for (let i = 0; i < 10; i++) {
      const key = clientIp(new Headers({ "x-forwarded-for": `9.9.9.${i}, 203.0.113.50` }));
      if (limiter.check(key) > 0) refused++;
    }
    expect(refused).toBe(7);
  });

  it("falls back to 'unknown' with no headers", () => {
    expect(clientIp(new Headers())).toBe("unknown");
  });
});

describe("normalizeIpKey", () => {
  it("keeps IPv4 and strips a port", () => {
    expect(normalizeIpKey("203.0.113.7")).toBe("203.0.113.7");
    expect(normalizeIpKey("203.0.113.7:51234")).toBe("203.0.113.7");
  });

  it("keys IPv6 by /64 so rotating the interface id does not reset the budget", () => {
    const a = normalizeIpKey("2001:db8:1:2:aaaa:bbbb:cccc:dddd");
    const b = normalizeIpKey("2001:0db8:0001:0002::1");
    const c = normalizeIpKey("[2001:db8:1:2::ffff]:443");
    expect(a).toBe("2001:db8:1:2::/64");
    expect(b).toBe(a);
    expect(c).toBe(a);
    expect(normalizeIpKey("2001:db8:1:3::1")).not.toBe(a);
  });

  it("maps IPv4-mapped IPv6 to the IPv4 address", () => {
    expect(normalizeIpKey("::ffff:203.0.113.7")).toBe("203.0.113.7");
    expect(normalizeIpKey("::ffff:cb00:7107")).toBe("203.0.113.7");
  });

  it("bounds the key length for garbage input", () => {
    expect(normalizeIpKey("x".repeat(10_000)).length).toBeLessThanOrEqual(64);
  });
});
