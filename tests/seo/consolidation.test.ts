/**
 * One URL per search intent (src/lib/seo-redirects.ts):
 *   - every removed URL answers a single 301 to the page that owns its intent
 *   - no removed URL is in the sitemap or still served by a route
 *   - nothing in the repo links to a removed URL
 *   - the old page's main query survives on the destination as a real heading
 *     with a stable id, and its best question is in the destination's FAQ
 */
import { describe, it, expect } from "vitest";
import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import nextConfig from "../../next.config";
import sitemap from "@/app/sitemap";
import { articles, getArticle } from "@/lib/guides";
import { banks, getBank } from "@/lib/banks";
import { guideSections } from "@/lib/guides-index";
import { bankPageContent } from "@/lib/bank-page-content";
import { compareFaqs } from "@/lib/compare-content";
import { docsFaqs, developersFaqs } from "@/lib/api-faq";
import { homeFaqs } from "@/lib/home-faq";
import {
  BANK_HEADING,
  CONSOLIDATED_URLS,
  REMOVED_PATHS,
  redirectDestination,
  type ConsolidatedUrl,
} from "@/lib/seo-redirects";

const ROOT = join(__dirname, "..", "..");
const read = (p: string) => readFileSync(join(ROOT, p), "utf8");

function walk(dir: string, exts: RegExp): string[] {
  if (!existsSync(join(ROOT, dir))) return [];
  return readdirSync(join(ROOT, dir)).flatMap((name) => {
    const p = join(dir, name);
    if (statSync(join(ROOT, p)).isDirectory()) return walk(p, exts);
    return exts.test(name) ? [p] : [];
  });
}

/** A file's text without code comments, which may name a removed path to explain it. */
function linkable(f: string): string {
  const text = read(f);
  if (!/\.tsx?$/.test(f)) return text;
  return text.replace(/\/\*[\s\S]*?\*\//g, "").replace(/(^|[^:"'`\w])\/\/.*$/gm, "$1");
}

const escape = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

describe("redirect table", () => {
  it("covers the 31 consolidated URLs, each once", () => {
    expect(REMOVED_PATHS).toHaveLength(31);
    expect(new Set(REMOVED_PATHS).size).toBe(REMOVED_PATHS.length);
  });

  it("every removed URL is a 301 in next.config to its mapped destination", async () => {
    const redirects = await nextConfig.redirects!();
    for (const u of CONSOLIDATED_URLS) {
      const r = redirects.filter((x) => x.source === u.source);
      expect(r, u.source).toHaveLength(1);
      expect(r[0].destination, u.source).toBe(redirectDestination(u));
      expect("statusCode" in r[0] && r[0].statusCode, u.source).toBe(301);
    }
  });

  it("no destination is itself redirected (one hop, no chains)", async () => {
    const sources = new Set((await nextConfig.redirects!()).map((r) => r.source));
    for (const u of CONSOLIDATED_URLS) expect(sources.has(u.path), `${u.source} -> ${u.path}`).toBe(false);
  });

  it("the older per-bank /verify redirects still work", async () => {
    const redirects = await nextConfig.redirects!();
    const cbe = redirects.find((r) => r.source === "/verify/verify-cbe-receipt-online");
    expect(cbe?.destination).toBe("/banks/cbe");
    expect(redirects.find((r) => r.source === "/verify/check-zemen-payment-online")?.destination).toBe("/banks");
  });
});

describe("removed pages are gone", () => {
  it("no /verify route is left in the app", () => {
    expect(existsSync(join(ROOT, "src/app/verify"))).toBe(false);
  });

  it("no removed guide slug is still an article", () => {
    const slugs = new Set(articles.map((a) => `/guides/${a.slug}`));
    for (const p of REMOVED_PATHS) expect(slugs.has(p), p).toBe(false);
  });

  it("the sitemap lists none of them, and every destination", () => {
    const urls = sitemap().map((e) => new URL(e.url).pathname);
    for (const p of REMOVED_PATHS) expect(urls, p).not.toContain(p);
    expect(urls.filter((u) => u === "/verify" || u.startsWith("/verify/"))).toEqual([]);
    for (const u of CONSOLIDATED_URLS) expect(urls, u.path).toContain(u.path);
  });

  it("no source file links to a removed path", () => {
    const files = [
      ...walk("src", /\.(tsx?|json|css|md)$/),
      ...walk("public", /\.(txt|js|json)$/),
      ...walk("docs", /\.md$/),
      ...walk("sdks", /\.md$/),
      "README.md",
      "CONTRIBUTING.md",
      "python/README.md",
    ].filter((f) => !f.endsWith(join("lib", "seo-redirects.ts")));
    expect(files.length).toBeGreaterThan(50);
    // A removed path as a link: not part of a longer path (so "/api/verify"
    // never matches "/verify"), optionally after the site's own host.
    const longestFirst = [...REMOVED_PATHS].sort((x, y) => y.length - x.length).map(escape).join("|");
    const re = new RegExp(`(?<=^|[^\\w/.-]|cheki\\.et)(${longestFirst})(?=$|[^\\w/-])`, "gm");
    const hits = files.flatMap((f) => [...linkable(f).matchAll(re)].map((m) => `${f}: ${m[1]}`));
    expect(hits).toEqual([]);
  });
});

/** The heading ids and texts a destination renders. */
function headingsOn(u: ConsolidatedUrl): { id: string; text: string }[] {
  if (u.path === "/guides") {
    expect(read("src/app/guides/page.tsx")).toContain("id={`gx-${s.id}`}");
    return guideSections().map((s) => ({ id: `gx-${s.id}`, text: s.title }));
  }
  if (u.path.startsWith("/guides/")) {
    const a = getArticle(u.path.slice("/guides/".length));
    expect(a, u.path).toBeDefined();
    return a!.content.flatMap((b) => (b.type === "heading" && b.id ? [{ id: b.id, text: b.text }] : []));
  }
  if (u.path.startsWith("/banks/")) {
    const bank = getBank(u.path.slice("/banks/".length))!;
    expect(bank.status, u.path).toBe("live");
    expect(read("src/app/banks/[code]/page.tsx")).toContain("<h2 id={BANK_HEADING.howToVerify.id}>{BANK_HEADING.howToVerify.text(bank.shortName)}</h2>");
    return [
      { id: BANK_HEADING.howToVerify.id, text: BANK_HEADING.howToVerify.text(bank.shortName) },
      ...bankPageContent(bank).sections.flatMap((s) => (s.id ? [{ id: s.id, text: s.heading }] : [])),
    ];
  }
  const file = { "/": "src/components/HomePage.tsx", "/docs": "src/app/docs/page.tsx", "/developers": "src/app/developers/page.tsx", "/compare": "src/app/compare/page.tsx" }[u.path];
  expect(file, u.path).toBeDefined();
  const src = read(file!);
  return [...src.matchAll(/<(?:h[23]|SectionTitle|SubTitle)\b[^>]*\bid="([^"]+)"[^>]*>\s*([^<{]+?)\s*<\//g)].map((m) => ({ id: m[1], text: m[2].replace(/&apos;/g, "'") }));
}

/** The visible FAQ (and FAQPage JSON-LD) on a destination. */
function faqOn(path: string): string[] {
  if (path.startsWith("/guides/")) return (getArticle(path.slice("/guides/".length))?.faq ?? []).map((f) => f.q);
  if (path.startsWith("/banks/")) return bankPageContent(getBank(path.slice("/banks/".length))!).faq.map((f) => f.q);
  const lists: Record<string, { q: string }[]> = { "/": homeFaqs, "/docs": docsFaqs, "/developers": developersFaqs, "/compare": compareFaqs };
  return (lists[path] ?? []).map((f) => f.q);
}

describe("search surface survives on the destination", () => {
  it.each(CONSOLIDATED_URLS.map((u) => [u.source, u] as const))("%s: mapped heading is a real heading with its id", (_s, u) => {
    const found = headingsOn(u).filter((h) => h.id === u.headingId);
    expect(found, `${u.path} has no heading with id ${u.headingId}`).toHaveLength(1);
    expect(found[0].text).toBe(u.heading);
  });

  it.each(CONSOLIDATED_URLS.filter((u) => u.faq).map((u) => [u.source, u] as const))("%s: best question is in the destination FAQ", (_s, u) => {
    expect(faqOn(u.path)).toContain(u.faq);
  });

  it("every page except the /verify index brought a question along", () => {
    expect(CONSOLIDATED_URLS.filter((u) => !u.faq).map((u) => u.source)).toEqual(["/verify"]);
  });

  it("heading ids are unique on each page", () => {
    for (const b of banks.filter((x) => x.status === "live")) {
      const ids = bankPageContent(b).sections.flatMap((s) => (s.id ? [s.id] : []));
      expect(new Set(ids).size, b.code).toBe(ids.length);
    }
    for (const a of articles) {
      const ids = a.content.flatMap((b) => (b.type === "heading" && b.id ? [b.id] : []));
      expect(new Set(ids).size, a.slug).toBe(ids.length);
    }
  });
});
