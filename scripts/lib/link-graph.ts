/**
 * Internal-link graph for scripts/link-audit.ts: does every sitemap page have
 * at least one in-content link from another indexable page?
 *
 * Only links inside <main> count. Nav and footer links reach every page, but
 * a page that is only reachable from site chrome gets little context from
 * them, so the audit asks for at least one link from page content.
 */
import { normalizePath } from "./sitemap";

const ENTITIES: Record<string, string> = { amp: "&", lt: "<", gt: ">", quot: '"', "#39": "'", "#x27": "'" };

function decodeAttr(s: string): string {
  return s.replace(/&(amp|lt|gt|quot|#39|#x27);/g, (_, e: string) => ENTITIES[e]);
}

/** The first <main>…</main> of a page, or "" when there is none. */
export function mainContent(html: string): string {
  const m = html.match(/<main\b[\s\S]*?<\/main>/i);
  return m ? m[0] : "";
}

/**
 * Normalized same-site paths that `html`'s <main> links to with a plain
 * <a href> (no rel=nofollow), excluding the page itself and fragment-only
 * links. `pageUrl` resolves relative hrefs; `hosts` are the hosts that count
 * as this site (cheki.et and the server the audit runs against).
 */
export function extractMainLinks(html: string, pageUrl: string, hosts: string[]): string[] {
  const self = normalizePath(new URL(pageUrl).pathname);
  const out = new Set<string>();
  for (const tag of mainContent(html).matchAll(/<a\b[^>]*>/gi)) {
    const attrs = tag[0];
    const href = attrs.match(/\shref\s*=\s*(?:"([^"]*)"|'([^']*)')/i);
    if (!href) continue;
    const rel = attrs.match(/\srel\s*=\s*(?:"([^"]*)"|'([^']*)')/i);
    if (rel && /\bnofollow\b/i.test(rel[1] ?? rel[2] ?? "")) continue;
    let u: URL;
    try {
      u = new URL(decodeAttr(href[1] ?? href[2] ?? ""), pageUrl);
    } catch {
      continue;
    }
    if (!/^https?:$/.test(u.protocol) || !hosts.includes(u.host)) continue;
    const path = normalizePath(u.pathname);
    if (path !== self) out.add(path);
  }
  return [...out].sort();
}

/**
 * Inbound in-content links per sitemap path, counting only links from other
 * sitemap (indexable) pages.
 */
export function inboundLinks(outbound: Map<string, string[]>, sitemapPaths: string[]): Map<string, string[]> {
  const inbound = new Map<string, Set<string>>(sitemapPaths.map((p) => [p, new Set<string>()]));
  for (const [from, links] of outbound) {
    if (!inbound.has(from)) continue;
    for (const to of links) if (to !== from) inbound.get(to)?.add(from);
  }
  return new Map([...inbound].map(([p, s]) => [p, [...s].sort()]));
}

/** Sitemap paths with no in-content link from any other sitemap page. */
export function findOrphans(outbound: Map<string, string[]>, sitemapPaths: string[]): string[] {
  return [...inboundLinks(outbound, sitemapPaths)].filter(([, from]) => from.length === 0).map(([p]) => p);
}
