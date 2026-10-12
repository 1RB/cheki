// @vitest-environment jsdom
/**
 * /guides index: grouped by job (not by date), plain rows, server-rendered
 * with search as the only client island, and the design-language rules
 * (ink labels, no category colours, no green selection or focus).
 */
import { describe, it, expect, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { articles } from "@/lib/guides";
import { formatGuideDate, guideSections, latestGuideUpdate, oneLine, orderedGuides, sectionOf } from "@/lib/guides-index";
import { I18nProvider } from "@/lib/i18n/context";
import { translations } from "@/lib/i18n/translations";
import GuidesPage from "@/app/guides/page";

vi.mock("@/components/Chrome", () => ({ Nav: () => null, Footer: () => null }));
vi.mock("next/link", () => ({ default: ({ href, children, prefetch: _p, ...rest }: { href: string; children: React.ReactNode; prefetch?: boolean }) => <a href={href} {...rest}>{children}</a> }));

const root = resolve(__dirname, "../..");
const read = (f: string) => readFileSync(resolve(root, f), "utf8");

describe("guide sections", () => {
  const sections = guideSections();

  it("groups by job in task order, every article exactly once", () => {
    expect(sections.map((s) => s.id)).toEqual(["verify", "fraud", "developers", "open-source", "comparisons"]);
    const slugs = sections.flatMap((s) => s.guides.map((a) => a.slug));
    expect(slugs).toHaveLength(articles.length);
    expect(new Set(slugs).size).toBe(articles.length);
    expect(orderedGuides().map((a) => a.slug)).toEqual(slugs);
  });

  it("puts the bank how-tos first, by bank, how-to before the deep dive", () => {
    expect(sections[0].guides.map((a) => a.slug)).toEqual([
      "how-to-verify-cbe-receipt",
      "cbe-receipt-qr-code",
      "how-to-verify-telebirr-receipt",
      "how-to-verify-boa-receipt",
    ]);
    expect(sections[0].guides.every((a) => a.category === "bank")).toBe(true);
  });

  it("files API, self-hosting, formats and QR internals under developers", () => {
    expect(sections.find((s) => s.id === "developers")!.guides.map((a) => a.slug)).toEqual([
      "payment-verification-api-guide",
      "self-hosting-docker-guide",
      "ethiopian-bank-receipt-formats",
      "boa-qr-code-receipts",
    ]);
  });

  it("maps every category to a section", () => {
    expect(sectionOf({ ...articles[0], category: "business" })).toBe("fraud");
    expect(sectionOf({ ...articles[0], category: "technical" })).toBe("developers");
    expect(sectionOf({ ...articles[0], category: "comparison" })).toBe("comparisons");
  });

  it("drops empty sections", () => {
    expect(guideSections(articles.filter((a) => a.category === "bank")).map((s) => s.id)).toEqual(["verify"]);
  });
});

describe("row helpers", () => {
  it("oneLine keeps the first sentence and never cuts at a domain or a decimal", () => {
    expect(oneLine("check.et charges 499 ETB/month, and verify.et starts at 1.5 ETB. Both use public endpoints.")).toBe(
      "check.et charges 499 ETB/month, and verify.et starts at 1.5 ETB."
    );
    expect(oneLine("No full stop here")).toBe("No full stop here");
  });

  it("formats YYYY-MM-DD as a calendar date with no timezone shift", () => {
    expect(formatGuideDate("2026-10-12")).toBe("Oct 12, 2026");
    expect(formatGuideDate("2026-01-01")).toBe("Jan 1, 2026");
    expect(() => formatGuideDate("12/10/2026")).toThrow();
  });

  it("latestGuideUpdate is the newest updated date", () => {
    expect(latestGuideUpdate()).toBe(articles.map((a) => a.updated).sort().at(-1));
  });
});

describe("GuidesPage (server render)", () => {
  const html = renderToStaticMarkup(
    <I18nProvider>
      <GuidesPage />
    </I18nProvider>
  );
  const doc = new DOMParser().parseFromString(html, "text/html");
  const rows = [...doc.querySelectorAll("[data-guide-row]")];

  it("renders every guide as a plain row: title, one-line excerpt, read time, updated date", () => {
    expect(rows).toHaveLength(articles.length);
    const first = orderedGuides()[0];
    const row = rows[0];
    expect(row.querySelector("a")!.getAttribute("href")).toBe(`/guides/${first.slug}`);
    expect(row.querySelector(".gx-row-title")!.textContent).toBe(first.title);
    expect(row.querySelector(".gx-row-excerpt")!.textContent).toBe(oneLine(first.excerpt));
    expect(row.querySelector(".gx-row-meta")!.textContent).toContain(`${first.readTime} read`);
    expect(row.querySelector("time")!.getAttribute("dateTime") ?? row.querySelector("time")!.getAttribute("datetime")).toBe(first.updated);
    expect(row.querySelector("time")!.textContent).toBe(`Updated ${formatGuideDate(first.updated)}`);
    for (const r of rows) expect(r.getAttribute("data-search")).toBe(r.getAttribute("data-search")!.toLowerCase());
  });

  it("section headings are in task order and every row sits in one", () => {
    expect([...doc.querySelectorAll(".gx-h2")].map((h) => h.textContent)).toEqual([
      "Verify a receipt", "Spot fraud", "For developers", "Open source", "Comparisons",
    ]);
    expect(doc.querySelectorAll("[data-guide-section] [data-guide-row]")).toHaveLength(articles.length);
  });

  it("has a search box and no card, featured card, pill or colour filter", () => {
    expect(doc.querySelector('input[type="search"]')).not.toBeNull();
    expect(html).not.toMatch(/guide-card|guides-grid|featured/);
    expect(doc.querySelectorAll("button").length).toBe(0); // no filter pills (the clear button only appears with no results)
    expect(html).not.toMatch(/#2563eb|#dc2626|#7c3aed|#059669|#d97706|#0891b2|#db2777/);
    expect(html).not.toMatch(/text-transform|letter-spacing|uppercase/i);
  });

  it("emits ItemList JSON-LD in row order", () => {
    const blocks = [...doc.querySelectorAll('script[type="application/ld+json"]')].map((s) => JSON.parse(s.textContent!));
    const list = blocks.find((b) => b["@type"] === "ItemList");
    expect(list).toBeDefined();
    expect(list.numberOfItems).toBe(articles.length);
    expect(list.itemListElement.map((i: { url: string }) => i.url)).toEqual(rows.map((r) => `https://cheki.et${r.querySelector("a")!.getAttribute("href")}`));
    expect(list.itemListElement.map((i: { position: number }) => i.position)).toEqual(rows.map((_, i) => i + 1));
    expect(blocks.some((b) => b["@type"] === "BreadcrumbList")).toBe(true);
  });
});

describe("guides: server component, design language", () => {
  const indexSrc = read("src/app/guides/page.tsx");
  const articleSrc = read("src/app/guides/[slug]/page.tsx");
  const css = read("src/components/guides/guides.css");

  it("the index is a server component; search is the client island", () => {
    expect(indexSrc).not.toMatch(/^["']use client["']/m);
    expect(read("src/components/guides/GuidesSearch.tsx")).toMatch(/^"use client";/);
    expect(indexSrc).not.toMatch(/categoryColors|categoryLabels/);
  });

  it("no green, tracked caps or tinted callouts on the index or article page", () => {
    for (const [name, src] of [["index", indexSrc], ["article", articleSrc], ["guides.css", css]] as const) {
      expect(src, name).not.toMatch(/--green|#16a34a|#0a7b43|#3dd37a/);
      expect(src, name).not.toMatch(/textTransform|text-transform|letterSpacing:\s*"0\.0|uppercase/);
      expect(src, name).not.toMatch(/-light\)/); // no tinted (green-light, amber-light, red-light) fills
    }
  });

  it("callouts carry no emoji icons", () => {
    expect(articleSrc).not.toMatch(/[\u2139\u26A0\u2713\u2715\u275D]|\u{1F4A1}/u);
  });

  it("focus and selection are ink, not green", () => {
    expect(css).toMatch(/\.guides-scope \{\s*--ring: color-mix\(in srgb, var\(--ink\)/);
    expect(css).toMatch(/\.guides-scope ::selection/);
    expect(indexSrc).toMatch(/className="guides-scope"/);
    expect(articleSrc).toMatch(/className="guides-scope"/);
  });

  it("search input is 16px (no iOS zoom) and rows are 44px targets", () => {
    expect(css).toMatch(/\.gx-search-input \{[^}]*font-size: 16px/);
    expect(css).toMatch(/\.gx-row \{[^}]*min-height: 44px/);
  });
});

describe("guides i18n", () => {
  const keys = (o: object, p = ""): string[] =>
    Object.entries(o).flatMap(([k, v]) => (typeof v === "string" ? [`${p}${k}`] : keys(v as object, `${p}${k}.`)));

  it("every guides.* string exists in English and Amharic", () => {
    const en = keys(translations.en.guides).sort();
    const am = keys((translations.am as unknown as { guides: object }).guides).sort();
    expect(am).toEqual(en);
    expect(en).toEqual(expect.arrayContaining(["title", "searchLabel", "updated", "toc", "related", "sections.verify.title"]));
  });
});
