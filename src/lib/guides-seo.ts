/**
 * Structured data for /guides and /guides/[slug]. Pure builders so the shapes
 * are unit-tested rather than eyeballed in page source.
 */
import type { Metadata } from "next";
import type { Article } from "./guides";
import { orderedGuides } from "./guides-index";
import { MAINTAINER_PERSON, PUBLISHER, SITE } from "./site-schema";

export { SITE };

/** The site-wide Open Graph image route (src/app/opengraph-image.tsx). */
export const GUIDE_IMAGE = `${SITE}/opengraph-image`;

export const guideUrl = (slug: string) => `${SITE}/guides/${slug}`;


/** ItemList of every guide in index order. */
export function guidesItemListJsonLd(list: readonly Article[] = orderedGuides()) {
  return {
    "@context": "https://schema.org",
    "@type": "ItemList",
    name: "cheki guides",
    url: `${SITE}/guides`,
    numberOfItems: list.length,
    itemListElement: list.map((a, i) => ({
      "@type": "ListItem",
      position: i + 1,
      url: guideUrl(a.slug),
      name: a.title,
    })),
  };
}

export function guideArticleJsonLd(a: Article) {
  return {
    "@context": "https://schema.org",
    "@type": "Article",
    headline: a.title,
    description: a.description,
    image: [GUIDE_IMAGE],
    datePublished: a.date,
    dateModified: a.updated,
    mainEntityOfPage: { "@type": "WebPage", "@id": guideUrl(a.slug) },
    url: guideUrl(a.slug),
    // The maintainer writes and reviews the guides; dateModified is the
    // review date shown as "Updated" on the page.
    author: MAINTAINER_PERSON,
    publisher: PUBLISHER,
  };
}

/**
 * JSON for a <script type="application/ld+json">. "<" is escaped so no string
 * in the data (a title, an FAQ answer) can close the script element early.
 */
export function jsonLdScript(data: unknown): string {
  return JSON.stringify(data).replace(/</g, "\\u003c");
}

/** Page metadata for one guide: canonical, Open Graph (with image and modified time), Twitter. */
export function guideMetadata(a: Article): Metadata {
  return {
    title: a.seo.title,
    description: a.seo.description,
    keywords: a.seo.keywords,
    alternates: { canonical: `/guides/${a.slug}` },
    openGraph: {
      title: a.seo.title,
      description: a.seo.description,
      type: "article",
      publishedTime: a.date,
      modifiedTime: a.updated,
      url: guideUrl(a.slug),
      images: [{ url: GUIDE_IMAGE, width: 1200, height: 630, alt: a.title }],
    },
    twitter: {
      card: "summary_large_image",
      title: a.seo.title,
      description: a.seo.description,
    },
  };
}
