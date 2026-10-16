/**
 * The guides' content rules, applied to the rest of the site: /compare, the
 * bank pages' merged content, the home, docs and developers FAQs, docs, translations, README, llms.txt and the SDK
 * READMEs and package manifests.
 *
 *   - no "no quota" / "unlimited" / "no limits" claim about cheki; the hosted
 *     API has per-IP rate limits, quoted from rate-limit-config
 *   - competitor prices come from guides-facts and are dated
 *   - cheki's own bank counts come from bank-counts
 */
import { describe, it, expect } from "vitest";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import { homeFaqs } from "@/lib/home-faq";
import { banks } from "@/lib/banks";
import { bankPageContent } from "@/lib/bank-page-content";
import { compareFaqs, chekiShortfalls, DATA_SOURCE_EVIDENCE } from "@/lib/compare-content";
import { docsFaqs, developersFaqs } from "@/lib/api-faq";
import { translations } from "@/lib/i18n/translations";
import { IN_DEVELOPMENT_BANK_COUNT, LIVE_BANK_COUNT } from "@/lib/bank-counts";
import { limiters } from "@/lib/rate-limit";
import { RATE_LIMITS } from "@/lib/rate-limit-config";
import {
  COMPETITORS_CHECKED,
  COMPETITOR_PRICING,
  HOSTED_RATE_LIMITS,
  RATE_LIMIT_SHORT,
  type Competitor,
} from "@/lib/guides-facts";

const ROOT = join(__dirname, "..", "..");
const read = (p: string) => readFileSync(join(ROOT, p), "utf8");

function walk(dir: string, exts: RegExp): string[] {
  return readdirSync(join(ROOT, dir)).flatMap((name) => {
    const p = join(dir, name);
    if (statSync(join(ROOT, p)).isDirectory()) return walk(p, exts);
    return exts.test(name) ? [p] : [];
  });
}

/** Everything a reader can see that is written as copy: pages, components, copy modules, docs. */
const SOURCE_COPY = [
  ...walk("src/app", /\.(tsx?|json)$/).filter((p) => !p.startsWith(join("src", "app", "api"))),
  ...walk("src/components", /\.tsx?$/),
  "src/lib/bank-page-content.ts",
  "src/lib/compare-content.ts",
  "src/lib/api-faq.ts",
  "src/lib/seo-redirects.ts",
  "src/lib/home-faq.ts",
  "src/lib/guides.ts",
  "src/lib/guides-facts.ts",
  "src/lib/i18n/translations.ts",
];

const STATIC_COPY = [
  "README.md",
  "python/README.md",
  "public/llms.txt",
  "package.json",
  "composer.json",
  "python/pyproject.toml",
  ...walk("sdks", /^(README\.md|package\.json|composer\.json|pubspec\.yaml)$/).filter((p) => !p.includes("node_modules")),
  ...walk("docs", /\.md$/),
];

const ALL_COPY = [...SOURCE_COPY, ...STATIC_COPY];

/** What the bank pages, /compare and the home, docs and developers FAQs render from copy modules, as text. */
const seoTexts: { where: string; text: string }[] = [
  ...homeFaqs.map((f) => ({ where: `home FAQ: ${f.q}`, text: `${f.q} ${f.a}` })),
  ...[...compareFaqs, ...docsFaqs, ...developersFaqs].map((f) => ({ where: `FAQ: ${f.q}`, text: `${f.q} ${f.a}` })),
  { where: "compare copy", text: [chekiShortfalls(), ...DATA_SOURCE_EVIDENCE].join("\n") },
  ...banks.flatMap((b) => {
    const c = bankPageContent(b);
    return [
      ...c.faq.map((f) => ({ where: `/banks/${b.code} FAQ: ${f.q}`, text: `${f.q} ${f.a}` })),
      ...c.sections.map((s) => ({ where: `/banks/${b.code} section: ${s.heading}`, text: [s.heading, s.body, ...(s.bullets ?? []), ...(s.steps ?? [])].join("\n") })),
    ];
  }),
];

const rendered = [JSON.stringify(translations), ...seoTexts.map((t) => t.text)].join("\n");

/** Claims about competitors' own plans, which are allowed to say "unlimited". */
const COMPETITOR_UNLIMITED = ["Pro is unlimited", "unlimited in the app"];
const NO_LIMIT_CLAIM = /no (verification )?quota|quota-free|\bunlimited\b|\bno limits?\b|without (any )?limits?|no monthly cap|no such limit|free with no limits|no rate limits?\b|የማይገደብ|ያልተገደበ|ገደብ የለሽ/i;

const stripCompetitorUnlimited = (s: string) => COMPETITOR_UNLIMITED.reduce((acc, p) => acc.split(p).join(""), s);

describe("site copy: rate limits, not quotas", () => {
  it("scans a real set of files", () => {
    expect(SOURCE_COPY).toContain(join("src", "app", "compare", "page.tsx"));
    expect(STATIC_COPY).toContain(join("sdks", "typescript", "README.md"));
    expect(ALL_COPY.length).toBeGreaterThan(30);
  });

  it('no file claims "no quota", "unlimited" or "no limits" for cheki', () => {
    for (const f of ALL_COPY) expect(stripCompetitorUnlimited(read(f)), f).not.toMatch(NO_LIMIT_CLAIM);
    expect(stripCompetitorUnlimited(rendered)).not.toMatch(NO_LIMIT_CLAIM);
  });

  it("the compare verdict says rate limits in both languages", () => {
    expect(translations.en.compare.verdict).toMatch(/no signup and no API key, under per-IP rate limits/);
    expect(translations.en.compare.verdict).toMatch(/self-host for more/);
    expect(translations.am.compare.verdict).toMatch(/ያለ API ቁልፍ/);
    expect(translations.am.compare.verdict).toMatch(/ገደብ አለው/);
  });

  it("the limiters and the quoted limits are built from the same table", () => {
    for (const k of Object.keys(RATE_LIMITS) as (keyof typeof RATE_LIMITS)[]) {
      expect(limiters[k].limit, k).toBe(RATE_LIMITS[k].limit);
      expect(limiters[k].windowMs, k).toBe(RATE_LIMITS[k].windowMs);
    }
    expect(HOSTED_RATE_LIMITS).toEqual({ verifyPerMinute: 30, batchPerMinute: 5, parsePerMinute: 20, ocrPerMinute: 20 });
    expect(RATE_LIMIT_SHORT).toBe("per-IP rate limits (verify 30/min, batch 5/min)");
  });

  it("every per-minute limit quoted anywhere matches the limiters", () => {
    const text = [...ALL_COPY.map(read), rendered].join("\n");
    const quoted = (re: RegExp) => [...text.matchAll(re)].map((m) => Number(m.slice(1).find(Boolean)));
    const verify = quoted(/verify:? (\d+) per minute|verify (\d+)\/min|\/api\/verify (\d+) per minute|verify limit \((\d+) per minute\)/gi);
    const batch = quoted(/batch (\d+) per minute|batch (\d+)\/min|\/api\/verify\/batch (\d+) per minute|(\d+) batch requests per minute/gi);
    const parse = quoted(/parse and ocr (\d+)(?:\/min| per minute)|\/api\/ocr (\d+) per minute/gi);
    expect(verify.length).toBeGreaterThan(5);
    expect(batch.length).toBeGreaterThan(5);
    expect(new Set(verify)).toEqual(new Set([HOSTED_RATE_LIMITS.verifyPerMinute]));
    expect(new Set(batch)).toEqual(new Set([HOSTED_RATE_LIMITS.batchPerMinute]));
    expect(new Set(parse)).toEqual(new Set([HOSTED_RATE_LIMITS.parsePerMinute]));
  });

  it("the copy modules read the limits instead of typing them", () => {
    // Pages under src/app keep literal numbers (tests/security pins them, and
    // the test above checks them against the limiters); the shared copy
    // modules and /compare interpolate HOSTED_RATE_LIMITS.
    for (const f of ["src/lib/bank-page-content.ts", "src/lib/compare-content.ts", "src/lib/api-faq.ts", "src/lib/home-faq.ts", "src/app/compare/page.tsx"]) {
      expect(read(f), f).not.toMatch(/(verify|batch|\/api\/verify|\/api\/verify\/batch|\/api\/ocr):? \d+ per minute|\d+ checks per minute|\d+ batch requests/i);
    }
  });
});

describe("site copy: competitor prices come from guides-facts and are dated", () => {
  it("no stale price survives anywhere", () => {
    for (const f of ALL_COPY) {
      const src = read(f);
      expect(src, f).not.toMatch(/\$20-40|\$0\.10-0\.20|3K-8K|500-8K|~2\.5 ETB|pricing not public|Pricing link is a dead anchor|Charges in USD/i);
    }
    expect(rendered).not.toMatch(/\$20-40|3K-8K/);
  });

  it("/compare types no competitor price; it reads COMPETITOR_PRICING", () => {
    const src = read("src/app/compare/page.tsx");
    expect(src).toMatch(/COMPETITOR_PRICING\[c\]\.price/);
    expect(src).toMatch(/COMPETITOR_BANKS_LISTED\[c\]/);
    expect(src).not.toMatch(/\d[\d,]*(?:-\d[\d,K]*)? ETB\s*(?:\/|per )(?:mo|month|yr|year|90)/i);
    expect(src).not.toMatch(/"Free forever"|"Unlimited"|"Unknown"/);
  });

  it("/compare dates what was re-checked and what is June 2026", () => {
    const src = read("src/app/compare/page.tsx");
    expect(src).toContain("{COMPETITORS_CHECKED}");
    expect(src).toContain("{COMPETITOR_FACTS_AS_OF}");
  });

  it("every SEO or FAQ text that quotes a competitor price says when it was listed", () => {
    const priced = seoTexts.filter((t) => /\bETB\s*\/\s*(mo|month|yr|year)\b|ETB per 90 days/i.test(t.text));
    expect(priced.length).toBeGreaterThan(5);
    for (const t of priced) expect(t.text, t.where).toContain(COMPETITORS_CHECKED);
  });

  it("price sentences in the SEO pages are the guides-facts ones, word for word", () => {
    for (const t of seoTexts) {
      for (const m of t.text.matchAll(/(check\.et|verify\.et|qbirr|tinaverify|tally) (charges|has a free tier|gives|sells)[^.]*\./g)) {
        const sentences = Object.values(COMPETITOR_PRICING).map((p) => p.sentence);
        expect(sentences, `${t.where}: ${m[0]}`).toContain(m[0]);
      }
    }
  });

  it("guides-facts covers every competitor with a dated sentence", () => {
    for (const c of Object.keys(COMPETITOR_PRICING) as Competitor[]) {
      expect(COMPETITOR_PRICING[c].sentence.startsWith(c), c).toBe(true);
      expect(COMPETITOR_PRICING[c].sentence, c).not.toMatch(/unlimited/i);
    }
  });
});

describe("site copy: cheki's bank counts are derived", () => {
  it("static files that can't import bank-counts say the current numbers", () => {
    for (const f of STATIC_COPY) {
      const src = read(f);
      for (const m of src.matchAll(/\b(\d+) live banks?\b/gi)) expect(Number(m[1]), `${f}: ${m[0]}`).toBe(LIVE_BANK_COUNT);
      for (const m of src.matchAll(/\b(\d+) in research\b/gi)) expect(Number(m[1]), `${f}: ${m[0]}`).toBe(IN_DEVELOPMENT_BANK_COUNT);
    }
    // The README states both counts in its Supported banks section.
    const readme = read("README.md");
    expect(readme).toMatch(new RegExp(`\\*\\*${LIVE_BANK_COUNT} live banks\\*\\*`));
    expect(readme).toMatch(new RegExp(`\\b${IN_DEVELOPMENT_BANK_COUNT} in research\\b`));
  });

  it("TS copy outside the guides types no bank count for cheki", () => {
    // Counts about someone else, each checked by hand.
    const THIRD_PARTY = [
      "Python library, 6 banks",
      "TypeScript engine, 4 banks",
      "Python toolkit, async/sync, 6 banks",
      "Only 4 banks (CBE, Telebirr, BOA, Awash)",
      "(top 5 banks)",
    ];
    for (const f of SOURCE_COPY.filter((p) => !p.endsWith("guides.ts"))) {
      let text = read(f);
      for (const phrase of THIRD_PARTY) text = text.split(phrase).join("");
      const hits = [...text.matchAll(/\b\d+\+?\s+(?:live\s+|supported\s+|Ethiopian\s+|licensed\s+|more\s+)*(?:banks?|wallets?|providers?)\b(?! receipts?)/gi)].map((m) => m[0]);
      expect(hits, f).toEqual([]);
    }
  });

  it("/compare's bank row reads the manifest and guides-facts", () => {
    const src = read("src/app/compare/page.tsx");
    expect(src).toContain("`${LIVE_BANK_COUNT} live`");
    expect(src).not.toMatch(/cheki: "\d+"/);
  });

  it("in-development banks are not listed as live in llms.txt", () => {
    expect(read("public/llms.txt")).toMatch(/Zemen Bank \(in development\)/);
    expect(read("public/llms.txt")).toMatch(/CBE Birr \(in development\)/);
  });
});

describe("competitor facts re-checked on 15 October 2026", () => {
  // verify.et/robots.txt now welcomes AI crawlers by name and verify.et/docs/sdk
  // says its SDKs are not published (see the note in src/lib/guides-facts.ts).
  const sources = ["src/app/compare/page.tsx", "src/lib/compare-content.ts", "src/lib/guides.ts", "public/llms.txt", "README.md"];

  it("nothing says verify.et blocks AI crawlers today", () => {
    for (const p of sources) {
      const src = read(p);
      expect(src, p).not.toMatch(/Blocks AI crawlers|verify\.et blocks|Why does verify\.et block/i);
      // A past block may be mentioned only with its date.
      for (const m of src.matchAll(/verify\.et[^.\n]{0,80}blocked AI crawlers[^.\n]*/gi)) expect(m[0], p).toMatch(/June 2026/);
    }
    const compare = read("src/app/compare/page.tsx");
    expect(compare).toMatch(/feature: "AI crawler access", cheki: check, checket: check, verifyet: check/);
  });

  it("verify.et is not credited with a published TypeScript SDK", () => {
    const compare = read("src/app/compare/page.tsx");
    expect(compare).not.toMatch(/TypeScript SDK published/);
    expect(compare).toMatch(/feature: "TypeScript SDK", cheki: check, checket: dash, verifyet: "Planned"/);
  });

  it("the re-check date is the one every dated competitor line quotes", () => {
    expect(COMPETITORS_CHECKED).toBe("15 October 2026");
    for (const p of ["public/llms.txt", "README.md"]) {
      expect(read(p), p).not.toMatch(/12 October 2026/);
    }
  });
});
