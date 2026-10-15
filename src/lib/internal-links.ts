import { getBank } from "./banks";

/**
 * Non-guide pages a guide can point to in its "Continue reading" list
 * (Article.relatedPages). Only indexable, sitemap-listed pages: live bank
 * pages and the hubs below. Titles follow each page's own H1 so the link text
 * matches what the reader lands on.
 */
export interface InternalPageLink {
  href: string;
  title: string;
  excerpt: string;
}

const HUB_PAGES: Record<string, Omit<InternalPageLink, "href">> = {
  "/banks": {
    title: "Supported banks and wallets",
    excerpt: "Every live bank and wallet cheki checks, and what you need from each receipt.",
  },
  "/compare": {
    title: "How the services compare",
    excerpt: "cheki, check.et, verify.et and others side by side: price, banks, API and openness.",
  },
  "/developers": {
    title: "Developer guide",
    excerpt: "Verify a payment with one POST: SDKs for TypeScript, Python, Go, PHP and Dart, a CLI and Docker.",
  },
  "/docs": {
    title: "API documentation",
    excerpt: "Single and batch verification, the bank list and health check. No API key.",
  },
  "/endpoints": {
    title: "Bank receipt endpoints",
    excerpt: "The public receipt endpoint each bank serves, its reference format and its error shapes.",
  },
};

/** The link for an internal page path, or undefined if it is not a linkable page. */
export function internalPageLink(href: string): InternalPageLink | undefined {
  const hub = HUB_PAGES[href];
  if (hub) return { href, ...hub };
  const m = href.match(/^\/banks\/([a-z0-9-]+)$/);
  if (!m) return undefined;
  const bank = getBank(m[1]);
  // Pages for banks still in development are noindexed; never link them as related reading.
  if (!bank || bank.status !== "live") return undefined;
  return { href, title: `${bank.shortName} receipt check`, excerpt: bank.seo.description };
}

export const INTERNAL_HUB_PATHS = Object.keys(HUB_PAGES);
