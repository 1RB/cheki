/**
 * Minimal sitemap.xml reader shared by scripts/indexnow.ts and
 * scripts/link-audit.ts. The sitemap is our own (src/app/sitemap.ts), so a
 * <loc> scan is enough; no XML parser dependency.
 */

const XML_ENTITIES: Record<string, string> = { amp: "&", lt: "<", gt: ">", quot: '"', apos: "'" };

function decodeXml(s: string): string {
  return s.replace(/&(amp|lt|gt|quot|apos);/g, (_, e: string) => XML_ENTITIES[e]);
}

/** Every <loc> in a sitemap (or sitemap index), in document order, de-duplicated. */
export function parseSitemapLocs(xml: string): string[] {
  const seen = new Set<string>();
  for (const m of xml.matchAll(/<loc>\s*([^<]+?)\s*<\/loc>/gi)) {
    seen.add(decodeXml(m[1]));
  }
  return [...seen];
}

/** "/" for the root, otherwise the pathname without a trailing slash. */
export function normalizePath(pathname: string): string {
  const p = pathname.replace(/\/+$/, "");
  return p === "" ? "/" : p;
}
