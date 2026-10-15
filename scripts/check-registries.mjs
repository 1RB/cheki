#!/usr/bin/env node
/**
 * Check that every registry serves the given SDK version (default: the
 * version in package.json). Exits 1 if any registry does not, after polling
 * (registries and their CDNs can take a few minutes after a publish).
 *
 *   node scripts/check-registries.mjs                 # package.json version
 *   node scripts/check-registries.mjs 1.5.0
 *   node scripts/check-registries.mjs 1.5.0 --once    # no polling
 *   EXPECT_SHA=<commit> node scripts/check-registries.mjs 1.5.0
 *
 * EXPECT_SHA (publish.yml passes the tag's commit) also checks that Packagist
 * and the Go proxy point at that commit. GH_PACKAGES_TOKEN (optional) adds
 * GitHub Packages (@1rb/cheki-verify), which needs a token to read.
 * Zero dependencies (Node 18+ fetch).
 */
import { readFileSync } from "node:fs";

const args = process.argv.slice(2);
const once = args.includes("--once");
const version = args.find((a) => /^\d+\.\d+\.\d+$/.test(a)) ?? JSON.parse(readFileSync("package.json", "utf8")).version;
const sha = (process.env.EXPECT_SHA ?? "").trim();
const ATTEMPTS = once ? 1 : Number(process.env.ATTEMPTS ?? 20);
const DELAY_MS = Number(process.env.DELAY_MS ?? 30_000);

async function getJson(url, headers = {}) {
  const res = await fetch(url, { headers: { accept: "application/json", "user-agent": "cheki-release-check", ...headers }, cache: "no-store" });
  if (!res.ok) throw new Error(`${url} answered ${res.status}`);
  return res.json();
}

/** Each check resolves to a short "ok" note or throws with what it saw. */
const checks = {
  "npm cheki-verify": async () => {
    const d = await getJson("https://registry.npmjs.org/cheki-verify");
    if (!d.versions?.[version]) throw new Error(`no ${version} (latest ${d["dist-tags"]?.latest})`);
    if (d["dist-tags"]?.latest !== version) throw new Error(`${version} exists but latest is ${d["dist-tags"]?.latest}`);
    return `latest ${version}`;
  },
  "PyPI cheki": async () => {
    const d = await getJson(`https://pypi.org/pypi/cheki/${version}/json`);
    const files = (d.urls ?? []).map((u) => u.packagetype);
    if (!files.includes("bdist_wheel") || !files.includes("sdist")) throw new Error(`${version} has files ${files.join(",") || "none"}`);
    const latest = (await getJson("https://pypi.org/pypi/cheki/json")).info?.version;
    if (latest !== version) throw new Error(`${version} exists but latest is ${latest}`);
    return `latest ${version} (wheel + sdist)`;
  },
  "Packagist cheki/cheki": async () => {
    const d = await getJson("https://repo.packagist.org/p2/cheki/cheki.json");
    const entry = (d.packages?.["cheki/cheki"] ?? []).find((p) => p.version_normalized === `${version}.0`);
    if (!entry) throw new Error(`no ${version} (newest ${d.packages?.["cheki/cheki"]?.[0]?.version})`);
    const ref = entry.source?.reference ?? entry.dist?.reference ?? "";
    if (sha && ref !== sha) throw new Error(`${entry.version} points at ${ref}, expected ${sha}`);
    return `${entry.version} @ ${ref.slice(0, 7)}`;
  },
  "pub.dev cheki": async () => {
    const d = await getJson("https://pub.dev/api/packages/cheki");
    if (!(d.versions ?? []).some((v) => v.version === version)) throw new Error(`no ${version} (latest ${d.latest?.version})`);
    if (d.latest?.version !== version) throw new Error(`${version} exists but latest is ${d.latest?.version}`);
    return `latest ${version}`;
  },
  "Go proxy sdks/go": async () => {
    // Module path github.com/1RB/cheki/sdks/go, case-encoded for the proxy.
    const d = await getJson(`https://proxy.golang.org/github.com/1%21r%21b/cheki/sdks/go/@v/v${version}.info`);
    const hash = d.Origin?.Hash ?? "";
    if (sha && hash && hash !== sha) throw new Error(`v${version} is commit ${hash}, expected ${sha}`);
    return `v${version} @ ${hash.slice(0, 7) || "?"}`;
  },
};

if (process.env.GH_PACKAGES_TOKEN) {
  checks["GitHub Packages @1rb/cheki-verify"] = async () => {
    const d = await getJson("https://npm.pkg.github.com/@1rb%2fcheki-verify", { authorization: `Bearer ${process.env.GH_PACKAGES_TOKEN}` });
    if (!d.versions?.[version]) throw new Error(`no ${version}`);
    return version;
  };
}

const pending = new Map(Object.entries(checks));
const results = new Map();
for (let attempt = 1; attempt <= ATTEMPTS && pending.size > 0; attempt++) {
  if (attempt > 1) await new Promise((r) => setTimeout(r, DELAY_MS));
  await Promise.all(
    [...pending].map(async ([name, fn]) => {
      try {
        results.set(name, { ok: true, note: await fn() });
        pending.delete(name);
      } catch (e) {
        results.set(name, { ok: false, note: e instanceof Error ? e.message : String(e) });
      }
    }),
  );
  if (pending.size > 0 && attempt < ATTEMPTS) {
    console.log(`attempt ${attempt}/${ATTEMPTS}: waiting for ${[...pending.keys()].join(", ")}`);
  }
}

console.log(`\nRegistries for ${version}${sha ? ` (commit ${sha.slice(0, 7)})` : ""}:`);
for (const [name, r] of results) console.log(`${r.ok ? "✅" : "❌"} ${name}: ${r.note}`);
if (process.env.GITHUB_STEP_SUMMARY) {
  const { appendFileSync } = await import("node:fs");
  appendFileSync(
    process.env.GITHUB_STEP_SUMMARY,
    `### Registries for ${version}\n\n| Registry | Result |\n|---|---|\n` +
      [...results].map(([n, r]) => `| ${n} | ${r.ok ? "✅" : "❌"} ${r.note} |`).join("\n") +
      "\n",
  );
}
process.exit([...results.values()].every((r) => r.ok) ? 0 : 1);
