import { describe, expect, it } from "vitest";
import { NextRequest } from "next/server";
import { config, lowercasePath, proxy } from "@/proxy";
import { readdirSync, statSync } from "node:fs";
import { join } from "node:path";

const matcher = new RegExp(`^${config.matcher[0]}$`);

describe("lowercase URL proxy", () => {
  it("redirects a mixed-case path once, permanently, keeping the query", () => {
    const res = proxy(new NextRequest("https://cheki.et/Guides/Payment-Fraud-Ethiopia?ref=x"));
    expect(res.status).toBe(301);
    expect(res.headers.get("location")).toBe("https://cheki.et/guides/payment-fraud-ethiopia?ref=x");
  });

  it("passes lowercase paths through", () => {
    expect(lowercasePath("/banks/cbe")).toBeNull();
    expect(proxy(new NextRequest("https://cheki.et/banks/cbe")).headers.get("location")).toBeNull();
  });

  it("only matches paths with a capital letter, never the API, assets or files", () => {
    expect(matcher.test("/Guides")).toBe(true);
    expect(matcher.test("/banks/CBE")).toBe(true);
    expect(matcher.test("/guides")).toBe(false);
    expect(matcher.test("/api/Verify")).toBe(false);
    expect(matcher.test("/_next/static/chunks/A1.js")).toBe(false);
    expect(matcher.test("/96179dcf70b667c0549d101eb8e06f0E.txt")).toBe(false);
    expect(matcher.test("/OG-image.png")).toBe(false);
  });

  it("every app route is lowercase, so the redirect can never hide a real page", () => {
    const walk = (dir: string): string[] =>
      readdirSync(dir).flatMap((name) => {
        const p = join(dir, name);
        return statSync(p).isDirectory() ? [p, ...walk(p)] : [];
      });
    const routes = walk("src/app").map((d) => d.replace(/^src\/app/, "")).filter((d) => !/\[|\(/.test(d));
    expect(routes.filter((r) => r !== r.toLowerCase())).toEqual([]);
  });
});
