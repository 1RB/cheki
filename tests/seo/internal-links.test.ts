/**
 * Internal links. The rendered check (every sitemap page has an in-content
 * inbound link) is scripts/link-audit.ts, which CI runs against `next start`.
 * Here: the audit's parsing and graph logic, and the guide link data it
 * depends on.
 */
import { describe, expect, it } from "vitest";
import { readFileSync } from "fs";
import path from "path";
import { extractMainLinks, findOrphans, inboundLinks, mainContent } from "../../scripts/lib/link-graph";
import sitemap from "@/app/sitemap";
import { articles, getRelatedArticles, getRelatedPages } from "@/lib/guides";
import { INTERNAL_HUB_PATHS, internalPageLink } from "@/lib/internal-links";
import { banks } from "@/lib/banks";

const root = path.resolve(__dirname, "../..");
const sitemapPaths = new Set(sitemap().map((e) => new URL(e.url).pathname.replace(/\/$/, "") || "/"));
const HOSTS = ["cheki.et", "localhost:3000"];

describe("extractMainLinks", () => {
  const html = `<html><body>
    <nav><a href="/compare">Compare</a></nav>
    <main class="x">
      <a href="/banks/cbe">CBE</a>
      <a class="row" href='/guides/x/'>X</a>
      <a href="https://cheki.et/docs#auth">Docs</a>
      <a href="http://localhost:3000/developers">Dev</a>
      <a href="#top">Top</a>
      <a href="/guides/self">Self</a>
      <a href="https://github.com/1RB/cheki">GitHub</a>
      <a href="/status" rel="nofollow noopener">Status</a>
      <a href="mailto:x@example.com">Mail</a>
      <a name="anchor">No href</a>
      <a href="/a?x=1&amp;y=2">Query</a>
    </main>
    <footer><a href="/endpoints">Endpoints</a></footer>
  </body></html>`;

  it("keeps same-site <main> links only, normalized, without self, fragments, nofollow or other hosts", () => {
    expect(extractMainLinks(html, "https://cheki.et/guides/self", HOSTS)).toEqual([
      "/a",
      "/banks/cbe",
      "/developers",
      "/docs",
      "/guides/x",
    ]);
  });

  it("ignores pages without <main>", () => {
    expect(mainContent("<div><a href='/x'>x</a></div>")).toBe("");
    expect(extractMainLinks("<div><a href='/x'>x</a></div>", "https://cheki.et/", HOSTS)).toEqual([]);
  });
});

describe("findOrphans", () => {
  it("flags sitemap pages no other sitemap page links to; links from non-sitemap pages do not count", () => {
    const outbound = new Map([
      ["/", ["/a", "/"]],
      ["/a", ["/"]],
      ["/noindexed", ["/b"]],
      ["/c", ["/c"]],
    ]);
    const paths = ["/", "/a", "/b", "/c"];
    expect(findOrphans(outbound, paths)).toEqual(["/b", "/c"]);
    expect(inboundLinks(outbound, paths).get("/")).toEqual(["/a"]);
  });
});

describe("guide link data", () => {
  it("every related guide slug exists and is not the guide itself", () => {
    const slugs = new Set(articles.map((a) => a.slug));
    for (const a of articles) {
      for (const s of a.related ?? []) {
        expect(slugs.has(s), `${a.slug} → ${s}`).toBe(true);
        expect(s).not.toBe(a.slug);
      }
    }
  });

  it("every relatedPages entry resolves to an indexable sitemap page and is shown", () => {
    for (const a of articles) {
      const pages = a.relatedPages ?? [];
      expect(getRelatedPages(a.slug).map((l) => l.href), a.slug).toEqual(pages);
      for (const href of pages) {
        expect(internalPageLink(href), `${a.slug} → ${href}`).toBeDefined();
        expect(sitemapPaths.has(href), `${a.slug} → ${href} not in sitemap`).toBe(true);
      }
    }
  });

  it("hub links and live bank pages resolve; dev banks and unknown paths do not", () => {
    for (const hub of INTERNAL_HUB_PATHS) expect(sitemapPaths.has(hub), hub).toBe(true);
    for (const b of banks) {
      const link = internalPageLink(`/banks/${b.code}`);
      if (b.status === "live") expect(link?.title).toBe(`${b.shortName} receipt check`);
      else expect(link).toBeUndefined();
    }
    expect(internalPageLink("/nope")).toBeUndefined();
    expect(internalPageLink("/guides/cbe-receipt-qr-code")).toBeUndefined();
  });

  it("every guide is in another guide's related list (no guide reachable only from the /guides hub)", () => {
    const linked = new Set(articles.flatMap((a) => getRelatedArticles(a.slug).map((r) => r.slug)));
    for (const a of articles) expect(linked.has(a.slug), a.slug).toBe(true);
  });

  it("bank guides link their bank page", () => {
    for (const a of articles.filter((g) => g.bankCode)) {
      expect(getRelatedPages(a.slug).map((l) => l.href), a.slug).toContain(`/banks/${a.bankCode}`);
    }
  });

  it("npm run link-audit exists and CI runs it against the local build", () => {
    const pkg = JSON.parse(readFileSync(path.join(root, "package.json"), "utf8"));
    expect(pkg.scripts["link-audit"]).toBe("tsx scripts/link-audit.ts");
    expect(readFileSync(path.join(root, ".github/workflows/ci.yml"), "utf8")).toContain("npm run link-audit -- http://localhost:3000");
  });

  it("the guide page renders the related pages as plain links", () => {
    const page = readFileSync(path.join(root, "src/app/guides/[slug]/page.tsx"), "utf8");
    expect(page).toContain("getRelatedPages(slug)");
    expect(page).toMatch(/<Link href=\{p\.href\}/);
  });
});
