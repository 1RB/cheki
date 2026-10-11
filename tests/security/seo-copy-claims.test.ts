/**
 * SEO copy, metadata and FAQ JSON-LD must match what the API enforces and
 * what the manifest marks live (left over from PR #28, which could not touch
 * the files #3 and #27 own):
 *   - no "no rate limit" anywhere; per-IP limits instead
 *   - batch max 20, never "up to 50"
 *   - live-bank counts and lists come from the manifest (8 live, not 10;
 *     Zemen and CBE Birr are in development)
 */
import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { homeFaqs } from "@/lib/home-faq";
import { allSeoPages } from "@/lib/seo-pages";
import { articles } from "@/lib/guides";
import { getAllBanks } from "@/lib/manifest/loader";
import { LIVE_BANK_COUNT, TOTAL_BANK_COUNT, IN_DEVELOPMENT_BANK_COUNT, liveBankList, liveProviders } from "@/lib/bank-counts";
import { metadata as rootMetadata } from "@/app/layout";
import { metadata as docsMetadata } from "@/app/docs/layout";
import { metadata as developersMetadata } from "@/app/developers/layout";
import { metadata as banksMetadata } from "@/app/banks/layout";

const read = (p: string) => readFileSync(join(__dirname, "..", "..", p), "utf8");

const COPY_FILES = [
  "src/lib/seo-pages.ts",
  "src/lib/seo-pages-generated.ts",
  "src/lib/guides.ts",
  "src/lib/home-faq.ts",
  "src/app/layout.tsx",
  "src/app/docs/layout.tsx",
  "src/app/developers/layout.tsx",
  "src/app/banks/layout.tsx",
  "src/app/compare/page.tsx",
  "src/app/opengraph-image.tsx",
  "README.md",
  "package.json",
];

/** Every FAQ that is rendered as FAQPage JSON-LD, plus page text and metadata. */
const rendered = JSON.stringify({
  homeFaqs,
  seo: allSeoPages,
  articles,
  // /banks/[code] renders each bank's manifest FAQ as FAQPage JSON-LD.
  manifestFaqs: getAllBanks().map((b) => b.faq ?? []),
  meta: [rootMetadata, docsMetadata, developersMetadata, banksMetadata],
});

describe("rate-limit and batch claims", () => {
  it("no copy, metadata or FAQ claims there is no rate limit", () => {
    for (const f of COPY_FILES) expect(read(f), f).not.toMatch(/no rate limits?\b/i);
    expect(rendered).not.toMatch(/no rate limits?\b/i);
    expect(rendered).not.toMatch(/has no rate limits/i);
    expect(rendered).not.toMatch(/free with no limits/i);
  });

  it("no copy says the batch takes 50", () => {
    for (const f of COPY_FILES) {
      const src = read(f);
      expect(src, f).not.toMatch(/up to 50\b/i);
      expect(src, f).not.toMatch(/\b50 (receipts|at once)/i);
      expect(src, f).not.toMatch(/Yes \(50\)/);
    }
    expect(rendered).not.toMatch(/up to 50\b/i);
    expect(rendered).toMatch(/up to 20 receipts/i);
  });

  it("the FAQ that answers 'Is there a rate limit?' states the per-IP limits", () => {
    const faqs = allSeoPages.flatMap((p) => p.faq);
    const rl = faqs.filter((f) => /rate limit/i.test(f.q));
    expect(rl.length).toBeGreaterThan(0);
    for (const f of rl) {
      expect(f.a).toMatch(/per IP/i);
      expect(f.a).toMatch(/30 per minute/);
      expect(f.a).toMatch(/429/);
    }
  });

  it("the /api/health FAQ reflects the 5-minute cache", () => {
    const health = allSeoPages.find((p) => p.slug === "receipt-health-check-api");
    expect(health?.faq.find((f) => /how often/i.test(f.q))?.a).toMatch(/cached for 5 minutes/);
  });
});

describe("live bank counts match the manifest", () => {
  const providers = getAllBanks().filter((b) => b.id !== "cbe-new");
  const live = providers.filter((b) => b.status === "live");

  it("derives the counts from the manifest", () => {
    expect(LIVE_BANK_COUNT).toBe(live.length);
    expect(TOTAL_BANK_COUNT).toBe(providers.length);
    expect(IN_DEVELOPMENT_BANK_COUNT).toBe(providers.length - live.length);
    expect(liveProviders.map((b) => b.id)).toEqual(live.map((b) => b.id));
  });

  it("no hard-coded live count is left that disagrees", () => {
    for (const f of COPY_FILES) {
      const src = read(f);
      for (const m of src.matchAll(/\b(\d+) live banks?\b/gi)) {
        expect(Number(m[1]), `${f}: ${m[0]}`).toBe(live.length);
      }
    }
    for (const m of rendered.matchAll(/\b(\d+) live banks?\b/gi)) {
      expect(Number(m[1]), m[0]).toBe(live.length);
    }
  });

  it("in-development banks are never listed as supported in FAQ answers", () => {
    const inDev = providers.filter((b) => b.status !== "live");
    const supportFaqs = [...homeFaqs, ...allSeoPages.flatMap((p) => p.faq)].filter((f) =>
      /which banks|how many banks/i.test(f.q)
    );
    expect(supportFaqs.length).toBeGreaterThan(0);
    for (const f of supportFaqs) {
      expect(f.a).toContain(liveBankList());
      for (const b of inDev) expect(f.a, `${f.q} lists ${b.name}`).not.toContain(b.name);
    }
  });

  it("the root meta description only names live banks", () => {
    const desc = String(rootMetadata.description);
    expect(desc).not.toMatch(/Zemen|CBE Birr/);
    expect(desc).toContain("Dashen");
  });
});
