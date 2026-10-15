import { describe, expect, it } from "vitest";
import { existsSync, readFileSync } from "fs";
import path from "path";
import { INDEXNOW_KEY, INDEXNOW_MAX_URLS, buildIndexNowPayload, describeIndexNowStatus } from "../../scripts/lib/indexnow";
import { normalizePath, parseSitemapLocs } from "../../scripts/lib/sitemap";
import sitemap from "@/app/sitemap";

const root = path.resolve(__dirname, "../..");

describe("IndexNow key file", () => {
  it("public/{key}.txt exists and holds exactly the key", () => {
    const file = path.join(root, "public", `${INDEXNOW_KEY}.txt`);
    expect(existsSync(file)).toBe(true);
    expect(readFileSync(file, "utf8")).toBe(INDEXNOW_KEY);
  });

  it("the key fits the protocol (8-128 of a-z, A-Z, 0-9, -)", () => {
    expect(INDEXNOW_KEY).toMatch(/^[a-zA-Z0-9-]{8,128}$/);
  });
});

describe("parseSitemapLocs", () => {
  it("reads every <loc>, trims, decodes entities and de-duplicates", () => {
    const xml = `<?xml version="1.0"?><urlset>
      <url><loc>https://cheki.et/</loc></url>
      <url><loc> https://cheki.et/banks/cbe </loc></url>
      <url><loc>https://cheki.et/a?x=1&amp;y=2</loc></url>
      <url><loc>https://cheki.et/</loc></url>
    </urlset>`;
    expect(parseSitemapLocs(xml)).toEqual(["https://cheki.et/", "https://cheki.et/banks/cbe", "https://cheki.et/a?x=1&y=2"]);
  });

  it("normalizePath drops trailing slashes but keeps the root", () => {
    expect(normalizePath("/")).toBe("/");
    expect(normalizePath("")).toBe("/");
    expect(normalizePath("/guides/")).toBe("/guides");
  });
});

describe("buildIndexNowPayload", () => {
  it("builds host, key, keyLocation and the URL list for the site's own sitemap", () => {
    const locs = sitemap().map((e) => e.url);
    const p = buildIndexNowPayload(locs, "https://cheki.et");
    expect(p.host).toBe("cheki.et");
    expect(p.key).toBe(INDEXNOW_KEY);
    expect(p.keyLocation).toBe(`https://cheki.et/${INDEXNOW_KEY}.txt`);
    expect(p.urlList).toEqual(locs);
    expect(p.urlList.length).toBeGreaterThan(0);
  });

  it("keeps only same-host http(s) URLs, once each, in order", () => {
    const p = buildIndexNowPayload(
      ["https://cheki.et/b", "https://evil.example/x", "not a url", "ftp://cheki.et/f", "https://cheki.et/b", "https://cheki.et/a"],
      "https://cheki.et/ignored/path",
    );
    expect(p.urlList).toEqual(["https://cheki.et/b", "https://cheki.et/a"]);
  });

  it("refuses an empty list, an oversize list and a malformed key", () => {
    expect(() => buildIndexNowPayload(["https://other.example/"], "https://cheki.et")).toThrow(/no cheki.et URLs/);
    const many = Array.from({ length: INDEXNOW_MAX_URLS + 1 }, (_, i) => `https://cheki.et/p${i}`);
    expect(() => buildIndexNowPayload(many, "https://cheki.et")).toThrow(/limit/);
    expect(() => buildIndexNowPayload(["https://cheki.et/"], "https://cheki.et", "short")).toThrow(/invalid/);
    expect(() => buildIndexNowPayload(["https://cheki.et/"], "https://cheki.et", "bad key with spaces")).toThrow(/invalid/);
  });
});

describe("describeIndexNowStatus", () => {
  it("treats 200 and 202 as success and the protocol's error codes as failures", () => {
    expect(describeIndexNowStatus(200).ok).toBe(true);
    expect(describeIndexNowStatus(202).ok).toBe(true);
    for (const s of [400, 403, 422, 429, 500]) expect(describeIndexNowStatus(s).ok).toBe(false);
  });
});

describe("wiring", () => {
  it("npm run indexnow exists and RELEASING.md documents it as a post-deploy step", () => {
    const pkg = JSON.parse(readFileSync(path.join(root, "package.json"), "utf8"));
    expect(pkg.scripts.indexnow).toBe("tsx scripts/indexnow.ts");
    const releasing = readFileSync(path.join(root, "docs/RELEASING.md"), "utf8");
    expect(releasing).toMatch(/## After a deploy: ping IndexNow/);
    expect(releasing).toContain("npm run indexnow");
  });
});
