/**
 * IndexNow (https://www.indexnow.org/documentation): tells Bing and the other
 * participating engines (they share submissions) which URLs changed, so they
 * recrawl without waiting for the sitemap. Google does not take part.
 *
 * Ownership is proven by a key file at the site root: public/{key}.txt holds
 * the key and is served at https://cheki.et/{key}.txt. The file has to be
 * publicly served for the engines to read it, so the key is not a credential;
 * it only shows the submitter controls the host. Keep INDEXNOW_KEY and the
 * file name and content in step (tests/seo/indexnow.test.ts checks this).
 */

export const INDEXNOW_KEY = "96179dcf70b667c0549d101eb8e06f0e";
export const INDEXNOW_ENDPOINT = "https://api.indexnow.org/indexnow";
/** The protocol's per-request limit. */
export const INDEXNOW_MAX_URLS = 10_000;

export interface IndexNowPayload {
  host: string;
  key: string;
  keyLocation: string;
  urlList: string[];
}

/**
 * The POST body for a sitemap's URLs. Only absolute http(s) URLs on `origin`'s
 * host are kept (IndexNow rejects URLs from another host with 422),
 * de-duplicated, in sitemap order. Throws if nothing is left or the list is
 * over the protocol limit, rather than silently sending a partial batch.
 */
export function buildIndexNowPayload(locs: string[], origin: string, key: string = INDEXNOW_KEY): IndexNowPayload {
  // Protocol: 8-128 characters of a-z, A-Z, 0-9 and "-".
  if (!/^[a-zA-Z0-9-]{8,128}$/.test(key)) throw new Error(`invalid IndexNow key: ${key}`);
  const site = new URL(origin);
  const urls = new Set<string>();
  for (const loc of locs) {
    let u: URL;
    try {
      u = new URL(loc);
    } catch {
      continue;
    }
    if ((u.protocol === "https:" || u.protocol === "http:") && u.host === site.host) urls.add(u.href);
  }
  const urlList = [...urls];
  if (urlList.length === 0) {
    throw new Error(`no ${site.host} URLs in the sitemap (its <loc>s name the production host; pass that origin)`);
  }
  if (urlList.length > INDEXNOW_MAX_URLS) {
    throw new Error(`${urlList.length} URLs is over the IndexNow limit of ${INDEXNOW_MAX_URLS} per request`);
  }
  return {
    host: site.host,
    key,
    keyLocation: `${site.origin}/${key}.txt`,
    urlList,
  };
}

/** What an IndexNow response status means (per the protocol documentation). */
export function describeIndexNowStatus(status: number): { ok: boolean; message: string } {
  switch (status) {
    case 200:
      return { ok: true, message: "200 OK: URLs submitted" };
    case 202:
      return { ok: true, message: "202 Accepted: URLs received, key validation pending" };
    case 400:
      return { ok: false, message: "400 Bad request: invalid format" };
    case 403:
      return { ok: false, message: "403 Forbidden: key not valid (key file missing, or the key is not in it)" };
    case 422:
      return { ok: false, message: "422 Unprocessable: URLs do not belong to the host, or the key does not match the schema" };
    case 429:
      return { ok: false, message: "429 Too many requests (potential spam): submit less often and retry later" };
    default:
      return { ok: status >= 200 && status < 300, message: `HTTP ${status}` };
  }
}
