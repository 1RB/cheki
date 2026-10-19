/**
 * Third-party credit stays modest: the links.et provider list, which most
 * "inferred" formats come from, is acknowledged once, in the /endpoints
 * intro. Evidence strings, guides, docs and code say "another verifier"
 * instead. The manifest may keep the list's URL as an endpointHistory
 * `source` (data, not rendered).
 */
import { describe, it, expect } from "vitest";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join, relative } from "node:path";
import { THIRD_PARTY_PROVIDER_LIST } from "@/lib/manifest/endpoints";

const ROOT = join(__dirname, "..", "..");
const SKIP = new Set(["node_modules", ".next", ".git", "vendor", "build", "dist", ".dart_tool", "__pycache__", ".venv", "screenshots"]);
const TEXT = /\.(tsx?|jsx?|mjs|json|md|txt|py|go|php|dart|ya?ml)$/;

function walk(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    if (SKIP.has(name)) return [];
    const p = join(dir, name);
    if (statSync(p).isDirectory()) return walk(p);
    return TEXT.test(name) && name !== "package-lock.json" && name !== "CHANGELOG.md" ? [p] : [];
  });
}

describe("links.et credit", () => {
  it("is named once, on /endpoints, plus its URL in the manifest's history sources", () => {
    const hits: string[] = [];
    for (const file of walk(ROOT)) {
      const rel = relative(ROOT, file);
      if (rel === join("tests", "content", "credits.test.ts")) continue;
      readFileSync(file, "utf8").split("\n").forEach((line, i) => {
        if (!/links\.et/i.test(line)) return;
        if (rel === join("src", "lib", "manifest", "banks.json") && /^\s*"source": "https:\/\/links\.et\/docs\/providers"$/.test(line)) return;
        hits.push(`${rel}:${i + 1}`);
      });
    }
    expect(hits.map((h) => h.replace(/:\d+$/, ""))).toEqual([
      join("src", "app", "endpoints", "page.tsx"),
      join("src", "lib", "manifest", "endpoints.ts"),
    ]);
  });

  it("the /endpoints line links the provider list once", () => {
    const page = readFileSync(join(ROOT, "src/app/endpoints/page.tsx"), "utf8");
    expect(page.match(/THIRD_PARTY_PROVIDER_LIST/g)?.length).toBe(2); // import + the one link
    expect(THIRD_PARTY_PROVIDER_LIST).toBe("https://links.et/docs/providers");
  });
});
