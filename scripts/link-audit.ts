/**
 * Internal-link audit: every URL in the sitemap must be linked from the
 * <main> content of at least one other sitemap page with a plain <a href>
 * (nav and footer links do not count). Exits 1 and lists the orphans if not.
 *
 *   npm run link-audit                          # http://localhost:3000
 *   npm run link-audit -- https://cheki.et      # any base URL
 *   npm run link-audit -- --verbose             # also print each page's inbound count
 *
 * The sitemap's <loc>s point at https://cheki.et; their paths are fetched from
 * the given base, so it also runs against `next start` in CI. Read-only.
 */
import { normalizePath, parseSitemapLocs } from "./lib/sitemap";
import { extractMainLinks, findOrphans, inboundLinks } from "./lib/link-graph";

const TIMEOUT_MS = 30_000;
const UA = "cheki-link-audit/1 (+https://github.com/1RB/cheki)";
const CANONICAL_HOST = "cheki.et";

async function text(url: string): Promise<string> {
  const r = await fetch(url, { headers: { "User-Agent": UA }, signal: AbortSignal.timeout(TIMEOUT_MS) });
  if (!r.ok) throw new Error(`GET ${url} → ${r.status}`);
  return r.text();
}

async function main(): Promise<void> {
  const args = process.argv.slice(2);
  const verbose = args.includes("--verbose");
  const base = new URL(args.find((a) => /^https?:\/\//i.test(a)) ?? process.env.LINK_AUDIT_BASE_URL ?? "http://localhost:3000").origin;
  const hosts = [...new Set([CANONICAL_HOST, new URL(base).host])];

  const paths = parseSitemapLocs(await text(`${base}/sitemap.xml`)).map((loc) => normalizePath(new URL(loc).pathname));
  if (paths.length === 0) throw new Error("sitemap has no URLs");

  const outbound = new Map<string, string[]>();
  for (const path of paths) {
    const url = `${base}${path}`;
    outbound.set(path, extractMainLinks(await text(url), url, hosts));
  }

  if (verbose) {
    for (const [p, from] of inboundLinks(outbound, paths)) console.log(`${String(from.length).padStart(3)}  ${p}`);
  }

  const orphans = findOrphans(outbound, paths);
  if (orphans.length > 0) {
    console.error(`✗ ${orphans.length} of ${paths.length} sitemap pages have no in-content link from another page:`);
    for (const p of orphans) console.error(`  ${p}`);
    process.exitCode = 1;
    return;
  }
  console.log(`✓ all ${paths.length} sitemap pages have an in-content link from another page`);
}

main().catch((err: unknown) => {
  console.error(err instanceof Error ? err.message : err);
  process.exitCode = 1;
});
