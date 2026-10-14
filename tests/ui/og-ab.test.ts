/**
 * Share-link A/B test for the home card (src/lib/og/ab.ts):
 *   - every arm maps to a real OG variant, never the shipped "current" twice
 *   - next.config rewrites exactly the arms, so "/?v=x" for anything else is plain home
 *   - the arm page is noindexed with canonical "/"
 *   - analytics is mounted once, in the root layout (src/lib/analytics/url.ts
 *     reports the arms as "/ab/{arm}"; tests/ui/analytics.test.ts)
 */
import { describe, it, expect } from "vitest";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import { OG_AB, OG_ARMS, isOgArm } from "@/lib/og/ab";
import { OG_VARIANTS } from "@/lib/og/variant";
import nextConfig from "../../next.config";

const root = join(__dirname, "..", "..");

function walk(dir: string): string[] {
  return readdirSync(dir).flatMap((f) => {
    const p = join(dir, f);
    return statSync(p).isDirectory() ? walk(p) : [p];
  });
}

describe("og a/b", () => {
  it("maps each arm to a distinct known variant", () => {
    const vs = OG_ARMS.map((a) => OG_AB[a]);
    for (const v of vs) expect(OG_VARIANTS).toContain(v);
    expect(new Set(vs).size).toBe(vs.length);
    expect(isOgArm("a")).toBe(true);
    expect(isOgArm("current")).toBe(false);
  });

  it("rewrites only the arms, before the / page", async () => {
    const r = await nextConfig.rewrites!();
    expect(Array.isArray(r)).toBe(false);
    const before = (r as { beforeFiles: { source: string; destination: string; has?: { value?: string }[] }[] }).beforeFiles;
    expect(before.map((x) => x.destination)).toEqual(OG_ARMS.map((a) => `/ab/${a}`));
    expect(before.every((x) => x.source === "/" && x.has?.[0]?.value)).toBe(true);
  });

  it("keeps arm pages out of the index", () => {
    const page = readFileSync(join(root, "src/app/ab/[v]/page.tsx"), "utf8");
    expect(page).toMatch(/robots:\s*\{\s*index:\s*false/);
    expect(page).toMatch(/canonical:\s*"\/"/);
  });

  it("mounts analytics once, in the root layout, not on the arm page", () => {
    const src = walk(join(root, "src")).filter((p) => /\.(tsx?|jsx?)$/.test(p));
    const users = src
      .filter((p) => readFileSync(p, "utf8").includes("@vercel/analytics"))
      .map((p) => p.slice(root.length + 1));
    expect(users).toEqual(["src/components/SiteAnalytics.tsx"]);
    const importers = src
      .filter((p) => !p.endsWith("SiteAnalytics.tsx"))
      .filter((p) => /from "@\/components\/SiteAnalytics"/.test(readFileSync(p, "utf8")))
      .map((p) => p.slice(root.length + 1));
    expect(importers).toEqual(["src/app/layout.tsx"]);
    expect(readFileSync(join(root, "src/app/layout.tsx"), "utf8").match(/<SiteAnalytics\b/g)).toHaveLength(1);
  });
});
