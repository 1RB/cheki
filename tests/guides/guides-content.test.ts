/**
 * Guard rails for the guide articles' copy: claims that drifted once
 * ("no quota", hardcoded bank counts, stale rate limits) fail here instead of
 * shipping again.
 */
import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { articles, getArticle, type Article, type ContentBlock } from "@/lib/guides";
import { IN_DEVELOPMENT_BANK_COUNT, LIVE_BANK_COUNT, TOTAL_BANK_COUNT } from "@/lib/bank-counts";
import { COMPETITORS_CHECKED, COMPETITOR_BANKS_LISTED, HOSTED_RATE_LIMITS, servicesListingMoreBanks } from "@/lib/guides-facts";
import { limiters } from "@/lib/rate-limit";

const source = readFileSync(resolve(__dirname, "../../src/lib/guides.ts"), "utf8");

function blockText(b: ContentBlock): string[] {
  switch (b.type) {
    case "heading":
    case "text":
    case "quote":
      return [b.text];
    case "list":
    case "ordered":
      return b.items;
    case "code":
      return [b.code];
    case "callout":
      return [b.title ?? "", b.text];
    case "table":
      return [...b.headers, ...b.rows.flat()];
    case "steps":
      return b.items.flatMap((s) => [s.title, s.text]);
    case "divider":
      return [];
  }
}

/** Everything a reader (or a crawler) can see for an article. */
function corpus(a: Article): string {
  return [
    a.title, a.description, a.excerpt, a.seo.title, a.seo.description,
    ...a.content.flatMap(blockText),
    ...(a.faq ?? []).flatMap((f) => [f.q, f.a]),
  ].join("\n");
}

describe("guides: rate limits, not quotas", () => {
  it('no article claims "no quota" or "no such limit"', () => {
    for (const a of articles) {
      expect(corpus(a), a.slug).not.toMatch(/no quota|quota-free|no such limit|without (any )?limits?/i);
    }
    expect(source).not.toMatch(/no quota/i);
  });

  it("cheki's own pricing rows never say Unlimited", () => {
    for (const a of articles) {
      for (const b of a.content) {
        if (b.type !== "table") continue;
        for (const row of b.rows.filter((r) => r[0] === "cheki")) expect(row.join(" | "), a.slug).not.toMatch(/unlimited/i);
      }
    }
  });

  it("every quoted per-minute limit matches the hosted limiters", () => {
    expect(HOSTED_RATE_LIMITS).toEqual({ verifyPerMinute: 30, batchPerMinute: 5 });
    expect(limiters.verify.limit).toBe(HOSTED_RATE_LIMITS.verifyPerMinute);
    const all = articles.map(corpus).join("\n");
    const verify = [...all.matchAll(/verify (\d+) per minute|verify (\d+)\/min/gi)].map((m) => Number(m[1] ?? m[2]));
    const batch = [...all.matchAll(/batch (\d+) per minute|batch (\d+)\/min/gi)].map((m) => Number(m[1] ?? m[2]));
    expect(verify.length).toBeGreaterThan(0);
    expect(new Set(verify)).toEqual(new Set([HOSTED_RATE_LIMITS.verifyPerMinute]));
    expect(new Set(batch)).toEqual(new Set([HOSTED_RATE_LIMITS.batchPerMinute]));
  });
});

describe("guides: bank counts come from bank-counts.ts", () => {
  // Counts that are about someone else (the market, a competitor, eBirr's
  // partners), each checked by hand. cheki's own counts are never literals.
  const THIRD_PARTY = [
    "Ethiopia has 30+ licensed banks",
    "only support 6-10",
    "eBirr alone covers 4 additional banks",
    "tally is a Telegram-first service with 4 banks",
    "Weaknesses: only 4 banks",
  ];

  it("guides.ts has no hardcoded bank or wallet count outside the third-party allowlist", () => {
    let text = source;
    for (const phrase of THIRD_PARTY) {
      expect(text, `allowlisted phrase no longer exists: ${phrase}`).toContain(phrase);
      text = text.split(phrase).join("");
    }
    const hits = [...text.matchAll(/\b\d+\+?\s+(?:live\s+|supported\s+|Ethiopian\s+|licensed\s+|more\s+)*(?:banks?|wallets?|providers?)\b/gi)].map((m) => m[0]);
    expect(hits).toEqual([]);
  });

  it("table cells don't carry a bare count for cheki either", () => {
    const cmp = getArticle("check-et-vs-verify-et-vs-cheki")!;
    const table = cmp.content.find((b): b is Extract<ContentBlock, { type: "table" }> => b.type === "table" && b.headers[1] === "cheki" && b.rows.some((r) => /banks/i.test(r[0])))!;
    const row = table.rows.find((r) => /banks/i.test(r[0]))!;
    expect(row[1]).toBe(`${LIVE_BANK_COUNT} live`);
    expect(row.slice(2).map(Number)).toEqual(Object.values(COMPETITOR_BANKS_LISTED));
  });

  it("the rendered counts are the derived ones", () => {
    expect(getArticle("ethiopian-bank-receipt-formats")!.excerpt).toContain(`${LIVE_BANK_COUNT} live banks and wallets`);
    expect(getArticle("contribute-new-bank")!.excerpt).toMatch(new RegExp(`^${IN_DEVELOPMENT_BANK_COUNT} Ethiopian banks`));
    const all = articles.map(corpus).join("\n");
    for (const m of all.matchAll(/cheki (?:supports|lists) (\d+)/g)) {
      expect([LIVE_BANK_COUNT, TOTAL_BANK_COUNT]).toContain(Number(m[1]));
    }
  });

  it("'fewer live banks than' names exactly the services that list more", () => {
    const text = corpus(getArticle("check-et-vs-verify-et-vs-cheki")!);
    const more = servicesListingMoreBanks(LIVE_BANK_COUNT);
    if (more.length) expect(text).toContain(`fewer live banks than ${more.join("/")} list`);
    else expect(text).not.toContain("fewer live banks than");
  });
});

describe("guides: competitor claims are dated", () => {
  it("both comparison articles say when prices were checked, and that the rest is June 2026", () => {
    for (const slug of ["check-et-vs-verify-et-vs-cheki", "free-receipt-verification-no-api-key"]) {
      const text = corpus(getArticle(slug)!);
      expect(text, slug).toContain(COMPETITORS_CHECKED);
      expect(text, slug).toContain("June 2026");
    }
  });

  it("no stale verify.et USD pricing or 'vaporware' label survives", () => {
    const all = articles.map(corpus).join("\n");
    expect(all).not.toMatch(/\$20-40/);
    expect(all).not.toMatch(/vaporware/i);
  });
});

describe("guides: Telebirr how-to covers the receipt QR", () => {
  const telebirr = corpus(getArticle("how-to-verify-telebirr-receipt")!);
  it("explains uploading, scanning or pasting the Payment QR Code", () => {
    expect(telebirr).toContain("Payment QR Code");
    expect(telebirr).toMatch(/Upload receipt screenshot/);
    expect(telebirr).toMatch(/qrData/);
  });
  it("says the QR alone is never verified", () => {
    expect(telebirr).toMatch(/never verifies a receipt from QR content alone/);
    expect(telebirr).toMatch(/only verified when Telebirr's own receipt page confirms it/);
  });
});

describe("guides: dates", () => {
  it("every article has a published and an updated date, updated never before published", () => {
    for (const a of articles) {
      expect(a.date, a.slug).toMatch(/^\d{4}-\d{2}-\d{2}$/);
      expect(a.updated, a.slug).toMatch(/^\d{4}-\d{2}-\d{2}$/);
      expect(a.updated >= a.date, a.slug).toBe(true);
    }
  });

  it("the recent-updates paragraph is current", () => {
    const text = corpus(getArticle("check-et-vs-verify-et-vs-cheki")!);
    expect(text).toMatch(/Recent updates \(October 2026\): .*Payment QR Code on Telebirr receipts/);
    expect(text).not.toMatch(/Recent updates: cheki now parses mobile 'Select All'/);
  });

  it("no guide still points at the removed 'Receipt URL' tab", () => {
    expect(articles.map(corpus).join("\n")).not.toMatch(/Receipt URL' tab/);
  });
});
