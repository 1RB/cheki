/**
 * Structured data, metadata and sitemap for the guides.
 */
import { describe, it, expect } from "vitest";
import { articles, getArticle } from "@/lib/guides";
import { orderedGuides } from "@/lib/guides-index";
import { GUIDE_IMAGE, guideArticleJsonLd, guideMetadata, guidesItemListJsonLd, jsonLdScript } from "@/lib/guides-seo";
import { metadata as indexMetadata } from "@/app/guides/layout";
import sitemap from "@/app/sitemap";

describe("Article JSON-LD", () => {
  const a = getArticle("payment-fraud-ethiopia")!;
  const ld = guideArticleJsonLd(a);

  it("has an image, datePublished and dateModified", () => {
    expect(GUIDE_IMAGE).toBe("https://cheki.et/opengraph-image");
    expect(ld.image).toEqual([GUIDE_IMAGE]);
    expect(ld.datePublished).toBe(a.date);
    expect(ld.dateModified).toBe(a.updated);
    expect(ld.dateModified).not.toBe(ld.datePublished);
  });

  it("points at the canonical URL", () => {
    expect(ld.url).toBe("https://cheki.et/guides/payment-fraud-ethiopia");
    expect(ld.mainEntityOfPage).toEqual({ "@type": "WebPage", "@id": ld.url });
    expect(ld["@type"]).toBe("Article");
  });
});

describe("ItemList JSON-LD", () => {
  it("lists every guide once, in index order, with absolute URLs", () => {
    const ld = guidesItemListJsonLd();
    expect(ld["@type"]).toBe("ItemList");
    expect(ld.numberOfItems).toBe(articles.length);
    expect(ld.itemListElement.map((i) => i.url)).toEqual(orderedGuides().map((a) => `https://cheki.et/guides/${a.slug}`));
    expect(ld.itemListElement.map((i) => i.position)).toEqual(articles.map((_, i) => i + 1));
  });
});

describe("jsonLdScript", () => {
  it("escapes < so data can't close the script element", () => {
    const out = jsonLdScript({ name: "</script><script>alert(1)</script>" });
    expect(out).not.toContain("<");
    expect(JSON.parse(out).name).toBe("</script><script>alert(1)</script>");
  });
});

describe("metadata", () => {
  it("keeps the canonicals and adds the OG image and modified time", () => {
    expect(indexMetadata.alternates?.canonical).toBe("/guides");
    const a = getArticle("free-receipt-verification-no-api-key")!;
    const m = guideMetadata(a);
    expect(m.alternates?.canonical).toBe(`/guides/${a.slug}`);
    const og = m.openGraph as { modifiedTime?: string; publishedTime?: string; images?: { url: string }[] };
    expect(og.publishedTime).toBe(a.date);
    expect(og.modifiedTime).toBe(a.updated);
    expect(og.images?.[0].url).toBe(GUIDE_IMAGE);
  });
});

describe("sitemap", () => {
  const entries = sitemap();

  it("uses each article's updated date as lastmod", () => {
    for (const a of articles) {
      const e = entries.find((x) => x.url === `https://cheki.et/guides/${a.slug}`);
      expect(e, a.slug).toBeDefined();
      expect(new Date(e!.lastModified!).toISOString().slice(0, 10), a.slug).toBe(a.updated);
    }
  });

  it("dates the index by its newest guide", () => {
    const index = entries.find((x) => x.url === "https://cheki.et/guides")!;
    const newest = articles.map((a) => a.updated).sort().at(-1);
    expect(new Date(index.lastModified!).toISOString().slice(0, 10)).toBe(newest);
  });
});
