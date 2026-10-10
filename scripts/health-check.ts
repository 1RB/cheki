/**
 * Daily endpoint health check.
 *
 *   npm run health-check                 # writes public/status.json
 *   npm run health-check -- --dry-run    # prints, writes nothing
 *   npm run health-check -- --strict     # exit 1 if a live bank is degraded
 *
 * Each bank gets a known-fake reference; the expected error shape lives in
 * src/lib/manifest/endpoints.ts. Geo-restricted endpoints (Telebirr, M-Pesa)
 * are marked "not-checked" unless CHEKI_CHECK_GEO=1 (set it only on a runner
 * with an Ethiopian IP).
 */
import { writeFileSync } from "node:fs";
import { resolve } from "node:path";
import https from "node:https";
import http from "node:http";
import { buildProbeTargets, evaluate, isoNow, type ObservedResponse, type StatusFile } from "../src/lib/health";

const TIMEOUT_MS = 20000;
const MAX_BODY = 64 * 1024;
const UA = "Mozilla/5.0 (compatible; cheki-health-check; +https://cheki.et/status)";

function request(url: string, headers: Record<string, string> = {}): Promise<ObservedResponse> {
  return new Promise((resolvePromise, reject) => {
    const u = new URL(url);
    const lib = u.protocol === "http:" ? http : https;
    const req = lib.request(
      {
        hostname: u.hostname,
        port: u.port || (u.protocol === "http:" ? 80 : 443),
        path: u.pathname + u.search,
        method: "GET",
        headers: { "User-Agent": UA, Accept: "*/*", ...headers },
        // Several bank endpoints (CBE port 100, Awash 8225) serve certificates
        // that do not verify. The probe only sends fake references.
        rejectUnauthorized: false,
      },
      (res) => {
        const chunks: Buffer[] = [];
        let size = 0;
        res.on("data", (c: Buffer) => {
          if (size < MAX_BODY) chunks.push(c);
          size += c.length;
        });
        res.on("end", () =>
          resolvePromise({
            status: res.statusCode ?? 0,
            contentType: String(res.headers["content-type"] ?? ""),
            body: Buffer.concat(chunks).toString("utf8"),
          }),
        );
      },
    );
    req.on("error", reject);
    req.setTimeout(TIMEOUT_MS, () => req.destroy(new Error(`timeout after ${TIMEOUT_MS / 1000}s`)));
    req.end();
  });
}

async function probe(url: string, headers?: Record<string, string>): Promise<{ response?: ObservedResponse; error?: string }> {
  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      return { response: await request(url, headers) };
    } catch (e) {
      if (attempt === 1) return { error: e instanceof Error ? e.message : String(e) };
      await new Promise((r) => setTimeout(r, 2000));
    }
  }
  return { error: "unreachable" };
}

async function main() {
  const args = process.argv.slice(2);
  const dryRun = args.includes("--dry-run");
  const strict = args.includes("--strict");
  const checkGeo = process.env.CHEKI_CHECK_GEO === "1";
  const runner = process.env.CHEKI_RUNNER || (process.env.GITHUB_ACTIONS ? "GitHub Actions (ubuntu-latest)" : "local");

  const targets = buildProbeTargets({ checkGeoRestricted: checkGeo });
  const results = await Promise.all(
    targets.map(async (t) => {
      const outcome = t.url ? await probe(t.url, t.headers) : {};
      return evaluate(t, outcome, isoNow());
    }),
  );

  const file: StatusFile = {
    generatedAt: isoNow(),
    runner,
    checkedGeoRestricted: checkGeo,
    banks: results,
  };

  for (const r of results) {
    console.log(`${r.status.padEnd(15)} ${r.id.padEnd(10)} ${r.observed ?? ""}  ${r.status === "degraded" ? r.detail : ""}`);
  }

  if (!dryRun) {
    const out = resolve(__dirname, "../public/status.json");
    writeFileSync(out, JSON.stringify(file, null, 2) + "\n");
    console.log(`\nWrote ${out}`);
  }

  const degradedLive = results.filter((r) => r.status === "degraded" && r.manifestStatus === "live");
  if (degradedLive.length > 0) {
    console.log(`\n::warning::Degraded live endpoints: ${degradedLive.map((r) => r.id).join(", ")}`);
    if (strict) process.exit(1);
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
