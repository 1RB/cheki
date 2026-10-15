/**
 * Submit every sitemap URL to IndexNow. A post-deploy step: run it only after
 * the deploy that changed pages is live on production (docs/RELEASING.md).
 *
 *   npm run indexnow -- --dry-run         # print the payload, send nothing
 *   npm run indexnow                      # https://cheki.et
 *   npm run indexnow -- https://cheki.et  # explicit origin
 *
 * Before posting it checks that {origin}/{key}.txt is live and holds the key;
 * if not (e.g. the key file is not deployed yet) it stops instead of earning a
 * 403. Exits 1 on any failure.
 */
import { parseSitemapLocs } from "./lib/sitemap";
import { INDEXNOW_ENDPOINT, INDEXNOW_KEY, buildIndexNowPayload, describeIndexNowStatus } from "./lib/indexnow";

const TIMEOUT_MS = 30_000;
const UA = "cheki-indexnow/1 (+https://github.com/1RB/cheki)";

async function get(url: string): Promise<Response> {
  return fetch(url, { headers: { "User-Agent": UA }, signal: AbortSignal.timeout(TIMEOUT_MS) });
}

async function main(): Promise<void> {
  const args = process.argv.slice(2);
  const dryRun = args.includes("--dry-run");
  const origin = new URL(args.find((a) => /^https?:\/\//i.test(a)) ?? "https://cheki.et").origin;

  const sm = await get(`${origin}/sitemap.xml`);
  if (!sm.ok) throw new Error(`GET ${origin}/sitemap.xml → ${sm.status}`);
  const payload = buildIndexNowPayload(parseSitemapLocs(await sm.text()), origin);
  console.log(`${payload.urlList.length} URLs from ${origin}/sitemap.xml`);

  if (dryRun) {
    console.log(JSON.stringify(payload, null, 2));
    return;
  }

  const keyFile = await get(payload.keyLocation);
  const keyBody = keyFile.ok ? (await keyFile.text()).trim() : "";
  if (keyBody !== INDEXNOW_KEY) {
    throw new Error(`${payload.keyLocation} → ${keyFile.status}, body does not match the key. Deploy public/${INDEXNOW_KEY}.txt first.`);
  }

  const r = await fetch(INDEXNOW_ENDPOINT, {
    method: "POST",
    headers: { "Content-Type": "application/json; charset=utf-8", "User-Agent": UA },
    body: JSON.stringify(payload),
    signal: AbortSignal.timeout(TIMEOUT_MS),
  });
  const { ok, message } = describeIndexNowStatus(r.status);
  const detail = ok ? "" : (await r.text().catch(() => "")).slice(0, 500);
  console.log(`${INDEXNOW_ENDPOINT}: ${message}${detail ? `\n${detail}` : ""}`);
  if (!ok) process.exitCode = 1;
}

main().catch((err: unknown) => {
  console.error(err instanceof Error ? err.message : err);
  process.exitCode = 1;
});
