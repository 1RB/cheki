/**
 * Site-wide Vercel Web Analytics (src/lib/analytics/url.ts): an event carries a
 * known page path and nothing else.
 *   - A/B share links ("/?v=a", "/ab/a") are reported as "/ab/{arm}"
 *   - every query string and #fragment is stripped
 *   - /api and /dashboard are never counted
 *   - a path that is not a cheki page (a 404, a reference typed as a path) is
 *     dropped, since the route sent beside the URL would be the raw path
 *   - every page under src/app is accounted for in analyticsPaths()
 *   - no copy claims the site has no analytics, and the home FAQ says what it counts
 */
import { describe, it, expect } from "vitest";
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative, sep } from "node:path";
import { analyticsUrl } from "@/lib/analytics/url";
import { STATIC_PAGES, analyticsPaths } from "@/lib/analytics/paths";
import { banks } from "@/lib/banks";
import { articles } from "@/lib/guides";
import { OG_ARMS } from "@/lib/og/ab";
import sitemap from "@/app/sitemap";
import { homeFaqs } from "@/lib/home-faq";
import { translations } from "@/lib/i18n/translations";

const O = "https://cheki.et";
const known = new Set(analyticsPaths());
const map = (u: string) => analyticsUrl(u, known);
const root = join(__dirname, "..", "..");

function walk(dir: string): string[] {
  return readdirSync(dir).flatMap((f) => {
    const p = join(dir, f);
    return statSync(p).isDirectory() ? walk(p) : [p];
  });
}

describe("analytics url", () => {
  it("reports A/B share links as /ab/{arm}, query dropped", () => {
    for (const arm of OG_ARMS) {
      expect(map(`${O}/?v=${arm}`)).toBe(`${O}/ab/${arm}`);
      expect(map(`${O}/?v=${arm}&trx=FT26SAMPLE01#x`)).toBe(`${O}/ab/${arm}`);
      expect(map(`${O}/ab/${arm}`)).toBe(`${O}/ab/${arm}`);
      expect(map(`${O}/ab/${arm}?ref=FT26SAMPLE01`)).toBe(`${O}/ab/${arm}`);
    }
    // Not an arm: plain home (no rewrite happens), or an unknown /ab page.
    expect(map(`${O}/?v=current`)).toBe(`${O}/`);
    expect(map(`${O}/?v=FT26SAMPLE01`)).toBe(`${O}/`);
    expect(map(`${O}/ab/current`)).toBeNull();
    expect(map(`${O}/ab/a/b`)).toBeNull();
  });

  it("strips every query string and fragment", () => {
    expect(map(`${O}/?trx=FT26SAMPLE01&bank=boa`)).toBe(`${O}/`);
    expect(map(`${O}/?ref=https%3A%2F%2Fmbreciept.cbe.com.et%2FfHCxExampleRcpt01`)).toBe(`${O}/`);
    expect(map(`${O}/banks/cbe?reference=FT26SAMPLE01&accountNumber=1000000006171`)).toBe(`${O}/banks/cbe`);
    expect(map(`${O}/banks#cbe`)).toBe(`${O}/banks`);
    expect(map(`${O}/docs?x=1#verify`)).toBe(`${O}/docs`);
    const g = articles[0].slug;
    expect(map(`${O}/guides/${g}?utm_source=telegram`)).toBe(`${O}/guides/${g}`);
    for (const u of STATIC_PAGES) expect(map(`${O}${u}?id=DET0SAMPLE#top`)).toBe(`${O}${u}`);
  });

  it("keeps the deployment's own origin", () => {
    expect(map("https://chekiapp-git-x.vercel.app/banks?trx=1")).toBe("https://chekiapp-git-x.vercel.app/banks");
  });

  it("never counts /api or /dashboard", () => {
    for (const p of ["/api", "/api/verify", "/api/verify/batch?x=1", "/api/banks", "/dashboard", "/dashboard/receipts/FT1"]) {
      expect(map(`${O}${p}`), p).toBeNull();
    }
    expect(analyticsUrl(`${O}/api/verify`, new Set(["/api/verify"]))).toBeNull();
    expect(analyticsUrl(`${O}/dashboard`, new Set(["/dashboard"]))).toBeNull();
  });

  it("drops paths that are not cheki pages, so a reference in the path never leaves", () => {
    for (const p of [
      "/FT26SAMPLE01",
      "/DET0SAMPLE",
      "/fHCxExampleRcpt01",
      "/banks/FT26SAMPLE01",
      "/banks/cbe/FT26SAMPLE01",
      "/guides/FT26SAMPLE01",
      "/verify/FT26SAMPLE01",
      "/slip/",
      "/banks/",
      "/Banks",
    ]) {
      expect(map(`${O}${p}`), p).toBeNull();
    }
    expect(map("not a url")).toBeNull();
  });

  it("counts every bank and guide page, and no dynamic page outside them", () => {
    for (const b of banks) expect(map(`${O}/banks/${b.code}`)).toBe(`${O}/banks/${b.code}`);
    for (const a of articles) expect(map(`${O}/guides/${a.slug}`)).toBe(`${O}/guides/${a.slug}`);
    expect(new Set(analyticsPaths()).size).toBe(analyticsPaths().length);
    expect(analyticsPaths().every((p) => /^\/[a-z0-9/-]*$/.test(p))).toBe(true);
  });

  it("counts every sitemap URL", () => {
    for (const { url } of sitemap()) expect(map(url), url).toBe(url);
  });

  it("lists every non-dynamic page under src/app, and only the known dynamic routes", () => {
    const app = join(root, "src", "app");
    const pages = walk(app)
      .filter((p) => p.endsWith(`${sep}page.tsx`))
      .map((p) => "/" + relative(app, p).split(sep).slice(0, -1).join("/"))
      .map((p) => (p === "/" ? p : p.replace(/\/$/, "")));
    const dynamic = pages.filter((p) => p.includes("["));
    expect(dynamic.sort()).toEqual(["/ab/[v]", "/banks/[code]", "/guides/[slug]"]);
    expect(pages.filter((p) => !p.includes("[")).sort()).toEqual([...STATIC_PAGES].sort());
  });

  it("the client component sends nothing analyticsUrl rejects", () => {
    const c = readFileSync(join(root, "src/components/SiteAnalytics.tsx"), "utf8");
    expect(c).toMatch(/analyticsUrl\(event\.url, known\)/);
    expect(c).toMatch(/<Analytics beforeSend=\{beforeSend\} \/>/);
    expect(c).toMatch(/url === null \? null : \{ \.\.\.event, url \}/);
  });

  it("no copy claims there is no analytics or tracking; the home FAQ says what is counted", () => {
    const NO_TRACKING = /\bno (analytics|tracking|trackers?|telemetry)\b|\b(don'?t|do not|never) track\b|\bnot tracked\b/i;
    const files = [
      "README.md",
      "public/llms.txt",
      ...walk(join(root, "src")).filter((p) => /\.(tsx?|json)$/.test(p) && !p.endsWith("banks.json")).map((p) => relative(root, p)),
    ];
    for (const f of files) expect(readFileSync(join(root, f), "utf8"), f).not.toMatch(NO_TRACKING);
    expect(JSON.stringify(translations)).not.toMatch(NO_TRACKING);
    const faq = homeFaqs.find((f) => /track/i.test(f.q));
    expect(faq?.a).toMatch(/Vercel Web Analytics/);
    expect(faq?.a).toMatch(/no cookies/);
    expect(faq?.a).toMatch(/query string/);
  });
});
