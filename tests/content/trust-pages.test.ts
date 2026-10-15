/**
 * /about, /privacy and /contact (src/lib/trust-pages.ts): every claim is held
 * to the code it describes, and the maintainer is only ever "Ray (@1RB)".
 */
import { describe, it, expect } from "vitest";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import { ABOUT, CONTACT, PRIVACY, TRUST_PAGES, trustPageLinks, trustPageText } from "@/lib/trust-pages";
import { RATE_LIMITS } from "@/lib/rate-limit-config";
import { DEFAULT_TTL_MS } from "@/lib/receipt-cache";
import { HISTORY_LIMIT } from "@/lib/verify/history";
import { analyticsUrl } from "@/lib/analytics/url";
import { translations } from "@/lib/i18n/translations";
import sitemap from "@/app/sitemap";

const ROOT = join(__dirname, "..", "..");
const read = (p: string) => readFileSync(join(ROOT, p), "utf8");
function walk(dir: string): string[] {
  return readdirSync(join(ROOT, dir)).flatMap((n) => {
    const p = join(dir, n);
    return statSync(join(ROOT, p)).isDirectory() ? walk(p) : /\.(ts|tsx)$/.test(n) ? [p] : [];
  });
}

describe("maintainer identity", () => {
  const all = TRUST_PAGES.map(trustPageText).join("\n");

  it("names the maintainer as Ray (@1RB) only: no surname, no email, no photo, no location", () => {
    // Every mention of Ray carries the handle, so no surname can follow it.
    expect(all).toMatch(/Ray \(@1RB/);
    expect(all).not.toMatch(/\bRay\b(?! \(@1RB)/);
    expect(all).not.toMatch(/Addis/);
    expect(all).not.toMatch(/[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[a-z]{2,}/);
    expect(read("src/components/TrustPageView.tsx")).not.toMatch(/<img|next\/image|"image"/);
    for (const p of TRUST_PAGES) {
      for (const l of trustPageLinks(p)) expect(l.href, p.path).not.toMatch(/^mailto:/);
    }
  });

  it("about's maintainer section is Ray in the first person, linked to the GitHub profile", () => {
    const who = ABOUT.sections.find((s) => s.id === "who-maintains-it")!;
    const first = who.paragraphs![0];
    expect(first[0]).toBe("I'm Ray (");
    expect(first[1]).toEqual({ href: "https://github.com/1RB", text: "@1RB on GitHub" });
    expect(String(first[2])).toMatch(/^\)\. I build and maintain cheki/);
  });

  it("contact names Ray (@1RB) as the one who answers", () => {
    expect(trustPageText(CONTACT)).toMatch(/The maintainer, Ray \(@1RB\), and contributors/);
    expect(trustPageLinks(CONTACT)).toContainEqual({ href: "https://github.com/1RB", text: "@1RB" });
  });

  it("about says what cheki is, that it is MIT and open source, and links the repo and the maintainer", () => {
    const t = trustPageText(ABOUT);
    expect(t).toMatch(/MIT licensed/);
    expect(t).toMatch(/open-source/);
    expect(t).toMatch(/not affiliated with/);
    const hrefs = trustPageLinks(ABOUT).map((l) => l.href);
    expect(hrefs).toContain("https://github.com/1RB/cheki");
    expect(hrefs).toContain("https://github.com/1RB");
  });

  it("about: green means bank-confirmed only", () => {
    const t = trustPageText(ABOUT);
    expect(t).toMatch(/A green result means one thing only: the bank confirmed the receipt/);
    expect(t).toMatch(/QR code, a screenshot or pasted receipt text is never enough on its own/);
  });
});

describe("privacy matches the code", () => {
  const t = trustPageText(PRIVACY);

  it("quotes the real rate limits and cache lifetime", () => {
    expect(t).toContain(`${RATE_LIMITS.verify.limit} checks a minute`);
    expect(t).toContain(`${RATE_LIMITS.batch.limit} batch requests a minute`);
    expect(t).toContain(`${RATE_LIMITS.contribute.limit} contributions every ${RATE_LIMITS.contribute.windowMs / 60_000} minutes`);
    expect(t).toContain(`up to ${DEFAULT_TTL_MS / 3_600_000} hours`);
    expect(t).toContain(`last ${HISTORY_LIMIT} receipts`);
  });

  it("only confirmed receipts are cached, failures never", () => {
    const route = read("src/app/api/verify/route.ts");
    expect(route).toMatch(/if \(result\.value\.verified\) setCached\(/);
    expect(t).toMatch(/Failed checks are never kept/);
  });

  it("analytics strips query and hash and never counts the API", () => {
    const known = new Set(["/", "/banks/cbe"]);
    expect(analyticsUrl("https://cheki.et/banks/cbe?ref=FT123#x", known)).toBe("https://cheki.et/banks/cbe");
    expect(analyticsUrl("https://cheki.et/api/verify", known)).toBeNull();
    expect(analyticsUrl("https://cheki.et/FT26140P01YB", known)).toBeNull();
    expect(t).toMatch(/no cookies/);
  });

  it("cheki sets no cookies and has no database", () => {
    for (const f of walk("src")) {
      const src = read(f);
      expect(src, f).not.toMatch(/document\.cookie\s*=|cookies\(\)\.set|\.cookies\.set\(/);
    }
    const pkg = read("package.json");
    expect(pkg).not.toMatch(/"(pg|mysql2|mongodb|@prisma\/client|redis|ioredis|@upstash\/redis|@vercel\/kv|better-sqlite3)"/);
    expect(t).toMatch(/no accounts and no database/);
  });

  it("names no third party beyond Vercel and Telegram", () => {
    for (const l of trustPageLinks(PRIVACY).filter((x) => /^https?:/.test(x.href))) {
      expect(l.href).toMatch(/^https:\/\/(github\.com\/1RB\/cheki|vercel\.com\/)/);
    }
  });
});

describe("contact", () => {
  it("offers GitHub issues and the repo's existing Telegram bot, no personal email", () => {
    const hrefs = trustPageLinks(CONTACT).map((l) => l.href);
    expect(hrefs).toContain("https://github.com/1RB/cheki/issues");
    expect(hrefs).toContain("https://t.me/raysterminalbot");
    // New-bank requests use the repo's issue form, so they get its bank-wanted label.
    expect(hrefs).toContain("https://github.com/1RB/cheki/issues/new?template=bank-request.yml");
    expect(read(".github/ISSUE_TEMPLATE/bank-request.yml")).toMatch(/^name: /m);
    // The same bot /banks already links, so contact adds no new channel.
    expect(read("src/app/banks/page.tsx")).toContain("https://t.me/raysterminalbot");
    expect(trustPageText(CONTACT)).not.toMatch(/@[a-z0-9-]+\.[a-z]{2,}/i);
  });
});

describe("wiring", () => {
  it("each trust page is in the sitemap, dated by its own update", () => {
    const entries = sitemap();
    for (const p of TRUST_PAGES) {
      const e = entries.find((x) => x.url === `https://cheki.et${p.path}`);
      expect(e, p.path).toBeDefined();
      expect(new Date(e!.lastModified!).toISOString().slice(0, 10)).toBe(p.updated);
    }
  });

  it("each page links the other two in its content (link-audit counts only <main> links)", () => {
    for (const p of TRUST_PAGES) {
      const hrefs = new Set(trustPageLinks(p).map((l) => l.href));
      for (const other of TRUST_PAGES.filter((o) => o !== p)) expect(hrefs.has(other.path), `${p.path} -> ${other.path}`).toBe(true);
    }
  });

  it("the footer links all three, labelled in every language", () => {
    const chrome = read("src/components/Chrome.tsx");
    for (const p of ["/about", "/privacy", "/contact"]) expect(chrome).toContain(`href="${p}"`);
    for (const [loc, tr] of Object.entries(translations)) {
      const f = (tr as { footer: Record<string, string> }).footer;
      for (const k of ["about", "privacy", "contact"]) expect(f[k], `${loc}.footer.${k}`).toBeTruthy();
    }
  });

  it("guides show the Ray (@1RB) byline the Article JSON-LD names", () => {
    expect(read("src/app/guides/[slug]/page.tsx")).toMatch(/<T k="guides\.by" \/> <Link href="\/about" prefetch=\{false\} rel="author">Ray \(@1RB\)<\/Link>/);
    for (const [loc, tr] of Object.entries(translations)) {
      expect((tr as unknown as { guides: Record<string, unknown> }).guides.by, `${loc}.guides.by`).toBeTruthy();
    }
  });

  it("each page has a canonical, an H1 and a dated update", () => {
    for (const p of TRUST_PAGES) {
      expect(p.updated).toMatch(/^\d{4}-\d{2}-\d{2}$/);
      expect(p.heading.length).toBeGreaterThan(3);
      expect(read(`src/app${p.path}/page.tsx`)).toMatch(/trustPageMetadata\(/);
    }
  });
});
