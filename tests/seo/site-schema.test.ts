/**
 * Site-wide structured data (src/lib/site-schema.ts): the brand entity Google
 * should resolve "cheki.et" to, its raster logo, and the maintainer byline.
 */
import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { getArticle, articles } from "@/lib/guides";
import { guideArticleJsonLd } from "@/lib/guides-seo";
import {
  LOGO,
  MAINTAINER_PERSON,
  ORGANIZATION_ID,
  PUBLISHER,
  SAME_AS,
  organizationJsonLd,
  sourceCodeJsonLd,
  websiteJsonLd,
} from "@/lib/site-schema";

const ROOT = join(__dirname, "..", "..");

/** Width and height from a PNG's IHDR chunk. */
function pngSize(path: string): { w: number; h: number } {
  const b = readFileSync(path);
  expect(b.subarray(1, 4).toString("latin1")).toBe("PNG");
  return { w: b.readUInt32BE(16), h: b.readUInt32BE(20) };
}

describe("Organization", () => {
  it("is named cheki.et, with cheki as the alternate name", () => {
    expect(organizationJsonLd.name).toBe("cheki.et");
    expect(organizationJsonLd.alternateName).toEqual(["cheki"]);
    expect(organizationJsonLd["@id"]).toBe(ORGANIZATION_ID);
    expect(websiteJsonLd.name).toBe("cheki.et");
  });

  it("has a square raster logo of at least 112px that exists in public/", () => {
    expect(LOGO.url).toBe("https://cheki.et/logo.png");
    expect(organizationJsonLd.logo.url).toBe(LOGO.url);
    const { w, h } = pngSize(join(ROOT, "public/logo.png"));
    expect(w).toBe(h);
    expect(w).toBeGreaterThanOrEqual(112);
    expect({ w, h }).toEqual({ w: LOGO.width, h: LOGO.height });
  });

  it("lists only profiles the project owns, the repository first", () => {
    expect(SAME_AS[0]).toBe("https://github.com/1RB/cheki");
    for (const u of SAME_AS) expect(u).toMatch(/^https:\/\/(github\.com\/1RB\/cheki|www\.npmjs\.com\/package\/cheki-verify|pypi\.org\/project\/cheki\/|packagist\.org\/packages\/cheki\/cheki|pkg\.go\.dev\/github\.com\/1RB\/cheki\/)/);
  });

  it("declares the code MIT and open", () => {
    expect(sourceCodeJsonLd.codeRepository).toBe("https://github.com/1RB/cheki");
    expect(sourceCodeJsonLd.license).toBe("https://opensource.org/licenses/MIT");
  });
});

describe("maintainer byline", () => {
  it("is the Person Ray (alternateName 1RB) on GitHub, with no surname or photo", () => {
    expect(MAINTAINER_PERSON).toEqual({
      "@type": "Person",
      "@id": "https://cheki.et/#maintainer",
      name: "Ray",
      alternateName: "1RB",
      url: "https://github.com/1RB",
      sameAs: ["https://github.com/1RB"],
    });
  });

  it("the Organization's founder is that Person, and the code's author too", () => {
    expect(organizationJsonLd.founder).toBe(MAINTAINER_PERSON);
    expect(sourceCodeJsonLd.author).toBe(MAINTAINER_PERSON);
  });

  it("every guide's Article names Ray (1RB) as author, cheki.et as publisher, and carries its review date", () => {
    for (const a of articles) {
      const ld = guideArticleJsonLd(a);
      expect(ld.author, a.slug).toBe(MAINTAINER_PERSON);
      expect(ld.publisher, a.slug).toBe(PUBLISHER);
      expect(ld.publisher.logo.url).toBe(LOGO.url);
      expect(ld.dateModified, a.slug).toBe(a.updated);
    }
    expect(guideArticleJsonLd(getArticle("payment-fraud-ethiopia")!).dateModified).toBe("2026-10-21");
  });

  it("no JSON-LD in the app still credits a bare 'cheki' Organization", () => {
    for (const p of ["src/app/layout.tsx", "src/app/endpoints/page.tsx", "src/lib/guides-seo.ts"]) {
      const src = readFileSync(join(ROOT, p), "utf8");
      expect(src, p).not.toMatch(/"@type": "Organization", name: "cheki"/);
      expect(src, p).not.toMatch(/logo: `\$\{SITE_URL\}\/favicon\.ico`/);
    }
  });
});
