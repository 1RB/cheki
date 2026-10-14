/**
 * What a Vercel Web Analytics event may say about the page it came from.
 *
 * Receipt references, receipt links (?trx=, ?id=), bank codes with account
 * digits: any of these can end up in a cheki.et address, typed or pasted by a
 * visitor or carried in a shared link. The event URL is the only page detail
 * Vercel records besides the route template, so it is reduced here to a known
 * page path and nothing else:
 *
 *   1. A/B share links keep their arm: "/" with ?v=a|b (the next.config
 *      rewrite) or /ab/a|b opened directly are reported as "/ab/{arm}".
 *   2. Every other URL loses its query string and #fragment.
 *   3. /api and /dashboard are never counted.
 *   4. A path that is not one of cheki's pages (a 404, or a reference typed
 *      into the address bar) is dropped, not collapsed: the analytics
 *      component also sends the route, which for an unmatched path is the raw
 *      path itself, so only dropping the event keeps it out.
 *
 * Pure and client-safe: the known paths come in as an argument (built on the
 * server by analyticsPaths() in ./paths).
 */
import { isOgArm } from "@/lib/og/ab";

const NEVER_COUNTED = ["/api", "/dashboard"];

function isUnder(path: string, prefix: string): boolean {
  return path === prefix || path.startsWith(`${prefix}/`);
}

/** The URL to report for a page view at `raw`, or null to send nothing. */
export function analyticsUrl(raw: string, knownPaths: ReadonlySet<string>): string | null {
  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    return null;
  }
  const path = url.pathname;
  if (NEVER_COUNTED.some((p) => isUnder(path, p))) return null;

  if (path === "/") {
    const v = url.searchParams.get("v");
    if (v !== null && isOgArm(v)) return `${url.origin}/ab/${v}`;
  }
  const arm = /^\/ab\/([^/]+)$/.exec(path)?.[1];
  if (arm !== undefined) return isOgArm(arm) ? `${url.origin}/ab/${arm}` : null;

  return knownPaths.has(path) ? `${url.origin}${path}` : null;
}
