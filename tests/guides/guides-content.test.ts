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
import { COMPETITORS_CHECKED, HOSTED_RATE_LIMITS } from "@/lib/guides-facts";
import { limiters } from "@/lib/rate-limit";
import { crc16CcittFalse, parseTelebirrQr } from "@/lib/qr/telebirr";

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
    expect(HOSTED_RATE_LIMITS).toMatchObject({ verifyPerMinute: 30, batchPerMinute: 5 });
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

  it("the rendered counts are the derived ones", () => {
    expect(getArticle("ethiopian-bank-receipt-formats")!.excerpt).toContain(`${LIVE_BANK_COUNT} live banks and wallets`);
    expect(getArticle("contribute-new-bank")!.excerpt).toMatch(new RegExp(`^${IN_DEVELOPMENT_BANK_COUNT} Ethiopian banks`));
    const all = articles.map(corpus).join("\n");
    for (const m of all.matchAll(/cheki (?:supports|lists) (\d+)/g)) {
      expect([LIVE_BANK_COUNT, TOTAL_BANK_COUNT]).toContain(Number(m[1]));
    }
  });
});

describe("guides: competitor claims are dated", () => {
  it("the comparison article says when prices were checked, and that the rest is June 2026", () => {
    const text = corpus(getArticle("free-receipt-verification-no-api-key")!);
    expect(text).toContain(COMPETITORS_CHECKED);
    expect(text).toContain("June 2026");
  });

  it("no stale verify.et USD pricing or 'vaporware' label survives", () => {
    const all = articles.map(corpus).join("\n");
    expect(all).not.toMatch(/\$20-40/);
    expect(all).not.toMatch(/vaporware/i);
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

  it("no guide still points at the removed 'Receipt URL' tab", () => {
    expect(articles.map(corpus).join("\n")).not.toMatch(/Receipt URL' tab/);
  });
});

describe("guides: the Telebirr receipt QR guide matches the decoder", () => {
  const a = getArticle("telebirr-receipt-qr-code")!;
  const text = a ? corpus(a) : "";
  const codes = a ? a.content.filter((b): b is Extract<ContentBlock, { type: "code" }> => b.type === "code").map((b) => b.code) : [];
  const QR = "ODAxODAwMDIwNjAxMDI5MTAyMDEzMTgxMjQwMDBBNDE0MjQzMzE0NDMyNDUzMzQ2MzQ2MzA0RTk2OQ==";

  it("exists and is filed with the QR internals", () => {
    expect(a).toBeDefined();
    expect(a.category).toBe("technical");
    expect(a.bankCode).toBe("telebirr");
    expect(a.related).toContain("boa-qr-code-receipts");
    expect(a.relatedPages).toContain("/banks/telebirr");
  });

  it("its sample QR decodes to the fake transaction number with the CRC the guide states", () => {
    expect(codes).toContain(QR);
    expect(parseTelebirrQr(QR)).toEqual({ ok: true, reference: "ABC1D2E3F4", crc: "valid" });
    const hex = atob(QR);
    expect(codes).toContain(hex);
    expect(crc16CcittFalse(hex.slice(0, -4)).toString(16).toUpperCase()).toBe("E969");
  });

  it("the mixed-case example's CRC is D22B as emitted and E6B2 upper-cased", () => {
    const body = "8018000206010291020131" + "8124000A584b4a304c394e384d37" + "6304";
    expect(text).toContain("...8124000A584b4a304c394e384d376304D22B");
    expect(crc16CcittFalse(body).toString(16).toUpperCase()).toBe("D22B");
    expect(crc16CcittFalse(body.toUpperCase()).toString(16).toUpperCase()).toBe("E6B2");
    expect(parseTelebirrQr(btoa(body + "D22B"))).toMatchObject({ ok: true, reference: "XKJ0L9N8M7" });
  });

  it("says the QR is not proof and uses only synthetic transaction numbers", () => {
    expect(text).toMatch(/not proof of payment/);
    const refs = text.match(/\b[A-Z]{2,3}[A-Z0-9]{7,8}\b/g) ?? [];
    for (const r of refs) if (/\d/.test(r) && r.length === 10) expect(["ABC1D2E3F4", "XKJ0L9N8M7"], r).toContain(r);
  });
});
